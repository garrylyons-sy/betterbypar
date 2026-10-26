import assert from 'node:assert/strict';
import {Client} from 'pg';
import {initializeLocalDemo} from './local-demo-database.mjs';
import {defaultNotificationConfig} from '../lib/notification-policy.mjs';
const base='http://127.0.0.1:3500',db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
await initializeLocalDemo({query:(...a)=>db.query(...a),exec:sql=>db.query(sql)});
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:r.status,...await r.json()};}
const slots=[],bookings=[];let person,savedPreferences,savedConfig,subscription;
try{
 const member=await login('member@example.test'),pro=await login('professional@example.test');
 person=(await db.query("select id from person where email='member@example.test'")).rows[0].id;
 const coach=(await db.query("select id from person where email='professional@example.test'")).rows[0].id,club=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
 savedPreferences=(await db.query('select preferences from notification_preference where person_id=$1',[person])).rows[0];
 savedConfig=(await db.query('select config from notification_config where singleton')).rows[0];
 await db.query('insert into notification_config(singleton,config) values(true,$1) on conflict(singleton) do update set config=excluded.config',[JSON.stringify(defaultNotificationConfig)]);
 subscription=(await db.query("insert into notification_push_subscription(person_id,endpoint,p256dh,auth) values($1,$2,'local-test','local-test') returning id",[person,`https://fcm.googleapis.com/fcm/send/local-policy-test-${Date.now()}`])).rows[0].id;
 let index=0;
 for(const [name,inbox,push,email] of [['none',false,false,false],['inbox',true,false,false],['mobile',false,true,false],['email',false,false,true],['both',true,true,true]]){
  const types=['lesson_booking','lesson_cancelled','lesson_feedback','lesson_reminder'];
  const prefs={version:5,inboxTypes:inbox?types:[],pushTypes:push?types:[],pushEnabled:push,emailTypes:email?types:[],emailEnabled:email};
  const changed=await api(member,'/api/notifications/preferences','PATCH',prefs);assert.equal(changed.status,200,changed.error);
  const day=new Date();day.setUTCDate(day.getUTCDate()+20+index++);day.setUTCHours(19,0,0,0);
  const slot=(await db.query("insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by) values($1,$2,'Notification channel test',$3,$4,$2) returning id",[club,coach,day,new Date(day.getTime()+1800000)])).rows[0].id;slots.push(slot);
  const booked=await api(pro,'/api/admin/lesson-bookings','POST',{slotId:slot,playerId:person,reminderMinutes:1440});assert.equal(booked.status,201,booked.error);bookings.push(booked.booking.id);
  async function check(type,eventKey){
   const row=(await db.query('select n.id,n.inbox_visible,(select count(*)::int from notification_push_delivery where notification_id=n.id and subscription_id=$3) pushes,(select count(*)::int from notification_email_delivery where notification_id=n.id) emails from app_notification n where n.person_id=$1 and n.event_key=$2',[person,eventKey,subscription])).rows[0];
   if(name==='none'){assert.equal(row,undefined);return;}
   assert.ok(row,`${name} ${type} notification missing`);assert.equal(row.inbox_visible,inbox);assert.equal(row.pushes,Number(push));assert.equal(row.emails,Number(email));
  }
  await check('booking',`lesson-booked:${booked.booking.id}`);
  if(inbox){const feed=await api(member,'/api/notifications');assert.equal(feed.status,200,feed.error);assert.ok(feed.items.some(n=>n.type==='lesson_booking'&&n.href.includes(booked.booking.id)));}
  const cancelled=await api(member,'/api/lessons','PATCH',{id:booked.booking.id});assert.equal(cancelled.status,200,cancelled.error);
  await check('cancellation',`lesson-cancelled:${booked.booking.id}`);
  if(inbox){const feed=await api(member,'/api/notifications');assert.equal(feed.status,200,feed.error);assert.ok(feed.items.some(n=>n.type==='lesson_cancelled'&&n.href.includes(booked.booking.id)));assert.ok(!feed.items.some(n=>n.type==='lesson_booking'&&n.href.includes(booked.booking.id)));}
  console.log(`PASS ${name}: booking and cancellation respect recipient channels`);
 }
}finally{
 if(bookings.length){await db.query("delete from app_notification where event_key like any($1::text[])",[bookings.map(id=>`%:${id}%`)]);await db.query('delete from lesson_booking where id=any($1::uuid[])',[bookings]);await db.query("delete from user_activity_log where metadata->>'bookingId'=any($1::text[])",[bookings]);}
 if(slots.length)await db.query('delete from lesson_slot where id=any($1::uuid[])',[slots]);
 if(subscription)await db.query('delete from notification_push_subscription where id=$1',[subscription]);
 if(person){if(savedPreferences)await db.query('update notification_preference set preferences=$2 where person_id=$1',[person,JSON.stringify(savedPreferences.preferences)]);else await db.query('delete from notification_preference where person_id=$1',[person]);}
 if(savedConfig)await db.query('update notification_config set config=$1 where singleton',[JSON.stringify(savedConfig.config)]);else await db.query('delete from notification_config');
 await db.end();
}
