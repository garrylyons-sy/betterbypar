import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
const base='http://127.0.0.1:3500';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
if(process.argv.includes('--apply-migration'))await db.query(await readFile(new URL('../supabase/golf_players.sql',import.meta.url),'utf8'));
await initializeLocalDemo({query:(...a)=>db.query(...a),exec:sql=>db.query(sql)});
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
let created,inviteEmail,coachingInviteCode;
// Remove a disposable fixture left by the first version of this local check.
const stale=(await db.query("select id from person where first_name='Registration' and last_name ~ '^Test[0-9]+$' and golf_ireland_number='9999999988' and email is null")).rows;
for(const row of stale){await db.query('delete from club_membership where person_id=$1',[row.id]);await db.query('delete from person where id=$1',[row.id]);}
try{
 const admin=await login('admin@example.test'),pro=await login('professional@example.test'),asst=await login('assistant@example.test');
 const clubId=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
 const coaches=(await db.query("select id from person where email in ('professional@example.test','assistant@example.test')")).rows.map(r=>r.id);
 const people=await api(admin,'/api/admin');assert.equal(people.status,200,people.error);
 for(const person of people.people.filter(p=>coaches.includes(p.person_id))){assert.equal(person.is_golf_player,false);assert.equal(person.is_coaching_staff,true);}
 const options=await api(pro,`/api/admin/lesson-bookings?clubId=${clubId}`);assert.equal(options.status,200,options.error);assert.ok(options.members.length>0);assert.ok(options.members.every(p=>!coaches.includes(p.id)));
 const groups=await api(pro,'/api/admin/lesson-groups');assert.equal(groups.status,200,groups.error);assert.ok(groups.members.every(p=>!coaches.includes(p.id)));
 const personal=await api(asst,'/api/lessons');assert.equal(personal.status,200,personal.error);assert.ok(personal.players.every(p=>!coaches.includes(p.id)));
 const temporaryNumber='999'+Date.now();
 const root={email:`registration-player-${Date.now()}@example.test`,firstName:'Registration',lastName:`Test${Date.now()}`,clubId,role:'Club Member',isGolfPlayer:true};
 assert.equal((await api(admin,'/api/admin/people','POST',root)).status,400);
 const valid=await api(admin,'/api/admin/people','POST',{...root,golfIrelandNumber:temporaryNumber});assert.equal(valid.status,200,valid.error);created=valid.person.personId;
 const duplicate=await api(admin,'/api/admin/people','POST',{...root,email:`duplicate-${Date.now()}@example.test`,lastName:'Duplicate'+Date.now(),golfIrelandNumber:temporaryNumber});assert.equal(duplicate.status,400);
 const missing=await api(admin,'/api/admin/people','PATCH',{personId:created,action:'details',firstName:'Registration',lastName:'Test',email:'',phone:'',handicap:'',isGolfPlayer:true,golfIrelandNumber:''});assert.equal(missing.status,400);
 const otherClub=(await db.query("select id from club where name='Woodland Golf Club'")).rows[0].id;
 const extra=await api(admin,'/api/admin/people','POST',{email:root.email,firstName:root.firstName,lastName:root.lastName,clubId:otherClub,role:'Club Member'});assert.equal(extra.status,200,extra.error);assert.equal(extra.person.personId,created);
 const preserved=(await db.query('select is_golf_player,golf_ireland_number from person where id=$1',[created])).rows[0];assert.equal(preserved.is_golf_player,true);assert.equal(preserved.golf_ireland_number,temporaryNumber);
 inviteEmail=`registration-${Date.now()}@example.test`;
 const invite={email:inviteEmail,name:'Registration Invite Test',clubId,roles:[{role:'Club Member',clubId}],isGolfPlayer:true};
 assert.equal((await api(admin,'/api/admin/invites','POST',invite)).status,400);
 const invited=await api(admin,'/api/admin/invites','POST',{...invite,golfIrelandNumber:'998'+Date.now()});assert.equal(invited.status,200,invited.error);
 assert.equal((await db.query('select is_golf_player from person where email=$1',[inviteEmail])).rows[0].is_golf_player,true);
 const memberBefore=(await db.query("select id,is_golf_player,golf_ireland_number from person where email='member@example.test'")).rows[0];
 const coachInvite=await api(admin,'/api/admin/invites','POST',{email:'member@example.test',name:'Morgan Kelly',clubId,roles:[{role:'Golf Professional',clubId}],isGolfPlayer:false,golfIrelandNumber:''});assert.equal(coachInvite.status,200,coachInvite.error);coachingInviteCode=coachInvite.invitation_code;
 const memberAfter=(await db.query('select is_golf_player,golf_ireland_number from person where id=$1',[memberBefore.id])).rows[0];assert.equal(memberAfter.is_golf_player,true);assert.equal(memberAfter.golf_ireland_number,memberBefore.golf_ireland_number);
 console.log('PASS admin registration, required and unique GI numbers, edit validation, coach exclusion from personal/pro/group lesson player lists');
}finally{
 if(coachingInviteCode)await db.query('delete from invitation where invitation_code=$1',[coachingInviteCode]);
 if(inviteEmail){await db.query('delete from invitation where email=$1',[inviteEmail]);await db.query('delete from person where email=$1',[inviteEmail]);}
 if(created){await db.query('delete from club_membership where person_id=$1',[created]);await db.query('delete from person where id=$1',[created]);}
 await db.end();
}
