import assert from 'node:assert/strict';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
const base='http://127.0.0.1:3500';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
await initializeLocalDemo({query:(...args)=>db.query(...args),exec:sql=>db.query(sql)});
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:r.status,...await r.json()};}
const ids=[];let foreignId;
try{
 const pro=await login('professional@example.test'),member=await login('member@example.test'),assistant=await login('assistant@example.test'),parent=await login('parent@example.test');
 const memberData=await api(member,'/api/lessons');assert.equal(memberData.status,200,memberData.error);
 const proId=(await db.query("select id from person where email='professional@example.test'")).rows[0].id;
 const parentId=(await db.query("select id from person where email='parent@example.test'")).rows[0].id;
 const slots=memberData.slots.filter(s=>s.professional_person_id===proId&&!s.booked).slice(0,3);assert.equal(slots.length,3);
 const directory=await api(pro,`/api/admin/lesson-bookings?clubId=${slots[0].club_id}`);assert.equal(directory.status,200,directory.error);
 const memberId=memberData.actorId;
 assert.ok(directory.members.some(p=>p.id===memberId&&p.on_platform));
 assert.equal((await api(member,`/api/admin/lesson-bookings?clubId=${slots[0].club_id}`)).status,403);
 assert.equal((await api(assistant,'/api/admin/lesson-bookings','POST',{slotId:slots[0].id,playerId:memberId})).status,403);
 let r=await api(pro,'/api/admin/lesson-bookings','POST',{slotId:slots[0].id,playerId:memberId,goals:'Work on bunker shots'});assert.equal(r.status,201,r.error);ids.push(r.booking.id);assert.equal(r.notified,1);
 const booking=(await db.query('select * from lesson_booking where id=$1',[r.booking.id])).rows[0];assert.equal(booking.booked_by,proId);assert.equal(booking.reminder_person_id,memberId);
 assert.equal((await api(pro,'/api/admin/lesson-bookings','POST',{slotId:slots[0].id,playerId:memberId})).status,409);
 await db.query('update lesson_booking set reminder_person_id=null,reminder_minutes=0 where id=$1',[r.booking.id]);
 assert.equal((await api(member,'/api/lessons','PATCH',{id:r.booking.id,action:'reminder',reminderMinutes:60})).status,200);
 assert.equal((await db.query('select reminder_person_id from lesson_booking where id=$1',[r.booking.id])).rows[0].reminder_person_id,memberId);
 let inbox=await api(member,'/api/notifications');assert.equal(inbox.status,200,JSON.stringify(inbox));
 const n=inbox.items.find(n=>n.href.includes(r.booking.id));assert.ok(n);assert.equal(n.type,'lesson_booking');assert.equal(n.href,`/lessons?booking=${r.booking.id}#booking-${r.booking.id}`);
 assert.ok((await api(member,'/api/lessons')).bookings.some(b=>b.id===r.booking.id));
 assert.equal((await api(member,'/api/notifications','PATCH',{id:n.id})).status,200);
 assert.equal((await api(member,'/api/notifications')).items.find(item=>item.id===n.id).readAt!==null,true);
 assert.equal((await api(assistant,'/api/notifications')).items.some(item=>item.id===n.id),false);
 console.log('PASS professional booking, audit actor, member reminder, native notification, exact booking link, read receipt and inbox isolation');
 const family=await api(parent,'/api/lessons');const junior=family.players.find(p=>p.name==='Casey Parker');
 r=await api(pro,'/api/admin/lesson-bookings','POST',{slotId:slots[1].id,playerId:junior.id});assert.equal(r.status,201,r.error);ids.push(r.booking.id);assert.equal(r.notified,1);
 assert.equal((await db.query('select reminder_person_id from lesson_booking where id=$1',[r.booking.id])).rows[0].reminder_person_id,parentId);
 assert.ok((await api(parent,'/api/notifications')).items.some(item=>item.href.includes(r.booking.id)));
 await db.query('update dependants set active=false where guardian_person_id=$1 and dependant_person_id=$2',[parentId,junior.id]);
 try{assert.equal((await api(parent,'/api/notifications')).items.some(item=>item.href.includes(r.booking.id)),false);assert.equal((await api(parent,'/api/lessons')).bookings.some(b=>b.id===r.booking.id),false);}finally{await db.query('update dependants set active=true where guardian_person_id=$1 and dependant_person_id=$2',[parentId,junior.id]);}
 console.log('PASS junior guardian notification/reminder and access revocation');
 foreignId=(await db.query("insert into person(first_name,last_name) values('Foreign','Verification') returning id")).rows[0].id;
 const second=(await db.query("select id from club where name='Woodland Golf Club'")).rows[0].id;
 await db.query("insert into club_membership(club_id,person_id,role) values($1,$2,'Club Member')",[second,foreignId]);
 assert.equal((await api(pro,'/api/admin/lesson-bookings','POST',{slotId:slots[2].id,playerId:foreignId})).status,403);
 await api(member,'/api/lessons','PATCH',{id:ids[0]});
 assert.equal((await api(member,'/api/notifications')).items.some(item=>item.id===n.id),false);
 console.log('PASS foreign-club rejection and cancelled-booking notification expiry');
 console.log('Professional booking checks passed.');
}finally{
 for(const id of ids){await db.query('delete from app_notification where event_key=$1',[`lesson-booked:${id}`]);await db.query('delete from lesson_reminder where booking_id=$1',[id]);await db.query('delete from lesson_booking where id=$1',[id]);}
 if(foreignId){await db.query('delete from club_membership where person_id=$1',[foreignId]);await db.query('delete from person where id=$1',[foreignId]);}
 await db.end();
}
