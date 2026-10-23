import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {cupDrawAudienceSql} from '@/lib/server/cup-draw-notifications';
import {loadNotificationConfig,roleRowsSql} from '@/lib/server/notifications';
import {cupDrawMessage,selectCupDrawRecipients,validateCupDrawAudience} from '@/lib/cup-draw-notification-policy.mjs';
type Client=Pick<PoolClient,'query'>;
type Audience={groups:string[];personIds:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function audienceInput(value:unknown):Audience {
 const v=value as Partial<Audience>|null;
 if(!v||typeof v!=='object')throw new Error('Choose notification recipients.');
 const groups=validateCupDrawAudience(v.groups).sort();
 if(v.personIds!==undefined&&(!Array.isArray(v.personIds)||v.personIds.length>100||v.personIds.some(id=>typeof id!=='string'||!uuid.test(id))))throw new Error('Choose up to 100 valid people.');
 const personIds=[...new Set((v.personIds??[]).map(id=>id.toLowerCase()))].sort();
 if(Boolean(groups.length)===Boolean(personIds.length))throw new Error('Choose role groups or specific people.');
 return {groups,personIds};
}
async function confirmedDraw(client:Client,competitionId:string,attemptId:string){
 if(!uuid.test(competitionId)||!uuid.test(attemptId))throw new Error('Choose a valid competition and draw.');
 const {rows}=await client.query(`select da.snapshot,da.created_at as drawn_at,da.witness_name,cc.name from public.cup_draw_attempt da join public.cup_competition cc on cc.id=da.competition_id where da.id=$1 and da.competition_id=$2 and da.status='Confirmed' and cc.status in ('In Progress','Complete')`,[attemptId,competitionId]);
 if(!rows[0])throw new Error('Only a confirmed cup draw can be notified.');
 const draw=rows[0];return {title:'Cup draw confirmed',body:cupDrawMessage(draw.name,draw.snapshot,{drawnAt:draw.drawn_at,witnessName:draw.witness_name})};
}
export async function cupDrawSendOptions(client:Client,competitionId:string,attemptId:string){
 const message=await confirmedDraw(client,competitionId,attemptId);
 const people=await client.query(`select p.id,p.first_name||' '||p.last_name as name from public.person p where p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active) order by p.first_name,p.last_name,p.id`);
 const config=await loadNotificationConfig(client);
 const history=await client.query(`select ns.id,ns.created_at as "createdAt",ns.summary,p.first_name||' '||p.last_name as "senderName" from public.cup_draw_notification_send ns left join public.person p on p.id=ns.sender_person_id where ns.competition_id=$1 and ns.attempt_id=$2 order by ns.created_at desc limit 10`,[competitionId,attemptId]);
 return {...message,people:people.rows,history:history.rows,eligibleRoles:config.eligibleRoles};
}
export async function previewCupDrawSend(client:Client,competitionId:string,attemptId:string,value:unknown){
 const audience=audienceInput(value),message=await confirmedDraw(client,competitionId,attemptId),config=await loadNotificationConfig(client);
 const people=audience.personIds.length?await client.query(`select p.id as "personId",array(select distinct role from (${roleRowsSql}) roles where roles.person_id=p.id) as roles,np.preferences,exists(select 1 from public.notification_push_subscription s where s.person_id=p.id and s.active) as "hasPush" from public.person p left join public.notification_preference np on np.person_id=p.id where p.id=any($1::uuid[]) and p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active) order by p.id`,[audience.personIds]):await client.query(cupDrawAudienceSql,[competitionId,audience.groups]);
 const selected=audience.personIds.length?people.rows.filter(row=>audience.personIds.includes(row.personId)):people.rows;
 const {summary,recipients}=selectCupDrawRecipients(selected,config);
 const previewToken=hash({competitionId,attemptId,audience,message,recipients,config});
 return {...message,audience,summary,recipients,previewToken};
}
export async function sendCupDrawNotification(client:Client,competitionId:string,attemptId:string,senderPersonId:string,input:{audience?:unknown;requestId?:unknown;previewToken?:unknown}){
 const audience=audienceInput(input.audience);
 if(typeof input.requestId!=='string'||!uuid.test(input.requestId)||typeof input.previewToken!=='string'||!input.previewToken)throw new Error('Preview the draw and choose recipients before sending.');
 const requestId=input.requestId.toLowerCase(),fingerprint=hash({competitionId,attemptId,senderPersonId,audience,previewToken:input.previewToken});
 // Serialize sends/deletion for this competition. The saved request makes retries
 // safe even when the response is lost after the transaction commits.
 await client.query('select id from public.cup_competition where id=$1 for update',[competitionId]);
 const existing=await client.query('select request_fingerprint,summary from public.cup_draw_notification_send where id=$1',[requestId]);
 if(existing.rows[0]){
  if(existing.rows[0].request_fingerprint!==fingerprint)throw new Error('This send request was already used for a different audience.');
  return {summary:existing.rows[0].summary,duplicate:true};
 }
 const preview=await previewCupDrawSend(client,competitionId,attemptId,audience);
 if(input.previewToken!==preview.previewToken)throw new Error('Recipients, draw or notification settings changed. Preview again before sending.');
 if(!preview.recipients.length)throw new Error('No selected recipients can receive this draw.');
 await client.query(`insert into public.cup_draw_notification_send(id,competition_id,attempt_id,sender_person_id,request_fingerprint,audience,summary,recipients) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)`,[requestId,competitionId,attemptId,senderPersonId,fingerprint,JSON.stringify(audience),JSON.stringify(preview.summary),JSON.stringify(preview.recipients)]);
 await client.query(`with recipients as (select * from jsonb_to_recordset($1::jsonb) as r("personId" uuid,inbox boolean,push boolean)), inserted as (
 insert into public.app_notification(person_id,type,title,body,href,event_key,inbox_visible)
 select "personId",'cup_draw','Cup draw confirmed',$2,'/?notifications=1',$3,inbox from recipients on conflict(person_id,event_key) do nothing returning id,person_id
 ) insert into public.notification_push_delivery(notification_id,subscription_id)
 select n.id,s.id from inserted n join recipients r on r."personId"=n.person_id and r.push join public.notification_push_subscription s on s.person_id=n.person_id and s.active on conflict do nothing`,[JSON.stringify(preview.recipients),preview.body,`cup-draw:${competitionId}:${attemptId}:${requestId}`]);
 return {summary:preview.summary,duplicate:false};
}
