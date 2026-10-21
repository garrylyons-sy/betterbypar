import * as presentation from '../lib/cup-draw-presentation.mjs';
// Exercises actual draw workflow + fixture publication in one rolled-back transaction.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
import * as cupPolicy from '../lib/cup-draw-notification-policy.mjs';
import * as draw from '../lib/server/cup-draw.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),{Pool}=require('pg');
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();
function load(file,deps){const compiled=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const api={};new Function('require','exports',compiled)(name=>name==='@/lib/cup-draw-presentation.mjs'?presentation:deps[name]??require(name),api);return api;}
const publication=load('../lib/server/cup-competitions.ts',{});
const notificationCore=load('../lib/server/notifications.ts',{'@/lib/notification-policy.mjs':policy,'@/lib/server/db':{dbQuery:(...args)=>client.query(...args),withTransaction:fn=>fn(client)}});
const cupNotifications=load('../lib/server/cup-draw-notifications.ts',{'@/lib/server/notifications':notificationCore,'@/lib/cup-draw-notification-policy.mjs':cupPolicy});
const workflow=load('../lib/server/cup-draw-workflow.ts',{'@/lib/server/cup-draw-notifications':cupNotifications,'@/lib/cup-draw-notification-policy.mjs':cupPolicy,'@/lib/server/cup-draw.mjs':draw,'@/lib/server/cup-competitions':publication});
try{
 await client.query('begin');
 const actor=(await client.query('select person_id from public.app_operator where active limit 1')).rows[0].person_id;
 const allTeams=(await client.query(`select t.* from public.team t join public.club c on c.id=t.club_id and c.active where t.active and (select count(*) from public.team other join public.club oc on oc.id=other.club_id and oc.active where other.active and other.season_id=t.season_id)>=4 order by t.season_id,t.id limit 4`)).rows;
 const teams=allTeams.slice(0,3);assert.equal(allTeams.length,4);
 assert.equal(teams.length,3);assert.equal(teams[0].season_id,teams[2].season_id);
 const cup=(await client.query("insert into public.cup_competition(season_id,name,round_count,created_by) values($1,'Draw verification '||gen_random_uuid(),2,$2) returning id",[teams[0].season_id,actor])).rows[0].id;
 for(const t of teams)await client.query('insert into public.cup_competition_entry(competition_id,team_id) values($1,$2)',[cup,t.id]);
 for(let n=1;n<=2;n++)await client.query("insert into public.cup_competition_round(competition_id,round_number,name,fixture_date) values($1,$2,$3,current_date+($2::int*7))",[cup,n,n===1?'Semi Final':'Final']);
 await client.query("insert into public.cup_competition_format_slot(competition_id,slot_number,game_type) values($1,1,'Singles')",[cup]);
 const fixtureCount=async()=>Number((await client.query('select count(*) as n from public.cup_competition_tie t join public.cup_competition_round r on r.id=t.competition_round_id where r.competition_id=$1',[cup])).rows[0].n);
 // Synthetic people and notification settings exist only in this rolled-back transaction.
 const originalConfig=await notificationCore.loadNotificationConfig(client);
 await client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify({...originalConfig,version:4,enabled:true,eligibleRoles:['League Chair','Administrator','Manager','Player'],enabledTypes:policy.notificationTypes})]);
 async function person(label,active=true){const id=(await client.query("insert into public.person(first_name,last_name) values('Draw test',$1) returning id",[label])).rows[0].id;await client.query("insert into public.user_account(person_id,username,active) values($1::uuid,$1::uuid::text,$2)",[id,active]);return id;}
 async function member(id,team,role){await client.query('insert into public.team_membership(person_id,team_id,role) values($1,$2,$3)',[id,team.id,role]);}
 const manager=await person('Manager'),player=await person('Player'),legacy=await person('Legacy manager'),outsider=await person('Other team'),optout=await person('Opted out'),inactive=await person('Inactive account',false),chair=await person('Chair'),admin=await person('Admin');
 await member(manager,teams[0],'Manager');await member(player,teams[1],'Player');await member(outsider,allTeams[3],'Manager');await member(optout,teams[0],'Player');await member(inactive,teams[0],'Manager');
 const cm=(await client.query("insert into public.club_membership(person_id,club_id,role) values($1,$2,'Club Member') returning id",[legacy,teams[0].club_id])).rows[0].id;
 await client.query("insert into public.person_team_role(club_membership_id,person_id,club_id,league_id,team_name,role) values($1,$2,$3,$4,$5,'Manager')",[cm,legacy,teams[0].club_id,teams[0].league_id,teams[0].name]);
 for(const id of [manager,chair])await client.query("insert into public.club_membership(person_id,club_id,role) values($1,$2,'League Chair')",[id,teams[0].club_id]);
 for(const id of [manager,admin])await client.query('insert into public.app_operator(person_id) values($1)',[id]);
 await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb)',[optout,JSON.stringify({version:4,inboxTypes:[],pushTypes:[],pushEnabled:false})]);
 await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb)',[manager,JSON.stringify({...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['cup_draw']})]);
 await client.query("insert into public.notification_push_subscription(person_id,endpoint,p256dh,auth) values($1::uuid,'https://fcm.googleapis.com/fcm/send/cup-draw-test-'||$1::uuid::text,'test','test')",[manager]);
 const managers=(await client.query(cupNotifications.cupDrawAudienceSql,[cup,['managers']])).rows.map(r=>r.personId);
 assert.ok(managers.includes(manager));assert.ok(managers.includes(legacy));for(const id of [outsider,inactive,player,chair,admin])assert.ok(!managers.includes(id));
 await assert.rejects(cupNotifications.notifyCupDrawConfirmed(client,cup,'00000000-0000-4000-8000-000000000000'),/confirmed/);
 let a=await workflow.changeCupDraw(client,cup,actor,{action:'draw'});
 assert.equal(await fixtureCount(),0);
 const oldSnapshot=structuredClone(a.snapshot);
 a=await workflow.changeCupDraw(client,cup,actor,{action:'redraw',attemptId:a.id,reason:'Witness requested a restart'});
 assert.equal(a.attempt_number,2);assert.equal(await fixtureCount(),0);
 const prior=(await client.query('select * from public.cup_draw_attempt where competition_id=$1 and attempt_number=1',[cup])).rows[0];
 assert.equal(prior.status,'Superseded');assert.deepEqual(prior.snapshot,oldSnapshot);
 await assert.rejects(workflow.changeCupDraw(client,cup,actor,{action:'confirm',attemptId:prior.id,witnessName:'Witness'}),/changed/);
 for(let n=1;n<=2;n++)await workflow.changeCupDraw(client,cup,actor,{action:'reveal',attemptId:a.id,revealedCount:n});
 await workflow.changeCupDraw(client,cup,actor,{action:'reveal',attemptId:a.id,revealedCount:1}); // retry cannot hide already revealed matches
 assert.equal((await client.query('select revealed_count from public.cup_draw_attempt where id=$1',[a.id])).rows[0].revealed_count,2);
 assert.equal(await fixtureCount(),0);
 await client.query('savepoint failed_confirmation');
 const missingActor=(await client.query('select gen_random_uuid() as id')).rows[0].id;
 await assert.rejects(workflow.changeCupDraw(client,cup,missingActor,{action:'confirm',attemptId:a.id,witnessName:'Test Witness'}),/foreign key/);
 await client.query('rollback to savepoint failed_confirmation');
 assert.equal(await fixtureCount(),0);
 assert.equal((await client.query('select status from public.cup_draw_attempt where id=$1',[a.id])).rows[0].status,'Provisional');
 const outcome=await workflow.changeCupDraw(client,cup,actor,{action:'confirm',attemptId:a.id,witnessName:'Test Witness',notificationAudience:['chairs','admins','managers','players']});
 assert.ok(outcome.notificationSummary.notified>=5);
 const ties=(await client.query('select t.*,r.round_number from public.cup_competition_tie t join public.cup_competition_round r on r.id=t.competition_round_id where r.competition_id=$1 order by r.round_number,t.match_number',[cup])).rows;
 assert.equal(ties.length,3);
 for(const tie of ties.filter(t=>t.round_number===1)){const expected=a.snapshot.bracket.find(t=>t.roundNumber===1&&t.matchNumber===tie.match_number);assert.equal(tie.home_team_id,expected.homeTeamId);assert.equal(tie.away_team_id,expected.awayTeamId);assert.equal(Boolean(tie.fixture_id),expected.status!=='Bye');}
 const confirmed=(await client.query('select * from public.cup_draw_attempt where id=$1',[a.id])).rows[0];assert.equal(confirmed.witness_name,'Test Witness');assert.equal(confirmed.status,'Confirmed');
 await assert.rejects(workflow.changeCupDraw(client,cup,actor,{action:'redraw',attemptId:a.id,reason:'Forbidden'}),/confirmed/);
 const eventKey=`cup-draw:${cup}:${a.id}`;
 const notices=(await client.query('select * from public.app_notification where event_key=$1',[eventKey])).rows;
 for(const id of [manager,player,legacy,chair,admin])assert.equal(notices.filter(n=>n.person_id===id).length,1);
 for(const id of [outsider,inactive,optout])assert.equal(notices.filter(n=>n.person_id===id).length,0);
 const managerNotice=notices.find(n=>n.person_id===manager);assert.ok(managerNotice.body.includes('draw is confirmed'));assert.ok(managerNotice.body.includes('(bye)'));
 assert.equal(await notificationCore.notificationSourceIsCurrent(managerNotice.id,manager,client),true);
 const deliveries=(await client.query('select d.* from public.notification_push_delivery d join public.app_notification n on n.id=d.notification_id where n.event_key=$1 and n.person_id=$2',[eventKey,manager])).rows;assert.equal(deliveries.length,1);
 await cupNotifications.notifyCupDrawConfirmed(client,cup,a.id);
 assert.equal((await client.query('select count(*)::int as n from public.app_notification where event_key=$1',[eventKey])).rows[0].n,notices.length);
 assert.equal((await client.query('select count(*)::int as n from public.notification_push_delivery d join public.app_notification n on n.id=d.notification_id where n.event_key=$1 and n.person_id=$2',[eventKey,manager])).rows[0].n,1);
 assert.deepEqual(confirmed.notification_audience,['chairs','admins','managers','players']);assert.equal(confirmed.notification_summary.notified,notices.length);
 const privileges=(await client.query("select has_table_privilege('anon','public.cup_draw_attempt','select') as anon_read,has_table_privilege('authenticated','public.cup_draw_attempt','select') as auth_read")).rows[0];
 assert.equal(privileges.anon_read,false);assert.equal(privileges.auth_read,false);
 console.log('Verified provisional draw, redraw history, byes, reveal retries, saved-pairing confirmation, fixture publication, failed-confirmation rollback, private history access, optional scoped audiences, inactive accounts, opt-outs, deduplication, durable push queue and confirmed lock. All changes rolled back.');
}finally{await client.query('rollback');client.release();await pool.end();}
