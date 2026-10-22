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
 for(const table of ['app_viewer','app_video','match_livestream']){
  const row=(await client.query(`select relrowsecurity,has_table_privilege('anon',$1,'select,insert,update,delete') as anon,has_table_privilege('authenticated',$1,'select,insert,update,delete') as authenticated from pg_class where oid=$1::regclass`,[`public.${table}`])).rows[0];
  assert.equal(row.relrowsecurity,true);assert.equal(row.anon,false);assert.equal(row.authenticated,false);
 }
 async function person(name){const row=(await client.query("insert into public.person(first_name,last_name) values('Livestream verification',$1) returning id",[name])).rows[0];await client.query('insert into public.user_account(person_id,username,active) values($1,$2,true)',[row.id,`livestream-${randomUUID()}`]);return {personId:row.id,name,username:name};}
 const admin=await person('Admin'),broadcaster=await person('Video'),publisher=await person('Publisher'),viewer=await person('Viewer'),other=await person('Other'),outsider=await person('Outsider');
 await client.query('insert into public.app_operator(person_id) values($1)',[admin.personId]);
 await client.query('insert into public.app_publisher(person_id) values($1)',[publisher.personId]);
 const auth=load('lib/server/auth');auth.currentUser=async()=>current;
 const people=load('app/api/admin/people/route');
 async function assign(user,active){current=user;return people.PATCH(new Request('https://app.test/api/admin/people',{method:'PATCH',body:JSON.stringify({action:'details',personId:viewer.personId,firstName:'Livestream verification',lastName:'Viewer',email:'',phone:'',handicap:'',roles:[],viewing:active})}));}
 async function assignVideo(user,target,active){current=user;return people.PATCH(new Request('https://app.test/api/admin/people',{method:'PATCH',body:JSON.stringify({action:'details',personId:target.personId,firstName:'Livestream verification',lastName:target.name,email:'',phone:'',handicap:'',roles:[],video:active})}));}
 for(const p of [broadcaster,other]){const response=await assignVideo(admin,p,true);assert.equal(response.status,200,await response.text());assert.equal((await client.query('select active from public.app_video where person_id=$1',[p.personId])).rows[0]?.active,true,'admin Video assignment must persist');}
 assert.equal((await assignVideo(publisher,outsider,true)).status,400);
 assert.equal((await client.query('select 1 from public.app_video where person_id=$1',[outsider.personId])).rowCount,0);
 const videoSession=await auth.loadSessionPayload(broadcaster);assert.equal(videoSession.contexts[0].role,'Video');assert.equal(videoSession.contexts[0].hasVideoAccess,true);assert.equal(videoSession.contexts[0].hasPublisherAccess,false);assert.equal(videoSession.contexts[0].hasViewingAccess,false);
 const publisherSession=await auth.loadSessionPayload(publisher);assert.equal(publisherSession.contexts[0].role,'Publisher');assert.equal(publisherSession.contexts[0].hasVideoAccess,false);assert.equal(publisherSession.contexts[0].hasPublisherAccess,true);
 const messagePermissions=load('lib/server/publisher');assert.equal(await messagePermissions.isPublisher(broadcaster.personId),false);assert.equal(await messagePermissions.isPublisher(publisher.personId),true);
 const granted=await assign(admin,true);assert.equal(granted.status,200,await granted.text());
 assert.equal((await client.query('select active from public.app_viewer where person_id=$1',[viewer.personId])).rows[0]?.active,true,'admin assignment must persist');
 assert.equal((await assign(publisher,false)).status,400);
 assert.equal((await auth.loadSessionPayload(viewer)).contexts[0].role,'Viewer');
 assert.equal((await auth.loadSessionPayload(viewer)).contexts[0].hasViewingAccess,true);
 const service=load('lib/server/livestreams');
 await assert.rejects(service.listLiveStreams(outsider.personId),e=>e.status===403);
 await assert.rejects(service.listVideoFixtures(viewer.personId),e=>e.status===403);
 const template=(await client.query('select f.* from public.fixture f join public.season s on s.id=f.season_id where s.active limit 1')).rows[0];assert.ok(template,'An active season fixture is required');
 const fixture=(await client.query("insert into public.fixture(season_id,league_id,fixture_date,home_team_id,away_team_id,status) values($1,$2,now(),$3,$4,'Scheduled') returning id",[template.season_id,template.league_id,template.home_team_id,template.away_team_id])).rows[0];
 const draft={fixtureId:fixture.id,youtubeUrl:'https://youtu.be/M7lc1UVf-VE'};
 await assert.rejects(service.makeFixtureLive(viewer.personId,draft),e=>e.status===403);
 await assert.rejects(service.makeFixtureLive(publisher.personId,draft),e=>e.status===403);
 await assert.rejects(service.listVideoFixtures(publisher.personId),e=>e.status===403);
 await assert.rejects(service.listLiveStreams(publisher.personId),e=>e.status===403);
 const combinedGrant=await assignVideo(admin,publisher,true);assert.equal(combinedGrant.status,200,await combinedGrant.text());
 const combinedSession=await auth.loadSessionPayload(publisher);assert.equal(combinedSession.contexts[0].hasVideoAccess,true);assert.equal(combinedSession.contexts[0].hasPublisherAccess,true);
 await service.listVideoFixtures(publisher.personId);const combinedRevoke=await assignVideo(admin,publisher,false);assert.equal(combinedRevoke.status,200,await combinedRevoke.text());assert.equal(await messagePermissions.isPublisher(publisher.personId),true);
 await assert.rejects(service.listVideoFixtures(publisher.personId),e=>e.status===403);
 const sent=await service.makeFixtureLive(broadcaster.personId,draft);assert.ok(sent.id);
 assert.equal((await service.makeFixtureLive(broadcaster.personId,draft)).duplicate,true);
 await assert.rejects(service.makeFixtureLive(other.personId,draft),e=>e.status===409);
 const live=(await service.listLiveStreams(viewer.personId)).streams.find(s=>s.streamId===sent.id);assert.ok(live);assert.equal(live.videoId,'M7lc1UVf-VE');assert.equal(live.canEnd,false);
 assert.equal((await service.listLiveStreams(other.personId)).streams.some(s=>s.streamId===sent.id),false);
 assert.equal((await service.listLiveStreams(broadcaster.personId)).streams.find(s=>s.streamId===sent.id).canEnd,true);
 const options=await service.listVideoFixtures(broadcaster.personId,'', '1');assert.ok(options.items.some(f=>f.id===fixture.id));assert.ok(options.items.length<=10);
 await assert.rejects(service.endLiveStream(other.personId,sent.id),e=>e.status===404);
 await client.query("update public.fixture set status='Cancelled' where id=$1",[fixture.id]);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===sent.id),false);
 await client.query("update public.fixture set status='Scheduled' where id=$1",[fixture.id]);
 await service.endLiveStream(broadcaster.personId,sent.id);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===sent.id),false);
 const second=await service.makeFixtureLive(broadcaster.personId,draft);assert.notEqual(second.id,sent.id);
 await client.query("update public.match_livestream set started_at=now()-interval '14 hours',expires_at=now()-interval '2 hours' where id=$1",[second.id]);assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===second.id),false);
 const third=await service.makeFixtureLive(broadcaster.personId,draft);assert.notEqual(third.id,second.id);
 const revoked=await assignVideo(admin,broadcaster,false);assert.equal(revoked.status,200,await revoked.text());assert.equal((await service.listLiveStreams(viewer.personId)).streams.some(s=>s.streamId===third.id),false);
 await assert.rejects(service.makeFixtureLive(broadcaster.personId,draft),e=>e.status===403);
 await assign(admin,false);await assert.rejects(service.listLiveStreams(viewer.personId),e=>e.status===403);
 await client.query('update public.app_viewer set active=true where person_id=$1',[viewer.personId]);await client.query('update public.user_account set active=false where person_id=$1',[viewer.personId]);await assert.rejects(service.listLiveStreams(viewer.personId),e=>e.status===403);
 await client.query('delete from public.fixture where id=$1',[fixture.id]);assert.equal((await client.query('select 1 from public.match_livestream where fixture_id=$1',[fixture.id])).rowCount,0);
 console.log('Verified RLS/revokes, admin-only Video/Viewing assignment, standalone Video/Viewer sessions, Publisher/Video separation, server permissions, real match search, safe YouTube IDs, duplicate/conflict handling, owner-only ending, cancelled/expired listings, revoked Video/Viewing access, inactive login denial and fixture cascade. All synthetic data rolled back; no broadcast or notification sent.');
}finally{await client.query('rollback');client.release();await pool.end();}
