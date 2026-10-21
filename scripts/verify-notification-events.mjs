// Real SQL verification with all changes rolled back and no push dispatcher.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),{Pool}=require('pg');
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();
const db={dbQuery:(sql,args)=>client.query(sql,args),withTransaction:fn=>fn(client)};
const compiled=ts.transpileModule(fs.readFileSync(new URL('../lib/server/notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const core={};new Function('require','exports',compiled)(name=>name.endsWith('notification-policy.mjs')?policy:db,core);
try{
 await client.query('begin');
 const initial=await core.loadNotificationConfig(client);
 const config={...initial,version:3,enabled:true,eligibleRoles:['Manager','League Chair'],enabledTypes:policy.notificationTypes};
 await client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify(config)]);
 const selection=await client.query(`with managers as (
 select tm.person_id,tm.team_id from public.team_membership tm where tm.active and tm.role::text='Manager'
 union select ptr.person_id,t.id from public.person_team_role ptr join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active join public.team t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name and t.active where ptr.active and ptr.role::text='Manager'
 ) select f.*,m.person_id,m.team_id from public.fixture f join managers m on m.team_id in(f.home_team_id,f.away_team_id) join public.user_account ua on ua.person_id=m.person_id and ua.active join public.person p on p.id=m.person_id and p.active where f.status='Scheduled' and f.fixture_date>now() order by f.fixture_date limit 1`);
 const f=selection.rows[0];assert.ok(f,'Need a scheduled fixture with an active manager.');
 const publishing=f.team_id===f.home_team_id?f.away_team_id:f.home_team_id;
 const chair=(await client.query("select cm.person_id from public.club_membership cm join public.user_account ua on ua.person_id=cm.person_id and ua.active join public.person p on p.id=cm.person_id and p.active where cm.active and cm.role::text='League Chair' limit 1")).rows[0];assert.ok(chair);
 for(const personId of new Set([f.person_id,chair.person_id]))await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb) on conflict(person_id) do update set preferences=excluded.preferences',[personId,JSON.stringify({...policy.defaultNotificationPreferences,inboxTypes:policy.notificationTypes,pushTypes:[],pushEnabled:false})]);
 await client.query("insert into public.fixture_lineup(fixture_id,team_id,status,published_at,submitted_by) values($1,$2,'Published',now(),$3) on conflict(fixture_id,team_id) do update set status='Published',published_at=now()",[f.id,publishing,f.person_id]);
 await core.notifyOpponentLineupPublished(client,f.id,publishing);
 const key=`lineup-published:${f.id}:${publishing}`;
 const first=await client.query('select id,person_id,title,body from public.app_notification where event_key=$1',[key]);
 assert.ok(first.rows.some(row=>row.person_id===f.person_id));
 const mine=first.rows.find(row=>row.person_id===f.person_id);assert.equal(mine.title,'Opponents published');
 assert.equal(await core.notificationSourceIsCurrent(mine.id,f.person_id,client),true);
 await core.notifyOpponentLineupPublished(client,f.id,publishing);
 assert.equal((await client.query('select count(*)::int as count from public.app_notification where event_key=$1',[key])).rows[0].count,first.rows.length);
 await client.query("update public.fixture_lineup set status='Draft' where fixture_id=$1 and team_id=$2",[f.id,publishing]);
 assert.equal(await core.notificationSourceIsCurrent(mine.id,f.person_id,client),false);
 await client.query("update public.fixture set status='Completed' where id=$1",[f.id]);
 await client.query('insert into public.match(fixture_id,home_team_score,away_team_score) values($1,4,3) on conflict(fixture_id) do update set home_team_score=4,away_team_score=3',[f.id]);
 await core.notifyMatchCompleted(client,f.id);
 const results=await client.query('select id,title,body,href from public.app_notification where person_id=$1 and event_key=$2',[chair.person_id,`result:${f.id}:4:3`]);
 assert.ok(results.rows[0]);assert.match(results.rows[0].body,/4–3/);assert.match(results.rows[0].href,/page=Results/);
 assert.equal(await core.notificationSourceIsCurrent(results.rows[0].id,chair.person_id,client),true);
 await core.notifyMatchCompleted(client,f.id);
 assert.equal((await client.query('select count(*)::int as count from public.app_notification where person_id=$1 and event_key=$2',[chair.person_id,`result:${f.id}:4:3`])).rows[0].count,1);
 console.log('Verified lineup audience, publication freshness, result scores, new database types and duplicate prevention. All writes rolled back; no real push dispatch. Current rollout roles:',initial.eligibleRoles.join(', '));
}finally{await client.query('rollback');client.release();await pool.end();}
