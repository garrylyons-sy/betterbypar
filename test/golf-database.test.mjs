import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {listClubBranding,saveClubBranding} from '../lib/server/club-branding-store.ts';
import {storeProfilePhoto} from '../lib/server/profile-photo-store.ts';
import {setClubAdminGrant} from '../lib/server/club-admin-grant.ts';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('golf database installation and transactional invariants', async t=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as 'select null::uuid';
  create function auth.jwt() returns jsonb language sql as 'select null::jsonb';`);
 await t.test('clean inherited schema and golf migration install without external services',async()=>{
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/system_settings.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/club_ladders.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/golf_foundation.sql',import.meta.url),'utf8'));
 });
 const id=async(sql,params=[]) => (await db.query(sql,params)).rows[0].id;
 const person=async(name)=>id(`insert into public.person(first_name,last_name) values($1,'Test') returning id`,[name]);
 const [admin,pro,pro2,assistant,parent,child,other]=await Promise.all(['Admin','Pro','Pro2','Assistant','Parent','Junior','Other'].map(person));
 let club;
 await t.test('rejects active club creation without its required appointments at transaction end',async()=>{
  await assert.rejects(db.transaction(tx=>tx.query("insert into public.club(name) values('Incomplete')")),/administrator/);
  assert.equal((await db.query("select count(*)::int as n from public.club where name='Incomplete'")).rows[0].n,0);
 });
 await db.transaction(async tx=>{
  club=(await tx.query("insert into public.club(name) values('Golf Club') returning id")).rows[0].id;
  for(const [p,role] of [[admin,'Club Member'],[pro,'Golf Professional'],[pro2,'Golf Professional'],[assistant,'Assistant Professional'],[parent,'Club Member'],[child,'Club Member']]){
   await tx.query('insert into public.club_membership(club_id,person_id,role,is_club_admin) values($1,$2,$3,$4)',[club,p,role,p===admin]);
  }
 });
 await t.test('multiple full and assistant professionals and a junior without account are supported',async()=>{
  assert.equal((await db.query("select count(*)::int as n from public.club_membership where club_id=$1 and role='Golf Professional' and active",[club])).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.user_account where person_id=$1',[child])).rows[0].n,0);
  await db.query(`insert into public.dependants(club_id,guardian_person_id,dependant_person_id,relationship,created_by) values($1,$2,$3,'Parent',$4)`,[club,parent,child,admin]);
  await assert.rejects(db.query(`insert into public.dependants(club_id,guardian_person_id,dependant_person_id,relationship,created_by) values($1,$2,$2,'Parent',$3)`,[club,parent,admin]),/check constraint/);
 });
 await t.test('removing last administrator or professionals rolls back; replacing an officer is atomic',async()=>{
  await assert.rejects(db.query('update public.club_membership set is_club_admin=false where club_id=$1 and person_id=$2',[club,admin]),/administrator/);
  await assert.rejects(db.query("update public.club_membership set active=false where club_id=$1 and role='Golf Professional'",[club]),/Golf Professional/);
  await db.transaction(async tx=>{
   await tx.query('update public.club_membership set is_club_admin=false where club_id=$1 and person_id=$2',[club,admin]);
   await tx.query(`update public.club_membership set is_club_admin=true where club_id=$1 and person_id=$2`,[club,parent]);
  });
 });
 await t.test('professional invitation roles and first-administrator activation grants can be stored without league teams',async()=>{
  const invitation=await id(`insert into public.invitation(email,invitation_code,invited_person_name,invited_club_id,invited_role,expires_at) values('pro@example.com','PRO-TEST','Pro Test',$1,'Player',now()+interval '1 day') returning id`,[club]);
  for(const role of ['Golf Professional','Assistant Professional']) await db.query('insert into public.invitation_club_membership(invitation_id,club_id,role) values($1,$2,$3)',[invitation,club,role]);
  assert.equal((await db.query('select count(*)::int as n from public.invitation_club_membership where invitation_id=$1',[invitation])).rows[0].n,2);
  const bootstrap=await db.query(`with setup as (select encode(gen_random_bytes(32),'hex') as token), invitation as (
   insert into public.invitation(email,invitation_code,invitation_token_hash,invited_person_name,invited_role,invite_administrator,expires_at)
   select 'setup@example.com','SETUP-TEST',encode(digest(token,'sha256'),'hex'),'Setup Admin','Player',true,now()+interval '1 day' from setup returning id)
   select setup.token,invitation.id from setup cross join invitation`);
  assert.equal(bootstrap.rows[0].token.length,64);
  const stored=(await db.query('select * from public.invitation where id=$1',[bootstrap.rows[0].id])).rows[0];
  assert.equal(stored.invite_administrator,true);assert.equal(stored.invited_club_id,null);assert.notEqual(stored.invitation_token_hash,bootstrap.rows[0].token);
 });
 await t.test('admin grants and revocations synchronize both legacy permission records',async()=>{
  await db.transaction(tx=>setClubAdminGrant(tx,club,admin,true));
  assert.equal((await db.query('select is_club_admin from public.club_membership where club_id=$1 and person_id=$2',[club,admin])).rows[0].is_club_admin,true);
  await db.transaction(tx=>setClubAdminGrant(tx,club,admin,false));
  assert.equal((await db.query('select is_club_admin from public.club_membership where club_id=$1 and person_id=$2',[club,admin])).rows[0].is_club_admin,false);
  assert.equal((await db.query('select active from public.club_admin where club_id=$1 and person_id=$2',[club,admin])).rows[0].active,false);
  await assert.rejects(db.transaction(tx=>setClubAdminGrant(tx,club,parent,false)),/administrator/);
 });
 await t.test('person deactivation cannot bypass required professional appointments',async()=>{
  await db.query('update public.person set active=false where id=$1',[pro2]);
  await assert.rejects(db.query('update public.person set active=false where id=$1',[pro]),/Golf Professional/);
  await db.query('update public.person set active=true where id=$1',[pro2]);
 });
 const start='2031-06-01T10:00:00Z',end='2031-06-01T10:30:00Z';
 const slot=async(professional,starts=start,ends=end)=>id(`insert into public.lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Lesson',$3,$4,$5) returning id`,[club,professional,starts,ends,admin]);
 const first=await slot(pro),second=await slot(pro2);
 await t.test('professional cannot publish overlapping slots; adjacent slots are allowed',async()=>{
  await assert.rejects(slot(pro,'2031-06-01T10:15:00Z','2031-06-01T10:45:00Z'),/exclusion constraint/);
  await slot(pro,end,'2031-06-01T11:00:00Z');
 });
 const book=async(slotId,player=child)=>id(`insert into public.lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) values($1,$2,$3,'2000-01-01','2000-01-02') returning id`,[slotId,player,parent]);
 let booking;
 await t.test('concurrent requests for one slot have exactly one winner; actual times and booking actor are retained',async()=>{
  const results=await Promise.allSettled([book(first),book(first)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  booking=results.find(r=>r.status==='fulfilled').value;
  const row=(await db.query('select * from public.lesson_booking where id=$1',[booking])).rows[0];
  assert.equal(row.player_person_id,child);assert.equal(row.booked_by,parent);assert.equal(new Date(row.starts_at).toISOString(),'2031-06-01T10:00:00.000Z');
 });
 await t.test('a junior cannot be double booked with different professionals',async()=>{
  await assert.rejects(book(second),/exclusion constraint/);
 });
 await t.test('cancelling a booking frees the slot; unrelated or inactive players cannot book',async()=>{
  await db.query("update public.lesson_booking set status='Cancelled',cancelled_at=now(),cancelled_by=$2 where id=$1",[booking,parent]);
  await assert.rejects(book(first,other),/membership/);
  await db.query('update public.person set active=false where id=$1',[child]);
  await assert.rejects(book(first),/membership/);
  await db.query('update public.person set active=true where id=$1',[child]);
  await book(first);
 });
 await t.test('revoked professionals cannot accept new bookings',async()=>{
  await db.query("update public.club_membership set active=false where person_id=$1 and role='Golf Professional'",[pro2]);
  await assert.rejects(book(second,parent),/Professional is no longer active/);
 });
 await t.test('photos can be changed only by their owner or an active direct guardian',async()=>{
  const photo='data:image/webp;base64,UklGRg==';
  await db.transaction(tx=>storeProfilePhoto(tx,child,child,null,photo));
  assert.equal((await db.query('select profile_image from public.person where id=$1',[child])).rows[0].profile_image,photo);
  await db.transaction(tx=>storeProfilePhoto(tx,parent,child,club,photo));
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,other,child,club,photo)),/not authorised/i);
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,parent,child,'00000000-0000-4000-8000-000000000000',photo)),/not authorised/i);
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,admin,child,club,photo)),/not authorised/i,'club admin does not imply guardian');
  await db.query('update public.dependants set active=false where guardian_person_id=$1 and dependant_person_id=$2',[parent,child]);
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,parent,child,club,photo)),/not authorised/i);
  await db.query('update public.dependants set active=true where guardian_person_id=$1 and dependant_person_id=$2',[parent,child]);
  await db.query('update public.club_membership set active=false where person_id=$1',[child]);
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,parent,child,club,photo)),/not authorised/i);
  await db.query('update public.club_membership set active=true where person_id=$1',[child]);
  await db.query('update public.person set active=false where id=$1',[child]);
  await assert.rejects(db.transaction(tx=>storeProfilePhoto(tx,parent,child,club,photo)),/not authorised/i);
  await db.query('update public.person set active=true where id=$1',[child]);
  const authSource=readFileSync(new URL('../lib/server/auth.ts',import.meta.url),'utf8');
  const invitationPhotoSQL=authSource.match(/`(update public.person\s+set email = coalesce[\s\S]*?returning \*)`/)[1];
  await db.query(invitationPhotoSQL,[child,'junior@example.com','','https://google.example/avatar.jpg']);
  assert.equal((await db.query('select profile_image from public.person where id=$1',[child])).rows[0].profile_image,photo,'accepting another invitation must preserve the custom photo');
  await db.transaction(tx=>storeProfilePhoto(tx,child,child,null,null));
  assert.equal((await db.query('select profile_image from public.person where id=$1',[child])).rows[0].profile_image,'');
  await db.query(invitationPhotoSQL,[child,'junior@example.com','','https://google.example/avatar.jpg']);
  assert.equal((await db.query('select profile_image from public.person where id=$1',[child])).rows[0].profile_image,'','removing a photo must also survive another invitation');
 });
 await t.test('clubadmin branding is isolated to explicit appointments, including platform operators',async()=>{
  let secondClub;
  await db.transaction(async tx=>{
   secondClub=(await tx.query("insert into public.club(name) values('Other Golf Club') returning id")).rows[0].id;
   await tx.query("insert into public.club_membership(club_id,person_id,role,is_club_admin) values($1,$2,'Club Member',true),($1,$3,'Golf Professional',false)",[secondClub,other,pro]);
  });
  await db.query('insert into public.app_operator(person_id) values($1)',[admin]);
  assert.deepEqual((await listClubBranding(db,parent)).map(c=>c.id),[club]);
  assert.deepEqual((await listClubBranding(db,other)).map(c=>c.id),[secondClub]);
  assert.equal((await listClubBranding(db,admin)).length,0,'platform role alone does not grant clubportal authority');
  const branding={logoPath:'/my-club.png',primaryColor:'#102030',accentColor:'#AABBCC'};
  const saved=await db.transaction(tx=>saveClubBranding(tx,parent,club,branding));
  assert.equal(saved.logo_path,branding.logoPath);assert.equal(saved.primary_color,branding.primaryColor);
  await assert.rejects(db.transaction(tx=>saveClubBranding(tx,parent,secondClub,branding)),/administrator access/);
  await assert.rejects(db.transaction(tx=>saveClubBranding(tx,admin,club,branding)),/administrator access/);
  await assert.rejects(db.transaction(tx=>saveClubBranding(tx,pro,club,branding)),/administrator access/);
  assert.equal((await db.query('select logo_path from public.club where id=$1',[secondClub])).rows[0].logo_path,null);
  await db.transaction(tx=>setClubAdminGrant(tx,club,admin,true));
  await db.transaction(tx=>setClubAdminGrant(tx,club,parent,false));
  assert.equal((await listClubBranding(db,parent)).length,0);
  await assert.rejects(db.transaction(tx=>saveClubBranding(tx,parent,club,branding)),/administrator access/);
  await db.query('update public.club set active=false where id=$1',[club]);
  assert.equal((await listClubBranding(db,admin)).length,0);
  await assert.rejects(db.transaction(tx=>saveClubBranding(tx,admin,club,branding)),/administrator access/);
 });
 await t.test('new private tables are not accessible to anonymous Supabase clients',async()=>{
  await db.exec('set role anon');
  try{await assert.rejects(db.query('select * from public.dependants'),/permission denied/);await assert.rejects(db.query('select * from public.lesson_booking'),/permission denied/);}finally{await db.exec('reset role');}
 });
});
