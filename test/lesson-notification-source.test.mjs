import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import * as policy from '../lib/notification-policy.mjs';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');

test('lesson source freshness uses current booking, coaching, recipient and revision data',async t=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const query=async(...args)=>{const r=await db.query(...args);return {...r,rowCount:r.affectedRows||r.rows.length};};
  const club=(await query("select id from club where name='Castle Golf Club'")).rows[0].id;
  const people=Object.fromEntries((await query("select email,id from person where email in ('professional@example.test','member@example.test','parent@example.test')")).rows.map(p=>[p.email,p.id]));
  const coach=people['professional@example.test'],member=people['member@example.test'],guardian=people['parent@example.test'];
  const slot=(await query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Source freshness lesson','2031-06-02T09:00Z','2031-06-02T09:30Z',$2) returning id",[club,coach])).rows[0].id;
  const booking=(await query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at,reminder_minutes) select id,$2,$2,starts_at,ends_at,1440 from lesson_slot where id=$1 returning id',[slot,member])).rows[0].id;
  await query("insert into dependants(club_id,guardian_person_id,dependant_person_id,relationship,created_by) values($1,$2,$3,'Guardian',$2)",[club,guardian,member]);
  const revision=(await query("insert into lesson_reminder(booking_id,available_at) values($1,'2031-06-01T09:00Z') returning revision",[booking])).rows[0].revision;
  let now=Date.parse('2030-01-01T00:00Z');
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const api={},deps={'@/lib/cup-draw-inbox.mjs':{},'@/lib/server/db':{dbQuery:query},'@/lib/notification-policy.mjs':policy};
  const source=ts.transpileModule(readFileSync('lib/server/notifications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','Date',source)(id=>id in deps?deps[id]:require(id),api,Clock);
  const current=(type,event_key,person=member)=>api.notificationSourceIsCurrent('unused',person,{query},{type,event_key});
  const booked=()=>current('lesson_booking',`lesson-booked:${booking}`);
  const cancelled=()=>current('lesson_cancelled',`lesson-cancelled:${booking}`);
  const reminder=(rev=revision,person=member)=>current('lesson_reminder',`lesson-reminder:${booking}:${rev}`,person);
  const scenario=async(name,fn)=>t.test(name,async()=>{await db.exec('begin');try{await fn();}finally{await db.exec('rollback');now=Date.parse('2030-01-01T00:00Z');}});

  await scenario('booking is current for player, active guardian and appointed coach',async()=>{
   assert.equal(await booked(),true);
   assert.equal(await current('lesson_booking',`lesson-booked:${booking}`,guardian),true);
   assert.equal(await current('lesson_booking',`lesson-booked:${booking}`,coach),true);
   assert.equal(await current('lesson_cancelled',`lesson-booked:${booking}`),false);
  });
  await scenario('booking expires after cancellation while cancellation survives inactive slots',async()=>{
   assert.equal(await cancelled(),false);
   await query("update lesson_booking set status='Cancelled' where id=$1",[booking]);
   assert.equal(await booked(),false);assert.equal(await cancelled(),true);
   await query('update lesson_slot set active=false where id=$1',[slot]);
   assert.equal(await cancelled(),true);
   assert.equal(await current('lesson_cancelled',`lesson-cancelled:${booking}`,coach),true);
  });
  await scenario('inactive slot invalidates booking',async()=>{
   await query('update lesson_slot set active=false where id=$1',[slot]);assert.equal(await booked(),false);
  });
  await scenario('inactive coach person invalidates booking',async()=>{
   await query('update person set active=false where id=$1',[coach]);assert.equal(await booked(),false);
  });
  await scenario('revoked appointed coaching role invalidates booking',async()=>{
   await query("update club_membership set active=false where person_id=$1 and club_id=$2 and role in ('Golf Professional','Assistant Professional')",[coach,club]);
   assert.equal(await booked(),false);
  });
  await scenario('reminder revision must be current and reminders enabled',async()=>{
   assert.equal(await reminder(),true);
   assert.equal(await reminder('00000000-0000-4000-8000-000000000000'),false);
   await query('update lesson_reminder set revision=gen_random_uuid() where booking_id=$1',[booking]);
   assert.equal(await reminder(),false);
   const revised=(await query('select revision from lesson_reminder where booking_id=$1',[booking])).rows[0].revision;
   assert.equal(await reminder(revised),true);
   await query('update lesson_booking set reminder_minutes=0 where id=$1',[booking]);assert.equal(await reminder(revised),false);
  });
  await scenario('revoking guardian grant invalidates queued reminder',async()=>{
   assert.equal(await reminder(revision,guardian),true);
   await query('update dependants set active=false where club_id=$1 and guardian_person_id=$2 and dependant_person_id=$3',[club,guardian,member]);
   assert.equal(await reminder(revision,guardian),false);
  });
  await scenario('feedback needs completion, exact content hash and player or guardian access',async()=>{
   const feedback='Private technique',drills='Private drill';
   await query('update lesson_booking set feedback=$2,drills=$3 where id=$1',[booking,feedback,drills]);
   const hash=createHash('sha256').update(JSON.stringify([feedback,drills])).digest('hex'),key=`lesson-feedback:${booking}:${hash}`;
   assert.equal(await current('lesson_feedback',key),false);
   now=Date.parse('2032-01-01T00:00Z');
   assert.equal(await current('lesson_feedback',key),true);
   assert.equal(await current('lesson_feedback',key,guardian),true);
   assert.equal(await current('lesson_feedback',key,coach),false);
   await query("update lesson_booking set drills='Changed private drill' where id=$1",[booking]);
   assert.equal(await current('lesson_feedback',key),false);
  });
 }finally{await db.close();}
});
