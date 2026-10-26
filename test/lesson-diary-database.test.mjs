import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
test('diary materializes30minutes, preserves bookings, overrides a week and converts Dublin DST',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  if(!(await db.query("select to_regclass('public.lesson_default_week') as t")).rows[0].t)await db.exec(await readFile('supabase/lesson_diary.sql','utf8'));
  const c=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
  const p=(await db.query("select id from person where email='professional@example.test'")).rows[0].id;
  const m=(await db.query("select id from person where email='member@example.test'")).rows[0].id;
  await db.query(`insert into lesson_default_week(club_id,professional_person_id,ranges) values($1,$2,'[{"day":0,"start":"09:00","end":"10:00"}]') on conflict(club_id,professional_person_id) do update set ranges=excluded.ranges`,[c,p]);
  await db.query(`select lesson_sync($1,$2,'2030-06-03','2030-06-09',$2,false)`,[c,p]);
  let slots=(await db.query("select * from lesson_slot where diary_managed and active and starts_at>='2030-06-03' and starts_at<'2030-06-10' order by starts_at")).rows;
  assert.equal(slots.length,2);assert.equal(new Date(slots[0].starts_at).toISOString(),'2030-06-03T08:00:00.000Z');
  assert.equal(new Date(slots[0].ends_at)-new Date(slots[0].starts_at),1800000);
  await db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) values($1,$2,$2,$3,$4)',[slots[0].id,m,slots[0].starts_at,slots[0].ends_at]);
  await db.query(`insert into lesson_week_override(club_id,professional_person_id,week_start,ranges) values($1,$2,'2030-06-03','[]')`,[c,p]);
  await assert.rejects(db.query(`select lesson_sync($1,$2,'2030-06-03','2030-06-09',$2,true)`,[c,p]),/booked/i);
  await db.query(`update lesson_week_override set ranges='[{"day":0,"start":"09:00","end":"09:30"}]' where club_id=$1 and professional_person_id=$2`,[c,p]);
  await db.query(`select lesson_sync($1,$2,'2030-06-03','2030-06-09',$2,true)`,[c,p]);
  assert.equal((await db.query("select count(*)::int as n from lesson_slot where diary_managed and active and starts_at>='2030-06-03' and starts_at<'2030-06-10'")).rows[0].n,1);
  await db.query(`select lesson_sync($1,$2,'2030-06-03','2030-06-09',$2,false)`,[c,p]);
  assert.equal((await db.query("select count(*)::int as n from lesson_slot where diary_managed and active and starts_at>='2030-06-03' and starts_at<'2030-06-10'")).rows[0].n,1);
  // Winter uses GMT, summer uses Irish Standard Time; PostgreSQL handles the timezone transition.
  await db.query(`select lesson_sync($1,$2,'2030-01-07','2030-01-13',$2,false)`,[c,p]);
  const winter=(await db.query("select starts_at from lesson_slot where diary_managed and starts_at>='2030-01-07' and starts_at<'2030-01-08' order by starts_at")).rows;
  assert.equal(new Date(winter[0].starts_at).toISOString(),'2030-01-07T09:00:00.000Z');
  await db.query(`update lesson_default_week set ranges='[{"day":6,"start":"01:00","end":"02:00"}]' where club_id=$1 and professional_person_id=$2`,[c,p]);
  await db.query(`select lesson_sync($1,$2,'2030-03-25','2030-03-31',$2,false)`,[c,p]);
  assert.equal((await db.query("select count(*)::int n from lesson_slot where diary_managed and active and starts_at>='2030-03-31' and starts_at<'2030-04-01'")).rows[0].n,0,'nonexistent spring clock times must not become later hours');
 }finally{await db.close();}
});
