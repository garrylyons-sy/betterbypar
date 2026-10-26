import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
function load(path,deps){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>deps[id],URL,Date,process:{env:{}}});return exports;}
test('club booking privacy defaults off and releases names only when that club enables it',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const club=(await db.query("select id,show_lesson_attendee_names from club where name='Castle Golf Club'")).rows[0];assert.equal(club.show_lesson_attendee_names,false);
  const member=(await db.query("select id from person where email='member@example.test'")).rows[0].id;
  const pro=(await db.query("select id from person where email='professional@example.test'")).rows[0].id;
  const slot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Privacy test','2031-06-02T09:00Z','2031-06-02T09:30Z',$2) returning id",[club.id,pro])).rows[0].id;
  await db.query("insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at,goals) select id,$2,$2,starts_at,ends_at,'PRIVATE GOAL' from lesson_slot where id=$1",[slot,member]);
  const group=(await db.query("select id from lesson_group where club_id=$1 and mode='Open' limit 1",[club.id])).rows[0].id;
  const groupSlot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by,group_id,capacity) values($1,$2,'Group privacy test','2031-06-02T10:00Z','2031-06-02T11:00Z',$2,$3,8) returning id",[club.id,pro,group])).rows[0].id;
  const junior=(await db.query("select id from person where first_name='Casey' and last_name='Parker'")).rows[0].id;
  await db.query("insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$3,starts_at,ends_at from lesson_slot where id=$1",[groupSlot,junior,pro]);
  const api=load('app/api/lessons/route.ts',{'next/server':{NextResponse:{json:(body)=>body}},'@/lib/server/db':{dbQuery:(...a)=>db.query(...a)},'@/lib/server/golf-access':{golfAccess:async()=>({user:{personId:pro},assignments:[{clubId:club.id,role:'Golf Professional'}],adminClubIds:[],platform:false}),golfError:e=>({error:e.message,status:400})},'@/lib/server/lesson-diary':{materializeLessons:async()=>{}},'@/lib/lesson-diary.mjs':{}});
  const get=async()=>{const result=await api.GET(new Request('http://localhost/api/lessons'));assert.ok(result.slots,result.error);return result.slots.find(s=>s.id===slot);};
  assert.deepEqual(Array.from((await get()).attendee_names),[]);
  assert.deepEqual(Array.from((await api.GET(new Request('http://localhost/api/lessons'))).slots.find(s=>s.id===groupSlot).attendee_names),[]);
  await db.query('update club set show_lesson_attendee_names=true where id=$1',[club.id]);
  const visible=await get();assert.deepEqual(Array.from(visible.attendee_names),['Morgan Kelly']);assert.equal(visible.booked,true);assert.equal(Object.hasOwn(visible,'goals'),false);assert.equal(Object.hasOwn(visible,'player_person_id'),false);
  assert.deepEqual(Array.from((await api.GET(new Request('http://localhost/api/lessons'))).slots.find(s=>s.id===groupSlot).attendee_names),['Casey Parker']);
  await db.query('update club set show_lesson_attendee_names=false where id=$1',[club.id]);assert.deepEqual(Array.from((await get()).attendee_names),[]);
 }finally{await db.close();}
});

test('only a club administrator or platform operator may configure lesson privacy',async()=>{
 let allowed=false,writes=0;
 const api=load('app/api/admin/lesson-settings/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},
  '@/lib/server/db':{dbQuery:async()=>({rows:[{id:'club',show_lesson_attendee_names:false}]}),withTransaction:async fn=>fn({query:async(sql,args)=>{writes++;return {rows:[{id:args[0],show_lesson_attendee_names:args[1]}]};}})},
  '@/lib/server/golf-access':{golfAccess:async()=>({user:{personId:'actor'}}),requireClubAdmin:(_a,id)=>{if(!allowed||id!=='club')throw Object.assign(new Error('Forbidden'),{status:403});},golfError:e=>({error:e.message,status:e.status??400}),golfAudit:async()=>{}}
 });
 const patch=(clubId,value)=>api.PATCH(new Request('http://localhost/api/admin/lesson-settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({clubId,showAttendeeNames:value})}));
 assert.equal((await patch('club',true)).status,403);assert.equal(writes,0);
 allowed=true;assert.equal((await patch('other',true)).status,403);assert.equal((await patch('club','false')).status,400);assert.equal(writes,0);
 assert.equal((await patch('club',true)).body.settings.show_lesson_attendee_names,true);assert.equal(writes,1);
});
