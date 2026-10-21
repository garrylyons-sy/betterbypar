import type { PoolClient } from "pg";
import { dbQuery, withTransaction } from "@/lib/server/db";
import { isNotificationWithinLifetime, normalizeNotificationConfig, normalizeNotificationPreferences, validateNotificationConfig, validateNotificationPreferences, isNotificationEligible, safeNotificationHref, fixtureEventKey, type Config, type NotificationType } from "@/lib/notification-policy.mjs";

type Queryable = Pick<PoolClient, "query">;
const database = { query: dbQuery } as Queryable;
export async function loadNotificationConfig(client: Queryable = database): Promise<Config> {
 const {rows}=await client.query('select config from public.notification_config where singleton = true');
 return normalizeNotificationConfig(rows[0]?.config);
}
export async function saveNotificationConfig(input:unknown,personId:string) {
 const config=validateNotificationConfig(input);
 await dbQuery(`insert into public.notification_config(singleton,config,updated_by) values(true,$1::jsonb,$2) on conflict(singleton) do update set config=excluded.config,updated_by=excluded.updated_by,updated_at=now()`,[JSON.stringify(config),personId]);
 return config;
}
// All roles are recomputed from active database assignments, including legacy team memberships.
const roleRowsSql = `select cm.person_id, cm.role::text as role from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.active
 union select cm.person_id,'Club Admin' from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.active and cm.is_club_admin
 union select tm.person_id,tm.role::text from public.team_membership tm join public.team t on t.id=tm.team_id and t.active join public.club c on c.id=t.club_id and c.active where tm.active
 union select ptr.person_id,ptr.role::text from public.person_team_role ptr join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active join public.club c on c.id=ptr.club_id and c.active where ptr.active
 union select ca.person_id,'Club Admin' from public.club_admin ca join public.club c on c.id=ca.club_id and c.active where ca.active
 union select person_id,'Administrator' from public.app_operator where active`;
export async function notificationAccess(personId:string,client:Queryable=database) {
 const config=await loadNotificationConfig(client);
 const {rows}=await client.query(`select array(select distinct role from (${roleRowsSql}) roles where roles.person_id=p.id) as roles,np.preferences from public.person p left join public.notification_preference np on np.person_id=p.id where p.id=$1 and p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active)`,[personId]);
 const roles:string[]=rows[0]?.roles??[];
 return {eligible:Boolean(rows[0])&&isNotificationEligible(roles,config),roles,config,preferences:normalizeNotificationPreferences(rows[0]?.preferences)};
}
export async function loadNotificationInbox(personId:string) {
 const access=await notificationAccess(personId);
 if(!access.eligible)return {eligible:false,items:[],unreadCount:0};
 const {rows}=await dbQuery<{id:string;type:string;title:string;body:string;href:string;event_key:string;expires_at:Date|null;createdAt:Date;readAt:Date|null}>(`select id,type,title,body,href,event_key,expires_at,created_at as "createdAt",read_at as "readAt" from public.app_notification where person_id=$1 and inbox_visible and created_at>now()-interval '10 days' and (expires_at is null or expires_at>now()) order by created_at desc limit 100`,[personId]);
 // Cache source reads for this request only; multiple items can refer to one fixture or ladder.
 const sourceQueries=new Map<string,Promise<unknown>>();
 const sourceClient={query:(sql:string,params:unknown[]=[])=>{
 const key=JSON.stringify([sql,params]);
 if(!sourceQueries.has(key))sourceQueries.set(key,dbQuery(sql,params));
 return sourceQueries.get(key);
 }} as Queryable;
 const currentRows=[];const staleIds:string[]=[];
 for(let offset=0;offset<rows.length;offset+=5){
 const checked=await Promise.all(rows.slice(offset,offset+5).map(async item=>({item,current:await notificationSourceIsCurrent(item.id,personId,sourceClient,item)})));
 for(const {item,current} of checked){
 if(current){const {event_key: _eventKey,expires_at: _expiresAt,...visible}=item;currentRows.push(visible);}
 else staleIds.push(item.id);
 }
 }
 if(staleIds.length)await dbQuery('update public.app_notification set expires_at=now() where id=any($1::uuid[]) and person_id=$2',[staleIds,personId]);
 const count=await dbQuery(`select count(*)::integer as count from public.app_notification where person_id=$1 and inbox_visible and created_at>now()-interval '10 days' and read_at is null and (expires_at is null or expires_at>now())`,[personId]);
 return {eligible:true,items:currentRows,unreadCount:count.rows[0].count,preferences:access.preferences,config:access.config};
}
export async function saveNotificationPreferences(personId:string,input:unknown) {
 if(!(await notificationAccess(personId)).eligible)throw new Error('Notification access required.');
 const preferences=validateNotificationPreferences(input);
 await dbQuery(`insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb) on conflict(person_id) do update set preferences=excluded.preferences,updated_at=now()`,[personId,JSON.stringify(preferences)]);
 return preferences;
}
export async function markNotificationsRead(personId:string,id?:string) {
 if(!(await notificationAccess(personId)).eligible)throw new Error('Notification access required.');
 await dbQuery(`update public.app_notification set read_at=coalesce(read_at,now()) where person_id=$1 and ($2::uuid is null or id=$2::uuid)`,[personId,id??null]);
}
export type NotificationEvent={type:NotificationType;title:string;body:string;href:string;eventKey:string;expiresAt?:string|Date|null};
export async function createNotification(client:Queryable,personId:string,event:NotificationEvent) {
 const access=await notificationAccess(personId,client);
 if(!access.eligible||!access.config.enabledTypes.includes(event.type))return false;
 const inbox=access.preferences.inboxTypes.includes(event.type);
 const push=access.preferences.pushEnabled&&access.preferences.pushTypes.includes(event.type);
 if(!inbox&&!push)return false;
 const inserted=await client.query(`insert into public.app_notification(person_id,type,title,body,href,event_key,expires_at,inbox_visible) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(person_id,event_key) do nothing returning id`,[personId,event.type,event.title,event.body,safeNotificationHref(event.href),event.eventKey,event.expiresAt??null,inbox]);
 if(inserted.rows[0]&&push)await client.query(`insert into public.notification_push_delivery(notification_id,subscription_id) select $1,id from public.notification_push_subscription where person_id=$2 and active on conflict do nothing`,[inserted.rows[0].id,personId]);
 return Boolean(inserted.rowCount);
}
async function fixtureRecipients(client:Queryable,teamIds:string[],managersOnly=false) {
 const {rows}=await client.query(`select distinct person_id from (
 select tm.person_id from public.team_membership tm join public.team t on t.id=tm.team_id and t.active where tm.active and tm.team_id=any($1::uuid[]) and tm.role::text=any($2::text[])
 union select ptr.person_id from public.person_team_role ptr join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active join public.team t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name and t.active where ptr.active and t.id=any($1::uuid[]) and ptr.role::text=any($2::text[])
 union select person_id from (${roleRowsSql}) roles where role='League Chair') recipients`,[teamIds,managersOnly?['Manager']:['Player','Manager']]);
 return rows.map(row=>String(row.person_id));
}
// Date-only fixtures are stored at midnight UTC; match night starts at 19:30 Dublin.
const kickoffSql=`case when (f.fixture_date at time zone 'UTC')::time = time '00:00' then (((f.fixture_date at time zone 'UTC')::date + time '19:30') at time zone 'Europe/Dublin') else f.fixture_date end`;
export async function notifyFixtureChanged(client:Queryable,fixtureId:string,previousTeamIds:string[]=[],changeReason?:string) {
 const {rows}=await client.query(`select f.*,ht.name as home_name,at.name as away_name,${kickoffSql} as kickoff from public.fixture f join public.team ht on ht.id=f.home_team_id join public.team at on at.id=f.away_team_id where f.id=$1`,[fixtureId]);
 const f=rows[0];if(!f)return;
 // Preserve current scheduled reminders on venue edits. Only obsolete schedules/status expire.
 await client.query(`update public.app_notification set expires_at=now() where event_key like $1 and type in ('match_reminder','lineup_reminder') and ($3::text <> 'Scheduled' or event_key not like $2) and (expires_at is null or expires_at>now())`,[`fixture:${fixtureId}:%`,`${fixtureEventKey(fixtureId,f.fixture_date)}:%`,f.status]);
 const recipients=await fixtureRecipients(client,[...new Set([...previousTeamIds,f.home_team_id,f.away_team_id])]);
 // Include the previous schedule in the caller's transition key so A->B->A remains a real new change.
 const transition=await client.query("select txid_current()::text as revision");
 for(const personId of recipients)await createNotification(client,personId,{type:'fixture_change',title:'Fixture updated',body:`${changeReason ? `${changeReason}. ` : ""}${f.home_name} v ${f.away_name}: ${new Date(f.kickoff).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})} (${f.status}).`,href:`/?page=Fixtures&fixtureId=${fixtureId}`,eventKey:`${fixtureEventKey(fixtureId,f.fixture_date)}:change:${transition.rows[0].revision}${changeReason ? "" : ":schedule"}`,expiresAt:new Date(Math.max(new Date(f.kickoff).getTime(),Date.now()+86400000))});
}
export async function expireLadderNotifications(client:Queryable,challengeId:string) {
 await client.query(`update public.app_notification set expires_at=now() where event_key like $1 and (expires_at is null or expires_at>now())`,[`ladder:${challengeId}:%`]);
}
export async function notifyLadderChallenge(client:Queryable,challengeId:string,personIds:string[],kind:string) {
 const {rows}=await client.query(`select l.name,c.name as club_name,ch.response_due_at,ch.play_by from public.club_ladder_challenge ch join public.club_ladder l on l.id=ch.ladder_id join public.club c on c.id=l.club_id where ch.id=$1`,[challengeId]);
 if(!rows[0])return;
 if(kind!=='received')await client.query(`update public.app_notification set expires_at=now() where event_key in ($1,$2) or event_key like $3`,[`ladder:${challengeId}:received`,`ladder:${challengeId}:deadline:response`,`ladder:${challengeId}:deadline:response:%`]);
 for(const id of [...new Set(personIds)])await createNotification(client,id,{type:'ladder_challenge',title:kind==='received'?'New ladder challenge':'Ladder challenge updated',body:`${rows[0].name}: ${kind}.`,href:`/?page=Ladder&challengeId=${challengeId}&club=${encodeURIComponent(rows[0].club_name)}`,eventKey:`ladder:${challengeId}:${kind}`,expiresAt:kind==='received'?rows[0].response_due_at:(rows[0].play_by??rows[0].response_due_at??new Date(Date.now()+86400000))});
}
export async function processNotificationReminders() {
 return withTransaction(async client=>{
 await client.query("select pg_advisory_xact_lock(hashtext('notification-reminders'))");
 const config=await loadNotificationConfig(client);let created=0;
 if(!config.enabled)return {created};
 const fixtures=await client.query(`select f.*,ht.name as home_name,at.name as away_name,${kickoffSql} as kickoff from public.fixture f join public.team ht on ht.id=f.home_team_id and ht.active join public.team at on at.id=f.away_team_id and at.active where f.status='Scheduled' and ${kickoffSql}>now() and ${kickoffSql}<=now()+($1::text||' hours')::interval`,[Math.max(config.matchReminderHours,config.lineupReminderHours)]);
 for(const f of fixtures.rows){
 // A schedule transition gets a fresh reminder identity, including A -> B -> A.
 const revision=await client.query(`select event_key from public.app_notification where type='fixture_change' and event_key like $1 order by created_at desc limit 1`,[`${fixtureEventKey(f.id,f.fixture_date)}:change:%:schedule`]);
 const scheduleRevision=revision.rows[0]?.event_key??'initial';
 for(const type of ['match_reminder','lineup_reminder'] as const){
 const hours=type==='match_reminder'?config.matchReminderHours:config.lineupReminderHours;
 if(!config.enabledTypes.includes(type)||new Date(f.kickoff).getTime()-Date.now()>hours*3600000)continue;
 let teams=[f.home_team_id,f.away_team_id];
 if(type==='lineup_reminder'){
 const published=await client.query("select team_id from public.fixture_lineup where fixture_id=$1 and status='Published'",[f.id]);
 teams=teams.filter(t=>!published.rows.some(p=>p.team_id===t));if(!teams.length)continue;
 }
 const recipients=await fixtureRecipients(client,teams,type==='lineup_reminder');
 for(const personId of recipients)if(await createNotification(client,personId,{type,title:type==='match_reminder'?'Upcoming fixture':'Lineup still required',body:`${f.home_name} v ${f.away_name} starts ${new Date(f.kickoff).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})}.`,href:await fixtureRecipientHref(client,f.id,personId,teams,type==='lineup_reminder'),eventKey:`${fixtureEventKey(f.id,f.fixture_date)}:${type}:${scheduleRevision}`,expiresAt:f.kickoff}))created++;
 }
 }
 if(config.enabledTypes.includes('ladder_challenge')){
 const challenges=await client.query(`select ch.id,ch.status,case when ch.status='Pending' then ch.response_due_at else ch.play_by end as deadline,a.person_id as challenger,b.person_id as challenged,l.name,c.name as club_name from public.club_ladder_challenge ch join public.club_ladder_entry a on a.id=ch.challenger_entry_id join public.club_ladder_entry b on b.id=ch.challenged_entry_id join public.club_ladder l on l.id=ch.ladder_id and l.active join public.club c on c.id=l.club_id and c.active where ch.status in ('Pending','Accepted','Scheduled') and case when ch.status='Pending' then ch.response_due_at else ch.play_by end>now() and case when ch.status='Pending' then ch.response_due_at else ch.play_by end<=now()+($1::text||' hours')::interval`,[config.ladderReminderHours]);
 for(const ch of challenges.rows){
 const recipients=ch.status==='Pending'?[ch.challenged]:[ch.challenger,ch.challenged];
 for(const id of recipients)if(await createNotification(client,id,{type:'ladder_challenge',title:ch.status==='Pending'?'Challenge response due':'Ladder match deadline',body:`${ch.name}: ${ch.status==='Pending'?'respond to your challenge':'complete your match'} by ${new Date(ch.deadline).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})}.`,href:`/?page=Ladder&challengeId=${ch.id}&club=${encodeURIComponent(ch.club_name)}`,eventKey:`ladder:${ch.id}:deadline:${ch.status==='Pending'?'response':'play'}:${new Date(ch.deadline).toISOString()}`,expiresAt:ch.deadline}))created++;
 }
 }
 return {created};
 });
}

async function fixtureRecipientHref(client:Queryable,fixtureId:string,personId:string,teamIds:string[],managerOnly:boolean) {
 const {rows}=await client.query(`select t.name,c.name as club_name,tm.role::text as role from public.team t join public.club c on c.id=t.club_id join public.team_membership tm on tm.team_id=t.id and tm.active where t.id=any($1::uuid[]) and tm.person_id=$2 and tm.role::text=any($3::text[])
 union select t.name,c.name,ptr.role::text from public.team t join public.club c on c.id=t.club_id join public.person_team_role ptr on ptr.club_id=t.club_id and ptr.league_id=t.league_id and ptr.team_name=t.name and ptr.active join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active where t.id=any($1::uuid[]) and ptr.person_id=$2 and ptr.role::text=any($3::text[]) order by role limit 1`,[teamIds,personId,managerOnly?['Manager']:['Manager','Player']]);
 const params=new URLSearchParams({page:'Fixtures',fixtureId});
 if(rows[0]){params.set('team',rows[0].name);params.set('role',rows[0].role);params.set('club',rows[0].club_name);}else params.set('role','League Chair');
 return `/?${params}`;
}
export async function refreshFixtureLineupNotifications(client:Queryable,fixtureId:string) {
 const fixture=await client.query('select home_team_id,away_team_id from public.fixture where id=$1',[fixtureId]);if(!fixture.rows[0])return;
 const published=await client.query("select team_id from public.fixture_lineup where fixture_id=$1 and status='Published'",[fixtureId]);
 const missing=[fixture.rows[0].home_team_id,fixture.rows[0].away_team_id].filter(id=>!published.rows.some(p=>p.team_id===id));
 const recipients=missing.length?await fixtureRecipients(client,missing,true):[];
 await client.query(`update public.app_notification set expires_at=now() where type='lineup_reminder' and event_key like $1 and not(person_id=any($2::uuid[])) and (expires_at is null or expires_at>now())`,[`fixture:${fixtureId}:%`,recipients]);
}
export async function expireTerminalLadderNotifications(client:Queryable,ladderId:string) {
 await client.query(`update public.app_notification n set expires_at=now() from public.club_ladder_challenge ch join public.club_ladder l on l.id=ch.ladder_id where ch.ladder_id=$1 and n.event_key like ('ladder:'||ch.id::text||':%') and (not l.active or ch.status in ('Cancelled','Completed','Expired','Walkover')) and (n.expires_at is null or n.expires_at>now())`,[ladderId]);
}
type NotificationSource = {type:string;event_key:string;createdAt?:string|Date;expires_at?:string|Date|null};
export async function notificationSourceIsCurrent(notificationId:string,personId:string,client:Queryable=database,preloaded?:NotificationSource):Promise<boolean> {
 const n=preloaded??(await client.query('select type,event_key,expires_at,created_at as "createdAt" from public.app_notification where id=$1 and person_id=$2',[notificationId,personId])).rows[0];
 if(!n)return false;
 if(n.createdAt&&!isNotificationWithinLifetime(n.createdAt))return false;
 if(n.expires_at&&new Date(n.expires_at).getTime()<=Date.now())return false;
 const fixtureMatch=/^fixture:([0-9a-f-]{36}):(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z):/.exec(n.event_key);
 if(fixtureMatch){
 const result=await client.query(`select f.*,${kickoffSql} as kickoff from public.fixture f where f.id=$1`,[fixtureMatch[1]]);const f=result.rows[0];
 if(!f||new Date(f.fixture_date).toISOString()!==fixtureMatch[2])return false;
 if(n.type==='fixture_change')return true;
 if(f.status!=='Scheduled'||new Date(f.kickoff).getTime()<=Date.now())return false;
 let teams=[f.home_team_id,f.away_team_id];
 if(n.type==='lineup_reminder'){
 const published=await client.query("select team_id from public.fixture_lineup where fixture_id=$1 and status='Published'",[f.id]);teams=teams.filter(id=>!published.rows.some(p=>p.team_id===id));if(!teams.length)return false;
 }
 return (await fixtureRecipients(client,teams,n.type==='lineup_reminder')).includes(personId);
 }
 const ladderMatch=/^ladder:([0-9a-f-]{36}):(.*)$/.exec(n.event_key);
 if(ladderMatch){
 const result=await client.query(`select ch.*,a.person_id as challenger,b.person_id as challenged,l.active as ladder_active,c.active as club_active,a.status as challenger_status,b.status as challenged_status from public.club_ladder_challenge ch join public.club_ladder_entry a on a.id=ch.challenger_entry_id join public.club_ladder_entry b on b.id=ch.challenged_entry_id join public.club_ladder l on l.id=ch.ladder_id join public.club c on c.id=l.club_id where ch.id=$1`,[ladderMatch[1]]);
 const ch=result.rows[0];if(!ch||!ch.ladder_active||!ch.club_active||![ch.challenger,ch.challenged].includes(personId)||['Withdrawn'].includes(ch.challenger_status)||['Withdrawn'].includes(ch.challenged_status))return false;
 const kind=ladderMatch[2];
 if(kind==='received'||kind.startsWith('deadline:response:'))return ch.status==='Pending'&&ch.challenged===personId&&new Date(ch.response_due_at).getTime()>Date.now()&&(!kind.startsWith('deadline:')||kind===`deadline:response:${new Date(ch.response_due_at).toISOString()}`);
 if(kind==='rejected')return ch.status==='Rejected';
 if(!['Accepted','Scheduled'].includes(ch.status)||new Date(ch.play_by).getTime()<=Date.now())return false;
 return !kind.startsWith('deadline:play:')||kind===`deadline:play:${new Date(ch.play_by).toISOString()}`;
 }
 return true; // Self-only push test events have no fixture or challenge source.
}
