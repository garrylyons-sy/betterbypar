import * as cupInbox from '../lib/cup-draw-inbox.mjs';
// Actual scheduling, source freshness and publication SQL; no push dispatcher and all writes rolled back.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {Pool} from 'pg';
import * as policy from '../lib/notification-policy.mjs';
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});const client=await pool.connect();
const source=ts.transpileModule(fs.readFileSync(new URL('../lib/server/notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const core={};new Function('require','exports',source)(name=>name.endsWith('cup-draw-inbox.mjs')?cupInbox:name.includes('notification-policy')?policy:{dbQuery:(...args)=>client.query(...args),withTransaction:fn=>fn(client)},core);
try{
 await client.query('begin');
 const initial=await core.loadNotificationConfig(client);
 const config={...initial,enabled:true,eligibleRoles:['Manager','League Chair'],enabledTypes:['lineup_reminder'],lineupDeadlineHours:2};
 const save=async c=>client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify(c)]);await save(config);
 const fixture=(await client.query(`with managers as (
 select tm.person_id,tm.team_id from public.team_membership tm where tm.active and tm.role::text='Manager'
 union select ptr.person_id,t.id from public.person_team_role ptr join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active join public.team t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name and t.active where ptr.active and ptr.role::text='Manager'
 ) select f.*,m.person_id,m.team_id from public.fixture f join managers m on m.team_id in (f.home_team_id,f.away_team_id) join public.person p on p.id=m.person_id and p.active join public.user_account ua on ua.person_id=p.id and ua.active where f.status='Scheduled' order by f.fixture_date desc limit 1`)).rows[0];assert.ok(fixture);
 const f=fixture,opponent=f.team_id===f.home_team_id?f.away_team_id:f.home_team_id;
 await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb) on conflict(person_id) do update set preferences=excluded.preferences',[f.person_id,JSON.stringify({...policy.defaultNotificationPreferences,inboxTypes:['lineup_reminder'],pushTypes:[],pushEnabled:false})]);
 for(const team of [f.team_id,opponent])await client.query("insert into public.fixture_lineup(fixture_id,team_id,status,published_at,submitted_by) values($1,$2,$3,case when $3::text='Published' then now() end,$4) on conflict(fixture_id,team_id) do update set status=excluded.status,published_at=excluded.published_at",[f.id,team,team===opponent?'Published':'Draft',f.person_id]);
 const reschedule=async interval=>(await client.query(`update public.fixture set fixture_date=clock_timestamp()+$2::interval where id=$1 returning fixture_date`,[f.id,interval])).rows[0].fixture_date;
 const count=async()=>Number((await client.query("select count(*) as n from public.app_notification where person_id=$1 and event_key like $2 and type='lineup_reminder'",[f.person_id,`fixture:${f.id}:%:team:${f.team_id}:deadline:%`])).rows[0].n);
 const before=await count();await reschedule('3 hours 1 minute');await core.processNotificationReminders();assert.equal(await count(),before);
 const kickoff=await reschedule('2 hours 30 minutes');await core.processNotificationReminders();assert.equal(await count(),before+1);
 let notice=(await client.query("select * from public.app_notification where person_id=$1 and event_key like $2 and expires_at>clock_timestamp() order by created_at desc limit 1",[f.person_id,`fixture:${f.id}:%:team:${f.team_id}:deadline:%`])).rows[0];
 assert.equal(notice.type,'lineup_reminder');assert.ok(notice.body.includes('You need to publish your team by'));assert.equal(notice.expires_at.getTime(),kickoff.getTime()-2*3600000);
 assert.equal(await core.notificationSourceIsCurrent(notice.id,f.person_id,client),true);
 await core.processNotificationReminders();assert.equal(await count(),before+1);
 // A -> B -> A must produce a fresh event even with fixture_change disabled.
 await reschedule('4 hours');await core.notifyFixtureChanged(client,f.id,[],undefined,'rescheduled');
 await client.query('update public.fixture set fixture_date=$2 where id=$1',[f.id,kickoff]);await core.notifyFixtureChanged(client,f.id,[],undefined,'rescheduled');
 await core.processNotificationReminders();assert.equal(await count(),before+2);
 assert.equal(await core.notificationSourceIsCurrent(notice.id,f.person_id,client),false);
 notice=(await client.query("select * from public.app_notification where person_id=$1 and event_key like $2 and expires_at>clock_timestamp() order by created_at desc limit 1",[f.person_id,`fixture:${f.id}:%:team:${f.team_id}:deadline:%`])).rows[0];
 assert.ok(notice);assert.equal(await core.notificationSourceIsCurrent(notice.id,f.person_id,client),true);
 await save({...config,lineupDeadlineHours:1});assert.equal(await core.notificationSourceIsCurrent(notice.id,f.person_id,client),false);await save(config);
 await client.query("update public.fixture_lineup set status='Published',published_at=now() where fixture_id=$1 and team_id=$2",[f.id,f.team_id]);await core.refreshFixtureLineupNotifications(client,f.id);
 assert.equal(await core.notificationSourceIsCurrent(notice.id,f.person_id,client),false);
 assert.ok((await client.query('select expires_at<=clock_timestamp() as expired from public.app_notification where id=$1',[notice.id])).rows[0].expired);
 await core.processNotificationReminders();assert.equal(await count(),before+2);
 await client.query("update public.fixture_lineup set status='Draft',published_at=null where fixture_id=$1 and team_id=$2",[f.id,f.team_id]);await reschedule('1 hour 30 minutes');await core.processNotificationReminders();assert.equal(await count(),before+2);
 await save({...config,enabledTypes:[]});assert.equal((await core.processNotificationReminders()).created,0);
 const old=(await client.query("insert into public.app_notification(person_id,type,title,body,href,event_key) values($1,'match_reminder','Retired','Test','/','retired-test:'||gen_random_uuid()) returning id",[f.person_id])).rows[0];assert.equal(await core.notificationSourceIsCurrent(old.id,f.person_id,client),false);
 console.log('Verified one-hour deadline window, per-team manager notice, duplicate prevention, A-to-B-to-A schedule changes without fixture alerts, changed cutoff, publication expiry, late suppression, optional disabling and retired match alerts. All writes rolled back; no real push dispatched.');
}finally{await client.query('rollback');client.release();await pool.end();}
