import assert from 'node:assert/strict';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
const base='http://127.0.0.1:3500';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
await initializeLocalDemo({query:(...args)=>db.query(...args),exec:sql=>db.query(sql)});
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:r.status,...await r.json()};}
const groups=[];let pro;
try{
 pro=await login('professional@example.test');const member=await login('member@example.test'),parent=await login('parent@example.test'),assistant=await login('assistant@example.test');
 const data=await api(pro,'/api/admin/lesson-groups');assert.equal(data.status,200,data.error);
 const clubId=data.clubs.find(c=>c.name==='Castle Golf Club').id;
 const memberId=(await api(member,'/api/lessons')).actorId,parentData=await api(parent,'/api/lessons'),junior=parentData.players.find(p=>p.name==='Casey Parker');
 assert.equal((await api(member,'/api/admin/lesson-groups')).status,403);
 async function create(name,mode,capacity){const r=await api(pro,'/api/admin/lesson-groups','POST',{action:'create',clubId,name:name+' '+Date.now(),mode,capacity});assert.equal(r.status,201,r.error);groups.push(r.group.id);return r.group.id;}
 const open=await create('Open test','Open',2),fixed=await create('Roster test','Roster',null);
 assert.equal((await api(assistant,'/api/admin/lesson-groups','PATCH',{action:'update',groupId:open,name:'Forbidden',capacity:1})).status,403);
 const day=new Date();day.setUTCDate(day.getUTCDate()+12);day.setUTCHours(17,0,0,0);
 async function session(id,offset,capacity){const start=new Date(day.getTime()+offset*3600000);const r=await api(pro,'/api/admin/lesson-groups','POST',{action:'session',groupId:id,startsAt:start.toISOString(),endsAt:new Date(start.getTime()+3600000).toISOString(),...(capacity!==undefined?{capacity}:{})});assert.equal(r.status,201,r.error);return r;}
 const openSession=await session(open,0);
 let availability=await api(member,'/api/lessons');let slot=availability.slots.find(s=>s.id===openSession.session.id);assert.ok(slot);assert.equal(slot.capacity,2);assert.equal(slot.booked,false);
 const [one,two]=await Promise.all([api(member,'/api/lessons','POST',{slotId:slot.id}),api(parent,'/api/lessons','POST',{slotId:slot.id,playerId:junior.id})]);assert.equal(one.status,201,one.error);assert.equal(two.status,201,two.error);
 assert.equal((await api(parent,'/api/lessons','POST',{slotId:slot.id,playerId:parentData.actorId})).status,409);
 availability=await api(member,'/api/lessons');slot=availability.slots.find(s=>s.id===slot.id);assert.equal(slot.booked,true);assert.equal(slot.booked_count,2);
 const diary=await api(pro,`/api/admin/lesson-availability?clubId=${clubId}&professionalId=${data.actorId}&week=${openSession.session.starts_at.slice(0,10)}`);assert.equal(diary.slots.filter(s=>s.id===slot.id).length,1);
 assert.equal((await api(parent,'/api/lessons','PATCH',{id:two.booking.id})).status,200);
 assert.equal((await api(parent,'/api/lessons','POST',{slotId:slot.id,playerId:parentData.actorId})).status,201);
 console.log('PASS open group capacity, concurrent different players, parent booking, released place and single diary card');
 assert.equal((await api(pro,'/api/admin/lesson-groups','PATCH',{action:'roster',groupId:fixed,personIds:[memberId,junior.id]})).status,200);
 const fixedSession=await session(fixed,2);assert.equal(fixedSession.booked,2);assert.ok(fixedSession.notified>=2);
 const parentInbox=await api(parent,'/api/notifications');assert.ok(parentInbox.items.some(n=>n.body.includes('Roster test')));
 const memberBookings=await api(member,'/api/lessons');assert.ok(memberBookings.bookings.some(b=>b.slot_id===fixedSession.session.id));
 const rosterSlot=parentData; // Fresh response must expose only actor/dependant eligibility, never other roster players.
 const fresh=await api(parent,'/api/lessons');const privateSlot=fresh.slots.find(s=>s.id===fixedSession.session.id);assert.deepEqual(privateSlot.eligible_player_ids,[junior.id]);assert.equal(Object.hasOwn(privateSlot,'participants'),false);
 assert.equal((await api(parent,'/api/lessons','POST',{slotId:privateSlot.id,playerId:parentData.actorId})).status,400);
 const idempotent=await api(pro,'/api/admin/lesson-groups','POST',{action:'bookRoster',slotId:fixedSession.session.id});assert.equal(idempotent.booked,0);
 const unlimited=await session(open,4,null);assert.equal(unlimited.session.capacity,null);
 for(const [cookie,playerId] of [[member,memberId],[parent,parentData.actorId],[parent,junior.id]])assert.equal((await api(cookie,'/api/lessons','POST',{slotId:unlimited.session.id,playerId})).status,201);
 console.log('PASS fixed roster auto-booking, member/guardian notifications, roster privacy, roster deduplication and uncapped sessions');
 assert.equal((await api(pro,'/api/admin/lesson-groups','POST',{action:'cancelSession',slotId:fixedSession.session.id})).status,201);
 assert.equal((await api(member,'/api/notifications')).items.some(n=>n.body.includes('Roster test')),false);
 console.log('PASS group cancellation expires booking notifications');
 console.log('Named group lesson HTTP checks passed.');
}finally{
 for(const id of groups){
  const bookings=(await db.query('select b.id from lesson_booking b join lesson_slot s on s.id=b.slot_id where s.group_id=$1',[id])).rows.map(r=>r.id);
  for(const b of bookings){await db.query('delete from app_notification where event_key=$1',[`lesson-booked:${b}`]);await db.query('delete from lesson_reminder where booking_id=$1',[b]);await db.query('delete from lesson_booking where id=$1',[b]);}
  await db.query('delete from lesson_slot where group_id=$1',[id]);await db.query('delete from lesson_group_member where group_id=$1',[id]);await db.query('delete from lesson_group where id=$1',[id]);
 }
 await db.end();
}
