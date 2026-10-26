import assert from 'node:assert/strict';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
const base='http://127.0.0.1:3500';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
await initializeLocalDemo({query:(...a)=>db.query(...a),exec:sql=>db.query(sql)});
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
let original,clubId;
try{
 const admin=await login('clubadmin@example.test'),member=await login('member@example.test'),pro=await login('professional@example.test');
 clubId=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
 const path=`/api/admin/lesson-settings?clubId=${clubId}&scope=club`;
 const settings=await api(admin,path);assert.equal(settings.status,200,settings.error);original=settings.settings.show_lesson_attendee_names;
 assert.equal((await api(member,path)).status,403);assert.equal((await api(pro,path,'PATCH',{clubId,showAttendeeNames:true})).status,403);
 for(const value of [true,false]){
  const result=await api(admin,path,'PATCH',{clubId,showAttendeeNames:value});assert.equal(result.status,200,result.error);
  const data=await api(member,'/api/lessons');assert.equal(data.status,200,data.error);
  const booked=data.slots.filter(s=>s.club_id===clubId&&s.booked_count>0);assert.ok(booked.length);
  if(value)assert.ok(booked.every(s=>s.attendee_names.length>0));else assert.ok(booked.every(s=>s.attendee_names.length===0));
  assert.ok(data.slots.filter(s=>s.club_id!==clubId).every(s=>s.attendee_names.length===0));
 }
 const groups=await api(pro,'/api/admin/lesson-groups');assert.equal(groups.status,200,groups.error);assert.ok(groups.sessions.some(s=>s.participants.some(p=>p.player_name==='Casey Parker')));
 console.log('PASS club-admin permissions, professional write denial, member name visibility on/off, club isolation, and professional attendee access');
}finally{
 if(clubId&&original!==undefined)await db.query('update club set show_lesson_attendee_names=$2 where id=$1',[clubId,original]);await db.end();
}
