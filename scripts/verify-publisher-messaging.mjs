// Real SQL verification. Synthetic people, assignments, messages and configuration
// are rolled back. No network push dispatcher is called.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import ts from 'typescript';
import * as policy from '../lib/notification-policy.mjs';
import * as announcements from '../lib/announcement-policy.mjs';
import * as cupInbox from '../lib/cup-draw-inbox.mjs';
const require=createRequire(import.meta.url);
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const match=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^["']|["']$/g,'');}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();
let current=null,dispatches=0;
const db={dbQuery:(sql,args)=>client.query(sql,args),withTransaction:async fn=>{await client.query('savepoint app_transaction');try{const result=await fn(client);await client.query('release savepoint app_transaction');return result;}catch(error){await client.query('rollback to savepoint app_transaction');throw error;}}};
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 if(name==='lib/notification-policy.mjs')return policy;
 if(name==='lib/announcement-policy.mjs')return announcements;
 if(name==='lib/cup-draw-inbox.mjs')return cupInbox;
 if(name==='lib/server/db')return db;
 if(name==='lib/server/notification-dispatch')return {scheduleNotificationPush:()=>dispatches++};
 const exports={};cache.set(name,exports);
 const compiled=ts.transpileModule(fs.readFileSync(new URL(`../${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',compiled)(dependency=>dependency==='next/headers'?{cookies:()=>{throw Error('No browser session in SQL verification');}}:dependency.startsWith('@/')?load(dependency.slice(2)):require(dependency),exports);
 return exports;
}
try{
 await client.query('begin');
 const permission=(await client.query("select relrowsecurity,has_table_privilege('anon','public.app_publisher','select,insert,update,delete') as anon,has_table_privilege('authenticated','public.app_publisher','select,insert,update,delete') as authenticated from pg_class where oid='public.app_publisher'::regclass")).rows[0];
 assert.equal(permission.relrowsecurity,true);assert.equal(permission.anon,false);assert.equal(permission.authenticated,false);
 async function person(label){const row=(await client.query("insert into public.person(first_name,last_name) values('Publisher verification',$1) returning id",[label])).rows[0];const account=(await client.query('insert into public.user_account(person_id,username,active) values($1,$2,true) returning id',[row.id,`publisher-test-${randomUUID()}`])).rows[0];return {personId:row.id,accountId:account.id,username:label,email:'',name:label,profileImage:''};}
 const admin=await person('Admin'),sender=await person('Sender'),recipient=await person('Recipient'),outsider=await person('Outsider');
 await client.query('insert into public.app_operator(person_id,active) values($1,true)',[admin.personId]);
 const auth=load('lib/server/auth');auth.currentUser=async()=>current;
 const people=load('app/api/admin/people/route');
 const update=async(user,target,publisher)=>{current=user;return people.PATCH(new Request('https://app.test/api/admin/people',{method:'PATCH',body:JSON.stringify({action:'details',personId:target.personId,firstName:'Publisher verification',lastName:target.name,email:'',phone:'',handicap:'',roles:[],publisher})}));};
 for(const person of [sender,recipient]){const response=await update(admin,person,true);assert.equal(response.status,200,await response.text());}
 const publisher=load('lib/server/publisher');
 assert.equal(await publisher.isPublisher(sender.personId),true);assert.equal(await publisher.isPublisher(outsider.personId),false);
 assert.equal((await client.query('select 1 from public.app_operator where person_id=$1',[sender.personId])).rowCount,0);
 const payload=await auth.loadSessionPayload(sender);
 assert.equal(payload.contexts.length,1);assert.equal(payload.contexts[0].role,'Publisher');assert.equal(payload.contexts[0].hasPublisherAccess,true);assert.equal(Boolean(payload.contexts[0].hasLeagueChairAccess),false);
 const forbidden=await update(sender,outsider,true);assert.equal(forbidden.status,400);assert.equal(await publisher.isPublisher(outsider.personId),false);
 const core=load('lib/server/notifications'),initial=await core.loadNotificationConfig(client);
 await client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify({...initial,enabled:true,eligibleRoles:['Publisher'],enabledTypes:['announcement']})]);
 for(const user of [sender,recipient])await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb)',[user.personId,JSON.stringify({...policy.defaultNotificationPreferences,inboxTypes:['announcement'],pushTypes:['announcement'],pushEnabled:true})]);
 await client.query("insert into public.notification_push_subscription(person_id,endpoint,p256dh,auth) values($1,$2,'synthetic','synthetic')",[recipient.personId,`https://example.invalid/publisher-test/${randomUUID()}`]);
 const service=load('lib/server/notification-announcements');
 for(const channels of [['inbox'],['push'],['inbox','push']]){
  const draft={title:'Publisher verification',body:'A temporary message.',audience:{roles:[],clubId:null,teamId:null,personIds:[recipient.personId],channels}};
  const preview=await service.previewAnnouncement(draft);assert.equal(preview.matched,1);
  const request={...draft,requestId:randomUUID(),previewToken:preview.previewToken};
  const sent=await service.sendAnnouncement(sender.personId,request,c=>publisher.requirePublisher(sender.personId,c));
  const retried=await service.sendAnnouncement(sender.personId,request,c=>publisher.requirePublisher(sender.personId,c));assert.equal(retried.duplicate,true);
  const rows=(await client.query('select id,person_id,inbox_visible from public.app_notification where event_key=$1',[`announcement:${sent.announcement.id}`])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].person_id,recipient.personId);assert.equal(rows[0].inbox_visible,channels.includes('inbox'));
  const deliveries=(await client.query('select id from public.notification_push_delivery where notification_id=$1',[rows[0].id])).rowCount;assert.equal(deliveries,channels.includes('push')?1:0);
 }
 assert.equal(dispatches,3);
 assert.equal((await client.query('select 1 from public.app_notification where person_id=$1',[outsider.personId])).rowCount,0);
 const revoked=await update(admin,sender,false);assert.equal(revoked.status,200);assert.equal(await publisher.isPublisher(sender.personId),false);
 await assert.rejects(publisher.requirePublisher(sender.personId),/Publisher access/);
 assert.equal((await auth.loadSessionPayload(sender)).contexts.length,0);
 await update(admin,sender,true);await client.query('update public.user_account set active=false where id=$1',[sender.accountId]);assert.equal(await publisher.isPublisher(sender.personId),false);
 console.log('Verified protected role table, admin-only assignment/revocation, no club/team requirement, Publisher-only session fallback, inbox/push/both delivery, exact recipients, idempotent retries and inactive-account denial. All synthetic records rolled back; no real push sent.');
}finally{await client.query('rollback');client.release();await pool.end();}
