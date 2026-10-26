import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
test('group capacity, unlimited places, roster eligibility and one-to-one bookings remain enforced',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  if(!(await db.query("select to_regclass('lesson_group') t")).rows[0].t)await db.exec(await readFile('supabase/lesson_groups.sql','utf8'));
  const cid=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
  const people=Object.fromEntries((await db.query("select email,id from person where email in ('professional@example.test','member@example.test','parent@example.test')")).rows.map(p=>[p.email,p.id]));
  const pro=people['professional@example.test'],member=people['member@example.test'],parent=people['parent@example.test'],junior=(await db.query("select id from person where first_name='Casey' and last_name='Parker'")).rows[0].id;
  const group=(await db.query("insert into lesson_group(club_id,professional_person_id,name,mode,capacity,created_by) values($1,$2,'Castle Cubs test','Open',2,$2) returning id",[cid,pro])).rows[0].id;
  const slot=async(groupId,cap,hour)=> (await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by,group_id,capacity) values($1,$2,'Group test',$3,$4,$2,$5,$6) returning id",[cid,pro,`2031-06-02T${hour}:00:00Z`,`2031-06-02T${hour}:30:00Z`,groupId,cap])).rows[0].id;
  const book=async(s,p)=>(await db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$3,starts_at,ends_at from lesson_slot where id=$1 returning id',[s,p,pro])).rows[0].id;
  const capped=await slot(group,2,'09');await book(capped,member);const b=await book(capped,parent);
  await assert.rejects(book(capped,junior),/places|full/i);
  await db.query("update lesson_booking set status='Cancelled' where id=$1",[b]);await book(capped,junior);
  await assert.rejects(book(capped,junior));
  const unlimited=await slot(group,null,'10');for(const id of [member,parent,junior])await book(unlimited,id);
  const roster=(await db.query("insert into lesson_group(club_id,professional_person_id,name,mode,created_by) values($1,$2,'Roster test','Roster',$2) returning id",[cid,pro])).rows[0].id;
  await db.query('insert into lesson_group_member(group_id,person_id) values($1,$2)',[roster,junior]);
  const fixed=await slot(roster,null,'11');await book(fixed,junior);await assert.rejects(book(fixed,member),/roster/i);
  const single=await slot(null,1,'12');await book(single,member);await assert.rejects(book(single,parent),/places|full/i);
  assert.equal((await db.query('select count(*)::int n from lesson_booking where slot_id=$1 and status=\'Booked\'',[unlimited])).rows[0].n,3);
 }finally{await db.close();}
});
