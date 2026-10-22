// All synthetic assignments, fixtures and listings roll back; no broadcast or push.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import ts from 'typescript';
import * as livePolicy from '../lib/livestream-policy.mjs';
const require=createRequire(import.meta.url);
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();let current=null;
const cache=new Map(),db={dbQuery:(sql,args)=>client.query(sql,args),withTransaction:async fn=>{await client.query('savepoint live_test');try{const result=await fn(client);await client.query('release savepoint live_test');return result;}catch(error){await client.query('rollback to savepoint live_test');throw error;}}};
function load(name){
 if(name==='lib/server/db')return db;if(name==='lib/livestream-policy.mjs')return livePolicy;if(cache.has(name))return cache.get(name);
 if(name.endsWith('.mjs'))return require('../'+name);
 const exports={};cache.set(name,exports);
 const code=ts.transpileModule(fs.readFileSync(`${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(dep=>dep==='next/headers'?{cookies:()=>{throw Error('No browser session');}}:dep.startsWith('@/')?load(dep.slice(2)):require(dep),exports);return exports;
}
try{
 await client.query('begin');
 for(const table of ['app_viewer','match_livestream']){
  const row=(await client.query(`select relrowsecurity,has_table_privilege('anon',$1,'select,insert,update,delete') as anon,has_table_privilege('authenticated',$1,'select,insert,update,delete') as authenticated from pg_class where oid=$1::regclass`,[`public.${table}`])).rows[0];
  assert.equal(row.relrowsecurity,true);assert.equal(row.anon,false);assert.equal(row.authenticated,false);
 }
 async function person(name){const row=(await client.query("insert into public.person(first_name,last_name) values('Livestream verification',$1) returning id",[name])).rows[0];await client.query('insert into public.user_account(person_id,username,active) values($1,$2,true)',[row.id,`livestream-${randomUUID()}`]);return {personId:row.id,name,username:name};}
 const admin=await person('Admin'),publisher=await person('Publisher'),viewer=await person('Viewer'),other=await person('Other'),outsider=await person('Outsider');
 await client.query('insert into public.app_operator(person_id) values($1)',[admin.personId]);
 for(const p of [publisher,other])await client.query('insert into public.app_publisher(person_id) values($1)',[p.personId]);
 const auth=load('lib/server/auth');auth.currentUser=async()=>current;
 const people=load('app/api/admin/people/route');
 async function assign(user,active){current=user;return people.PATCH(new Request('https://app.test/api/admin/people',{method:'PATCH',body:JSON.stringify({action:'details',personId:viewer.personId,firstName:'Livestream verification',lastName:'Viewer',email:'',phone:'',handicap:'',roles:[],viewing:active})}));}
 const granted=await assign(admin,true);assert.equal(granted.status,200,await granted.text());
 assert.equal((await client.query('select active from public.app_viewer where person_id=$1',[viewer.personId])).rows[0]?.active,true,'admin assignment must persist');
 assert.equal((await assign(publisher,false)).status,400);
 assert.equal((await auth.loadSessionPayload(viewer)).contexts[0].role,'Viewer');
 assert.equal((await auth.loadSessionPayload(viewer)).contexts[0].hasViewingAccess,true);
 const service=load('lib/server/livestreams');
 await assert.rejects(service.listLiveStreams(outsider.personId),e=>e.status===403);
 await assert.rejects(service.listPublisherFixtures(viewer.personId),e=>e.status===403);
 const template=(await client.query('select f.* from public.fixture f join public.season s on s.id=f.season_id where s.active limit 1')).rows[0];assert.ok(template,'An active season fixture is required');
 const fixture=(await client.query("insert into public.fixture(season_id,league_id,fixture_date,home_team_id,away_team_id,status) values($1,$2,now(),$3,$4,'Scheduled') returning id",[template.season_id,template.league_id,template.home_team_id,template.away_team_id])).rows[0];
 const draft={fixtureId:fixture.id,youtubeUrl:'https://youtu.be/M7lc1UVf-VE'};
 await assert.rejects(service.makeFixtureLive(viewer.personId,draft),e=>e.status===403);
 const sent=await service.makeFixtureLive(publisher.personId,draft);assert.ok(sent.id);
 assert.equal((await service.makeFixtureLive(publisher.personId,draft)).duplicate,true);
 await assert.rejects(service.makeFixtureLive(other.personId,draft),e=>e.status===409);
 const live=(await service.listLiveStreams(viewer.personId)).streams.find(s=>s.streamId===sent.id);assert.ok(live);assert.equal(live.videoId,'M7lc1UVf-VE');assert.equal(live.canEnd,false);
 assert.equal((await service.listLiveStreams(other.personId)).streams.some(s=>s.streamId===sent.id),false);
 assert.equal((await service.listLiveStreams(publisher.personId)).streams.find(s=>s.streamId===sent.id).canEnd,true);
 const options=await service.listPublisherFixtures(publisher.personId,'', '1');assert.ok(options.items.some(f=>f.id===fixture.id));assert.ok(options.items.length<=25);
 await assert.rejects(service.endLiveStream(other.personId,sent.id),e=>e.status===404);
 await client.query("update public.fixture set status='Cancelled' where id=$1",[fixture.id]);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===sent.id),false);
 await client.query("update public.fixture set status='Scheduled' where id=$1",[fixture.id]);
 await service.endLiveStream(publisher.personId,sent.id);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===sent.id),false);
 const second=await service.makeFixtureLive(publisher.personId,draft);assert.notEqual(second.id,sent.id);
 await client.query("update public.match_livestream set started_at=now()-interval '14 hours',expires_at=now()-interval '2 hours' where id=$1",[second.id]);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===second.id),false);
 const third=await service.makeFixtureLive(publisher.personId,draft);assert.notEqual(third.id,second.id);
 await client.query('update public.app_publisher set active=false where person_id=$1',[publisher.personId]);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===third.id),false);
 await assert.rejects(service.makeFixtureLive(publisher.personId,draft),e=>e.status===403);
 await assign(admin,false);await assert.rejects(service.listLiveStreams(viewer.personId),e=>e.status===403);
 await client.query('update public.app_viewer set active=true where person_id=$1',[viewer.personId]);await client.query('update public.user_account set active=false where person_id=$1',[viewer.personId]);await assert.rejects(service.listLiveStreams(viewer.personId),e=>e.status===403);
 await client.query('delete from public.fixture where id=$1',[fixture.id]);assert.equal((await client.query('select 1 from public.match_livestream where fixture_id=$1',[fixture.id])).rowCount,0);
 console.log('Verified RLS/revokes, admin-only Viewing assignment, standalone Viewer session, server permissions, real match search, safe YouTube IDs, duplicate/conflict handling, owner-only ending, cancelled/expired listings, revoked publishers/viewers, inactive login denial and fixture cascade. All synthetic data rolled back; no broadcast or notification sent.');
}finally{await client.query('rollback');client.release();await pool.end();}
