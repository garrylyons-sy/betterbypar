import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
import {weekStart,addDays} from '../lib/lesson-diary.mjs';
const base='http://127.0.0.1:3500';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
if(!(await db.query("select to_regclass('public.lesson_default_week') as ready")).rows[0].ready){
 await db.query(await readFile('supabase/lesson_diary.sql','utf8'));
 await db.query("update lesson_slot s set ends_at=starts_at+interval '30 minutes' where not exists(select 1 from lesson_booking where slot_id=s.id)");
}
// Refresh the local function while this migration is still under development.
const diarySql=await readFile('supabase/lesson_diary.sql','utf8');
const sync=diarySql.match(/create function public\.lesson_sync[\s\S]*?end \$\$;/)[0].replace('create function','create or replace function');
await db.query(sync);
await db.query("insert into lesson_reminder(booking_id,available_at) select id,greatest(now(),starts_at-reminder_minutes*interval '1 minute') from lesson_booking where status='Booked' and starts_at>now() and reminder_minutes>0 on conflict do nothing");
await initializeLocalDemo({query:(...args)=>db.query(...args),exec:sql=>db.query(sql)});
async function login(email){
 const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
}
async function api(cookie,path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 const data=await r.json();return {status:r.status,...data};
}
let bookingId,feedbackBooking,feedbackSlot,cid,pid,week,previousOverride;
try{
 const pro=await login('professional@example.test'),member=await login('member@example.test'),assistant=await login('assistant@example.test'),parent=await login('parent@example.test');
 let diary=await api(pro,'/api/admin/lesson-availability');assert.equal(diary.status,200,diary.error);
 cid=diary.clubs.find(c=>c.name==='Castle Golf Club').id;pid=diary.actorId;week=addDays(weekStart(),7);
 previousOverride=(await db.query('select ranges from lesson_week_override where club_id=$1 and professional_person_id=$2 and week_start=$3',[cid,pid,week])).rows[0];
 const body={clubId:cid,professionalId:pid,week,mode:'week',ranges:[{day:0,start:'16:00',end:'17:00'}]};
 assert.equal((await api(assistant,'/api/admin/lesson-availability','POST',body)).status,403);
 assert.equal((await api(pro,'/api/admin/lesson-availability','POST',body)).status,200);
 diary=await api(pro,`/api/admin/lesson-availability?clubId=${cid}&professionalId=${pid}&week=${week}`);
 assert.equal(diary.hasOverride,true);assert.equal(diary.slots.filter(s=>s.diary_managed).length,2);console.log('PASS own diary permissions, week override, two30minute blocks');
 let lessons=await api(member,'/api/lessons');assert.equal(lessons.status,200,lessons.error);
 const slot=diary.slots.find(s=>s.diary_managed);
 const booked=await api(member,'/api/lessons','POST',{slotId:slot.id,goals:'Improve putting distance control',reminderMinutes:60});assert.equal(booked.status,201,booked.error);bookingId=booked.booking.id;
 assert.equal((await api(member,'/api/lessons','POST',{slotId:slot.id})).status,409);
 let own=(await api(member,'/api/lessons')).bookings.find(b=>b.id===bookingId);assert.equal(own.goals,'Improve putting distance control');assert.equal(own.reminder_minutes,60);
 const remove=await api(pro,'/api/admin/lesson-availability','POST',{...body,ranges:[]});assert.equal(remove.status,400);assert.match(remove.error,/booked/i);
 assert.equal((await api(assistant,'/api/lessons','PATCH',{id:bookingId,asManager:true})).status,403);
 assert.equal((await api(member,'/api/lessons','PATCH',{id:bookingId,action:'reminder',reminderMinutes:120})).status,200);
 assert.equal((await db.query('select count(*)::int n from lesson_reminder where booking_id=$1',[bookingId])).rows[0].n,1);console.log('PASS booking goals, duplicate protection, booked-time preservation and reminder queue');
 assert.equal((await api(member,'/api/lessons','PATCH',{id:bookingId})).status,200);bookingId=null;
 assert.equal((await api(pro,'/api/admin/lesson-availability','POST',{...body,ranges:[]})).status,200);
 // Create an ended test lesson directly; booking trigger must still permit coach feedback after its end.
 const memberId=(await db.query("select id from person where email='member@example.test'")).rows[0].id;
 const temp=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Diary feedback verification',now()-interval '2 days',now()-interval '2 days'+interval '30 minutes',$2) returning id",[cid,pid])).rows[0];feedbackSlot=temp.id;
 await db.query('alter table lesson_booking disable trigger golf_booking_valid');
 try{feedbackBooking=(await db.query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$2,starts_at,ends_at from lesson_slot where id=$1 returning id',[feedbackSlot,memberId])).rows[0].id;}finally{await db.query('alter table lesson_booking enable trigger golf_booking_valid');}
 assert.equal((await api(assistant,'/api/admin/lesson-feedback','PATCH',{bookingId:feedbackBooking,feedback:'No'})).status,403);
 assert.equal((await api(pro,'/api/admin/lesson-feedback','PATCH',{bookingId:feedbackBooking,feedback:'Great progress with pace.',drills:'Practice 10 putts at three distances.\nRepeat twice weekly.'})).status,200);
 own=(await api(member,'/api/lessons')).bookings.find(b=>b.id===feedbackBooking);assert.match(own.drills,/Repeat twice/);console.log('PASS postlesson feedback permission and member drill visibility');
 const family=await api(parent,'/api/lessons');assert.ok(family.players.some(p=>p.name==='Casey Parker'));console.log('PASS dependant booking player access');
 const cron=await api(member,'/api/cron/lessons');assert.equal(cron.status,401);
 console.log('Lesson diary HTTP checks passed.');
}finally{
 if(bookingId)await db.query('delete from lesson_reminder where booking_id=$1',[bookingId]);
 if(bookingId)await db.query('delete from lesson_booking where id=$1',[bookingId]);
 if(feedbackBooking)await db.query('delete from lesson_booking where id=$1',[feedbackBooking]);
 if(feedbackSlot)await db.query('delete from lesson_slot where id=$1',[feedbackSlot]);
 if(cid&&pid&&week){if(previousOverride)await db.query('update lesson_week_override set ranges=$4::jsonb where club_id=$1 and professional_person_id=$2 and week_start=$3',[cid,pid,week,JSON.stringify(previousOverride.ranges)]);else await db.query('delete from lesson_week_override where club_id=$1 and professional_person_id=$2 and week_start=$3',[cid,pid,week]);await db.query('select lesson_sync($1,$2,$3::date,$3::date+6,$2,false)',[cid,pid,week]);}
 await db.end();
}
