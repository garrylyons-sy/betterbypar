import type {PoolClient} from 'pg';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {loadNotificationConfig} from '@/lib/server/notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import {validateAnnouncementDraft,announcementSelection,announcementPreviewToken,announcementUuidPattern,type AnnouncementDraft} from '@/lib/announcement-policy.mjs';
type Queryable=Pick<PoolClient,'query'>;
const database={query:dbQuery} as Queryable;
export class AnnouncementError extends Error {constructor(message:string,public status=400){super(message);}}
// Current season assignments only. Season-independent roles resolve against these teams.
export const announcementTeamsSql=`select t.id,t.club_id,t.league_id,t.name,l.name as league,s.name as season
 from public.team t join public.club c on c.id=t.club_id and c.active
 join public.league l on l.id=t.league_id join public.season s on s.id=t.season_id
 where t.active and (s.active or (not exists(select 1 from public.season where active) and s.id=(select id from public.season order by starts_on desc nulls last,name desc,id limit 1)))`;
export const announcementAudienceSql=`with current_teams as (${announcementTeamsSql}), assignments as (
 select cm.person_id,cm.role::text as role,cm.club_id,null::uuid as team_id from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.active
 union select cm.person_id,'Club Admin',cm.club_id,null::uuid from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.active and cm.is_club_admin
 union select ca.person_id,'Club Admin',ca.club_id,null::uuid from public.club_admin ca join public.club c on c.id=ca.club_id and c.active where ca.active
 union select tm.person_id,tm.role::text,t.club_id,t.id from public.team_membership tm join current_teams t on t.id=tm.team_id where tm.active
 union select ptr.person_id,ptr.role::text,t.club_id,t.id from public.person_team_role ptr join public.club_membership cm on cm.id=ptr.club_membership_id and cm.person_id=ptr.person_id and cm.club_id=ptr.club_id and cm.active join current_teams t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name where ptr.active
 union select person_id,'Publisher',null::uuid,null::uuid from public.app_publisher where active
 union select person_id,'Administrator',null::uuid,null::uuid from public.app_operator where active
 ) select p.id as "personId",array(select distinct role from assignments a where a.person_id=p.id) as roles,np.preferences,
 exists(select 1 from public.notification_push_subscription sub where sub.person_id=p.id and sub.active) as "hasPush"
 from public.person p left join public.notification_preference np on np.person_id=p.id
 where p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active)
 and exists(select 1 from assignments a where a.person_id=p.id)
 and ($1::uuid is null or exists(select 1 from assignments a where a.person_id=p.id and a.club_id=$1 and ($2::uuid is null or a.team_id=$2)))
 and (cardinality($3::text[])=0 or exists(select 1 from assignments a where a.person_id=p.id and a.role=any($3::text[]) and (a.role='Administrator' or $1::uuid is null or a.club_id=$1) and (a.role not in ('Manager','Player') or $2::uuid is null or a.team_id=$2))) order by p.id`;
async function validateScope(draft:AnnouncementDraft,client:Queryable){
 if(!draft.audience.clubId)return;
 const clubs=await client.query('select id from public.club where id=$1 and active',[draft.audience.clubId]);
 if(!clubs.rows.length)throw new AnnouncementError('The selected club is no longer active.');
 if(draft.audience.teamId){const teams=await client.query(`select id from (${announcementTeamsSql}) teams where id=$1 and club_id=$2`,[draft.audience.teamId,draft.audience.clubId]);if(!teams.rows.length)throw new AnnouncementError('Choose an active team belonging to the selected club.');}
}
async function selection(draft:AnnouncementDraft,client:Queryable){
 await validateScope(draft,client);
 const config=await loadNotificationConfig(client);
 const {rows}=await client.query(announcementAudienceSql,[draft.audience.clubId,draft.audience.teamId,draft.audience.roles]);
 const result=announcementSelection(rows,config,draft.audience);
 return {...result,previewToken:announcementPreviewToken(draft,result.recipients,config)};
}
export async function previewAnnouncement(input:unknown,client:Queryable=database){
 const draft=validateAnnouncementDraft(input),result=await selection(draft,client);
 return {...result.summary,previewToken:result.previewToken};
}
export async function loadAnnouncementOptions(client:Queryable=database){
 const config=await loadNotificationConfig(client);
 const clubs=await client.query('select id,name from public.club where active order by name');
 const teams=await client.query(`select id,club_id as "clubId",name,league,season from (${announcementTeamsSql}) teams order by club_id,league,name`);
 return {clubs:clubs.rows,teams:teams.rows,eligibleRoles:config.eligibleRoles,enabled:config.enabled,announcementsEnabled:config.enabledTypes.includes('announcement')};
}
const historyFields=`a.id,a.title,a.summary,a.created_at as "createdAt",coalesce(nullif(concat_ws(' ',p.first_name,p.last_name),''),'Former administrator') as "senderName"`;
export async function loadAnnouncementHistory(value='1',client:Queryable=database){
 if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>1000000)throw new AnnouncementError('Choose a valid history page.');
 const count=await client.query('select count(*)::int as total from public.notification_announcement');
 const total=Number(count.rows[0]?.total??0),pageSize=10,totalPages=Math.max(1,Math.ceil(total/pageSize));
 const page=Math.min(Number(value),totalPages);
 const result=await client.query(`select ${historyFields} from public.notification_announcement a left join public.person p on p.id=a.sender_person_id order by a.created_at desc,a.id desc limit $1 offset $2`,[pageSize,(page-1)*pageSize]);
 return {items:result.rows,page,pageSize,total,totalPages};
}
export async function loadAnnouncementDetail(id:string,client:Queryable=database){
 if(!announcementUuidPattern.test(id))throw new AnnouncementError('Choose a valid announcement.');
 const result=await client.query(`select ${historyFields},a.body,a.audience,c.name as "clubName",t.name as "teamName" from public.notification_announcement a left join public.person p on p.id=a.sender_person_id left join public.club c on c.id::text=a.audience->>'clubId' left join public.team t on t.id::text=a.audience->>'teamId' where a.id=$1`,[id]);
 if(!result.rows[0])throw new AnnouncementError('Announcement not found.',404);
 return result.rows[0];
}
export async function sendAnnouncement(senderPersonId:string,input:unknown,authorize?:(client:Queryable)=>Promise<void>){
 const draft=validateAnnouncementDraft(input),v=input as {requestId?:unknown;previewToken?:unknown};
 if(typeof v.requestId!=='string'||!announcementUuidPattern.test(v.requestId))throw new AnnouncementError('A valid request ID is required.');
 if(typeof v.previewToken!=='string'||!v.previewToken)throw new AnnouncementError('Preview this announcement before sending.');
 const requestId=v.requestId.toLowerCase();
 const result=await withTransaction(async client=>{
 if(authorize)await authorize(client);
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`announcement:${requestId}`]);
 const existing=await client.query('select id,sender_person_id as "senderPersonId",title,body,audience,summary,created_at as "createdAt" from public.notification_announcement where id=$1',[requestId]);
 if(existing.rows[0]){
 const row=existing.rows[0];
 if(row.senderPersonId!==senderPersonId||JSON.stringify(validateAnnouncementDraft(row))!==JSON.stringify(draft))throw new AnnouncementError('This request ID has already been used for a different announcement.',409);
 return {announcement:row,duplicate:true};
 }
 const selected=await selection(draft,client);
 if(!selected.summary.enabled||!selected.summary.announcementsEnabled)throw new AnnouncementError('Announcements are disabled.');
 if(selected.previewToken!==v.previewToken)throw new AnnouncementError('Audience or notification settings changed. Preview the announcement again.',409);
 if(!selected.recipients.length)throw new AnnouncementError('No recipients can receive this announcement.');
 const saved=await client.query(`insert into public.notification_announcement(id,sender_person_id,title,body,audience,summary) values($1,$2,$3,$4,$5::jsonb,$6::jsonb) returning id,title,body,audience,summary,created_at as "createdAt"`,[requestId,senderPersonId,draft.title,draft.body,JSON.stringify(draft.audience),JSON.stringify(selected.summary)]);
 await client.query(`with recipients as (select * from jsonb_to_recordset($1::jsonb) as r("personId" uuid,inbox boolean,push boolean)), inserted as (
 insert into public.app_notification(person_id,type,title,body,href,event_key,expires_at,inbox_visible)
 select "personId",'announcement',$2,$3,'/?notifications=1',$4,now()+interval '30 days',inbox from recipients returning id,person_id
 ) insert into public.notification_push_delivery(notification_id,subscription_id)
 select n.id,s.id from inserted n join recipients r on r."personId"=n.person_id and r.push join public.notification_push_subscription s on s.person_id=n.person_id and s.active on conflict do nothing`,[JSON.stringify(selected.recipients),draft.title,draft.body,`announcement:${requestId}`]);
 return {announcement:saved.rows[0],duplicate:false};
 });
 if(!result.duplicate)scheduleNotificationPush();
 return result;
}
