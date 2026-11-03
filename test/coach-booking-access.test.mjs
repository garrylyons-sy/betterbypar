import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
import * as dates from '../lib/lesson-diary.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??(name==='@/lib/server/lesson-group-access'?load('lib/server/lesson-group-access.ts',deps):name==='@/lib/server/lesson-location'?load('lib/server/lesson-location.ts',{}):name==='@/lib/server/coaching-statistics'?load('lib/server/coaching-statistics.ts',{}):require(name)),exports);return exports;}
test('professionals may book their club assistants but cannot change their hours or book another professional',async()=>{
 const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});
 try{
  await initializeLocalDemo(db);
  const people=Object.fromEntries((await db.query('select email,id from person')).rows.map(p=>[p.email,p.id]));
  const pro=people['professional@example.test'],assistant=people['assistant@example.test'],member=people['member@example.test'];
  const club=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
  const client={query:async(...args)=>{const r=await db.query(...args);return {...r,rowCount:r.rows.length};}};
  class AccessError extends Error{}
  const guards={AccessError,requireLessonsManager:(a,c)=>{if(!a.assignments.some(r=>r.clubId===c))throw new AccessError('Club access required');},golfAudit:async()=>{}};
  const diary=load('lib/server/lesson-diary.ts',{'@/lib/server/db':{},'@/lib/server/golf-access':guards,'@/lib/lesson-diary.mjs':dates});
  const access=(id,role)=>({user:{personId:id},platform:false,adminClubIds:[],assignments:[{clubId:club,role}]});
  const a=access(pro,'Golf Professional');
  await diary.requireCoachBookingAccess(client,a,club,assistant);
  const api=load('app/api/admin/lesson-availability/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'@/lib/server/db':{dbQuery:client.query,withTransaction:fn=>fn(client)},'@/lib/server/golf-access':{...guards,golfAccess:async()=>a,golfError:e=>({error:e.message,status:403})},'@/lib/server/lesson-diary':{...diary,materializeLessons:async()=>{}},'@/lib/lesson-diary.mjs':dates});
  const own=await api.GET(new Request(`http://localhost/api/admin/lesson-availability?clubId=${club}`));
  assert.equal(own.status,200,own.body.error);assert.ok(own.body.professionals.some(p=>p.id===assistant));assert.equal(own.body.canEditDiary,true);
  const assistantView=await api.GET(new Request(`http://localhost/api/admin/lesson-availability?clubId=${club}&professionalId=${assistant}`));
  assert.equal(assistantView.status,200,assistantView.body.error);assert.equal(assistantView.body.canEditDiary,false);assert.equal(assistantView.body.canBookForMember,true);
  const hours=await api.POST(new Request('http://localhost/api/admin/lesson-availability',{method:'POST',body:JSON.stringify({clubId:club,professionalId:assistant,mode:'week',week:dates.weekStart(),ranges:[]})}));assert.equal(hours.status,403);

  assert.throws(()=>diary.requireDiaryOwner(a,club,assistant),/own lesson diary/);
  await assert.rejects(()=>diary.requireCoachBookingAccess(client,access(assistant,'Assistant Professional'),club,pro));
  await assert.rejects(()=>diary.requireCoachBookingAccess(client,a,'00000000-0000-0000-0000-000000000001',assistant));
  await db.query("update club_membership set role='Golf Professional' where person_id=$1 and club_id=$2 and role='Assistant Professional'",[assistant,club]);
  await assert.rejects(()=>diary.requireCoachBookingAccess(client,a,club,assistant));
  await db.query("update club_membership set role='Assistant Professional' where person_id=$1 and club_id=$2 and role='Golf Professional'",[assistant,club]);
  const booking=load('lib/server/lesson-booking.ts',{'@/lib/server/golf-access':guards,'@/lib/server/lesson-diary':{...diary,queueLessonReminder:async()=>{}},'@/lib/server/lesson-notifications':{notifyLessonEvent:async()=>1}});
  const day=dates.addDays(dates.weekStart(),8),start=day+'T15:00Z',end=day+'T15:30Z';
  const slot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Assistant booking',$3,$4,$5) returning id",[club,assistant,start,end,pro])).rows[0].id;
  const result=await booking.bookLessonForMember(client,a,slot,member,'Putting',1440);
  const saved=(await db.query('select booked_by,player_person_id from lesson_booking where id=$1',[result.booking.id])).rows[0];
  assert.equal(saved.booked_by,pro);assert.equal(saved.player_person_id,member);
  await db.query("update club_membership set role='Golf Professional' where person_id=$1 and club_id=$2 and role='Assistant Professional'",[assistant,club]);
  await db.query("update club_membership set active=false where person_id=$1 and club_id=$2 and role='Golf Professional'",[pro,club]);
  await assert.rejects(()=>diary.requireCoachBookingAccess(client,a,club,assistant));
 }finally{await db.close();}
});
