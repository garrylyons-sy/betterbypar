import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path,deps){const api={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in deps?deps[name]:require(name),api);return api;}
const provider=load('lib/server/golf-ireland.ts',{'@/lib/server/golf-ireland-isv':{getLiveGolfSummary:async()=>{throw new Error('Live provider unavailable');}}});
const request={clubId:'club',clubName:'Castle Golf Club',playerId:'player',playerName:'Morgan Kelly',golfIrelandNumber:'9990000001'};
test('demo golf data is explicitly labelled, deterministic per player and never changes stored handicap',()=>{
 const now=new Date('2031-06-02T12:00Z');const a=provider.demoGolfSummary(request,now),b=provider.demoGolfSummary(request,now);
 assert.deepEqual(a,b);assert.equal(a.mode,'demo');assert.equal(a.handicapIndex,12.4);assert.match(a.notice,/not been retrieved/);assert.equal(a.recentRounds.length,3);
 assert.ok(a.recentRounds.every(r=>Date.parse(r.date)<now.getTime()));assert.ok(a.recentRounds[0].date>a.recentRounds[1].date);
 assert.notEqual(provider.demoGolfSummary({...request,golfIrelandNumber:'9990000005'},now).handicapIndex,a.handicapIndex);
});
test('live never falls back to fake data; production defaults off and local demo cannot use inherited live credentials',async()=>{
 assert.equal(provider.golfIrelandDataMode({NODE_ENV:'production'}),'off');assert.equal(provider.golfIrelandDataMode({NODE_ENV:'development'}),'demo');
 assert.equal(provider.golfIrelandDataMode({LOCAL_DEMO:'1',GOLF_IRELAND_DATA_MODE:'live'}),'demo');
 const off=await provider.getGolfSummary(request,{env:{NODE_ENV:'production'}});assert.equal(off.mode,'unavailable');assert.equal(off.handicapIndex,null);assert.equal(off.recentRounds.length,0);
 await assert.rejects(provider.getGolfSummary(request,{env:{GOLF_IRELAND_DATA_MODE:'live'}}),/unavailable/);
});
test('golf summary access is limited to registered self/active dependants in an active shared club; staff are never players',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const people=Object.fromEntries((await db.query('select email,id from person')).rows.map(p=>[p.email,p.id]));
  const junior=(await db.query("select id from person where first_name='Casey' and last_name='Parker'")).rows[0].id;
  let actor=people['member@example.test'],providerFails=false;
  class AccessError extends Error{constructor(message,status=403){super(message);this.status=status;}}
  const route=load('app/api/golf-summary/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200,headers:options?.headers})}},'@/lib/server/db':{dbQuery:(...args)=>db.query(...args)},'@/lib/server/golf-access':{golfAccess:async()=>{if(!actor)throw new AccessError('Sign in',401);return {user:{personId:actor},platform:true};},AccessError,golfError:error=>({error:error.message,status:error.status??400})},'@/lib/server/golf-ireland':{getGolfSummary:r=>{if(providerFails)throw new Error('Upstream unavailable');return provider.demoGolfSummary(r);}}});
  const get=(playerId,club='Castle Golf Club')=>route.GET(new Request(`http://localhost/api/golf-summary?club=${encodeURIComponent(club)}${playerId?'&playerId='+playerId:''}`));
  const own=await get();assert.equal(own.status,200);assert.equal(own.body.summary.player.id,actor);assert.equal(own.headers['Cache-Control'],'no-store');
  assert.equal((await get(junior)).status,403);
  actor=people['parent@example.test'];const child=await get(junior);assert.equal(child.status,200);assert.equal(child.body.summary.player.golfIrelandNumber,'9990000005');
  providerFails=true;const unavailable=await get();assert.equal(unavailable.status,503);assert.ok(unavailable.body.players.some(p=>p.id===junior));assert.equal(unavailable.body.summary,null);providerFails=false;assert.equal((await get(junior)).status,200);
  assert.equal((await get(people['member@example.test'])).status,403);assert.equal((await get(junior,'Woodland Golf Club')).status,403);
  await db.query('update dependants set active=false where guardian_person_id=$1',[actor]);assert.equal((await get(junior)).status,403);
  for(const email of ['professional@example.test','assistant@example.test']){actor=people[email];const staff=await get();assert.equal(staff.status,200);assert.equal(staff.body.summary,null);assert.equal(staff.body.players.length,0);}
  actor=null;assert.equal((await get()).status,401);
 }finally{await db.close();}
});
