import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),ts=require('typescript');
const ids=Array.from({length:7},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [club,player,guardian,coach,inactive,booking,slot]=ids;
async function setup(){
 const db=await PGlite.create(),events=[],seen=new Set();
 await db.exec(`create table club(id uuid primary key,active boolean);
 create table person(id uuid primary key,first_name text,last_name text,active boolean,registered boolean);
 create table club_membership(person_id uuid,club_id uuid,role text,active boolean);
 create table user_account(person_id uuid,active boolean);
 create table dependants(id int,guardian_person_id uuid,dependant_person_id uuid,club_id uuid,active boolean);
 create table lesson_group(id uuid,name text);
 create table lesson_slot(id uuid,club_id uuid,professional_person_id uuid,group_id uuid,title text,starts_at timestamptz,ends_at timestamptz);
 create table lesson_booking(id uuid,slot_id uuid,player_person_id uuid,status text,feedback text,drills text);
 create function is_golf_player(pid uuid,cid uuid) returns boolean language sql as $$select exists(select 1 from person p join club_membership cm on cm.person_id=p.id where p.id=pid and p.active and p.registered and cm.club_id=cid and cm.active)$$;`);
 await db.query('insert into club values($1,true)',[club]);
 for(const [id,name,active,registered] of [[player,'Player',true,true],[guardian,'Guardian',true,false],[coach,'Coach',true,false],[inactive,'Inactive',false,false]]){
  await db.query("insert into person values($1,$2,'Example',$3,$4)",[id,name,active,registered]);
  await db.query('insert into club_membership values($1,$2,$3,true)',[id,club,id===coach?'Golf Professional':'Club Member']);
  await db.query('insert into user_account values($1,true)',[id]);
 }
 await db.query('insert into dependants values(1,$1,$2,$3,true),(2,$4,$2,$3,true)',[guardian,player,club,inactive]);
 await db.query("insert into lesson_slot values($1,$2,$3,null,'Junior lesson','2031-06-02T09:00Z','2031-06-02T09:30Z')",[slot,club,coach]);
 await db.query("insert into lesson_booking values($1,$2,$3,'Booked','','')",[booking,slot,player]);
 const api={},source=ts.transpileModule(readFileSync(new URL('../lib/server/lesson-notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(name=>name==='@/lib/server/notifications'?{createNotification:async(_client,personId,event)=>{const key=`${personId}:${event.eventKey}`;if(seen.has(key))return false;seen.add(key);events.push({personId,...event});return true;}}:require(name),api);
 return {db,events,notify:(kind,actor)=>api.notifyLessonEvent(db,booking,kind,actor)};
}
test('self booking confirms player and active guardian, informs coach, and deduplicates retries',async()=>{
 const s=await setup();try{
  assert.equal(await s.notify('lesson_booking',player),3);
  assert.deepEqual(new Set(s.events.map(e=>e.personId)),new Set([player,guardian,coach]));
  assert.equal(s.events.find(e=>e.personId===coach).href,'/lessons/manage');
  assert.equal(s.events.find(e=>e.personId===player).href,`/lessons?booking=${booking}#booking-${booking}`);
  assert.match(s.events[0].body,/Junior lesson.*Player Example.*Coach Example/);
  assert.equal(await s.notify('lesson_booking',player),0);
 }finally{await s.db.close();}
});
test('professional booking excludes acting coach and revoked guardian grants',async()=>{
 const s=await setup();try{
  await s.db.query('update dependants set active=false where guardian_person_id=$1',[guardian]);
  assert.equal(await s.notify('lesson_booking',coach),1);assert.equal(s.events[0].personId,player);
 }finally{await s.db.close();}
});
test('cancelled lessons notify members and coach with durable lifetime',async()=>{
 const s=await setup();try{
  assert.equal(await s.notify('lesson_cancelled',player),0);
  await s.db.exec("update lesson_booking set status='Cancelled'; update lesson_slot set starts_at=now()-interval '1 minute',ends_at=now(),title='Cancelled group';");
  assert.equal(await s.notify('lesson_cancelled',player),3);
  assert.ok(s.events.every(e=>e.expiresAt===null&&e.eventKey===`lesson-cancelled:${booking}`));
 }finally{await s.db.close();}
});
test('feedback is private, revision deduplicated, and restricted to current player and guardians',async()=>{
 const s=await setup();try{
  assert.equal(await s.notify('lesson_feedback',coach),0);
  await s.db.exec("update lesson_booking set feedback='PRIVATE TECHNIQUE',drills='PRIVATE DRILL'");
  assert.equal(await s.notify('lesson_feedback',coach),2);
  assert.ok(s.events.every(e=>e.personId!==coach&&!e.body.includes('PRIVATE')));
  assert.equal(await s.notify('lesson_feedback',coach),0);
  await s.db.exec("update lesson_booking set drills='REVISED PRIVATE DRILL'");
  assert.equal(await s.notify('lesson_feedback',coach),2);
  assert.notEqual(s.events[0].eventKey,s.events[2].eventKey);
  await s.db.query('update person set registered=false where id=$1',[player]);
  assert.equal(await s.notify('lesson_feedback',coach),0);
 }finally{await s.db.close();}
});
test('inactive accounts, club memberships and clubs do not receive lesson events',async()=>{
 const s=await setup();try{
  await s.db.query('update user_account set active=false where person_id=$1',[player]);
  await s.db.query('update club_membership set active=false where person_id=$1',[guardian]);
  assert.equal(await s.notify('lesson_booking',player),1);assert.equal(s.events[0].personId,coach);
  await s.db.query('update club set active=false where id=$1',[club]);
  await s.db.exec("update lesson_booking set status='Cancelled'");
  assert.equal(await s.notify('lesson_cancelled',player),0);
 }finally{await s.db.close();}
});
test('a coach who is an active guardian can receive private feedback as a guardian',async()=>{
 const s=await setup();try{
  await s.db.query('insert into dependants values(3,$1,$2,$3,true)',[coach,player,club]);
  await s.db.exec("update lesson_booking set feedback='PRIVATE FEEDBACK'");
  assert.equal(await s.notify('lesson_feedback',coach),3);
  assert.equal(s.events.find(e=>e.personId===coach).href,`/lessons?booking=${booking}#booking-${booking}`);
 }finally{await s.db.close();}
});
