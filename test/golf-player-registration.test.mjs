import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
import {normalizeGolfRegistration} from '../lib/golf-player.ts';
test('player numbers are required, kept as text, and optional for non-playing contacts',()=>{
 assert.throws(()=>normalizeGolfRegistration({isGolfPlayer:true,golfIrelandNumber:''}),/Every player/);
 assert.throws(()=>normalizeGolfRegistration({isGolfPlayer:true,golfIrelandNumber:'abc'}),/digits/);
 assert.deepEqual(normalizeGolfRegistration({isGolfPlayer:true,golfIrelandNumber:'00123456'}),{isGolfPlayer:true,golfIrelandNumber:'00123456'});
 assert.deepEqual(normalizeGolfRegistration({isGolfPlayer:false}),{isGolfPlayer:false,golfIrelandNumber:null});
});
test('registered players need unique GI numbers and coaching staff cannot be players or lesson attendees',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const cid=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
  const ids=Object.fromEntries((await db.query('select email,id from person')).rows.map(r=>[r.email,r.id]));
  const pro=ids['professional@example.test'],asst=ids['assistant@example.test'],member=ids['member@example.test'];
  for(const id of [pro,asst]){
   assert.equal((await db.query('select public.is_golf_player($1,$2) eligible',[id,cid])).rows[0].eligible,false);
   await assert.rejects(db.query('update person set is_golf_player=true,golf_ireland_number=$2 where id=$1',[id,id===pro?'9990000098':'9990000099']),/Professionals/);
  }
  await assert.rejects(db.query('update person set golf_ireland_number=null where id=$1',[member]),/registration/);
  await assert.rejects(db.query("insert into person(first_name,last_name,is_golf_player,golf_ireland_number) values('Duplicate','Number',true,'9990000001')"),/unique/);
  const slot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Registration test','2031-07-01T09:00Z','2031-07-01T09:30Z',$2) returning id",[cid,pro])).rows[0].id;
  await assert.rejects(db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$2,starts_at,ends_at from lesson_slot where id=$1',[slot,asst]),/registered player/);
  await db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$2,starts_at,ends_at from lesson_slot where id=$1',[slot,member]);
  const team=(await db.query("insert into team(club_id,league_id,season_id,name) select $1,l.id,s.id,'Registration test' from league l cross join season s limit 1 returning id",[cid])).rows[0].id;
  await assert.rejects(db.query("insert into team_membership(team_id,person_id,role) values($1,$2,'Player')",[team,pro]),/registration/);
  await db.query("insert into team_membership(team_id,person_id,role) values($1,$2,'Player')",[team,member]);
  const parent=ids['parent@example.test'];
  const parentSlot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Unregister test','2031-07-01T10:00Z','2031-07-01T10:30Z',$2) returning id",[cid,pro])).rows[0].id;
  await db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$2,starts_at,ends_at from lesson_slot where id=$1',[parentSlot,parent]);
  await db.query('update person set is_golf_player=false,golf_ireland_number=null where id=$1',[parent]);
  assert.equal((await db.query('select status from lesson_booking where slot_id=$1',[parentSlot])).rows[0].status,'Cancelled');
  // Appointing a registered player as coaching staff removes player eligibility.
  await db.query("insert into club_membership(club_id,person_id,role) values($1,$2,'Assistant Professional')",[cid,member]);
  assert.equal((await db.query('select active from team_membership where team_id=$1 and person_id=$2',[team,member])).rows[0].active,false);
  assert.equal((await db.query('select status from lesson_booking where slot_id=$1',[slot])).rows[0].status,'Cancelled');
  assert.equal((await db.query('select is_golf_player from person where id=$1',[member])).rows[0].is_golf_player,false);
  assert.equal((await db.query('select public.is_golf_player($1,$2) eligible',[member,cid])).rows[0].eligible,false);
 }finally{await db.close();}
});
