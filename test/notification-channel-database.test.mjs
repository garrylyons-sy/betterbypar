import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import * as policy from '../lib/notification-policy.mjs';
import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path,deps){const api={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id in deps?deps[id]:require(id),api);return api;}
test('shared event write atomically selects none/inbox/push/email/both, deduplicates, and protects email outbox',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const query=async(...a)=>{const r=await db.query(...a);return {...r,rowCount:r.affectedRows||r.rows.length};};
  const notifications=load('lib/server/notifications.ts',{'@/lib/cup-draw-inbox.mjs':{},'@/lib/server/db':{dbQuery:query},'@/lib/notification-policy.mjs':policy});
  const person=(await query("select id from person where email='member@example.test'")).rows[0].id;
  await query("insert into notification_push_subscription(person_id,endpoint,p256dh,auth) values($1,'https://example.test/push','test','test')",[person]);
  for(const [key,inbox,push,email] of [['none',false,false,false],['inbox',true,false,false],['push',false,true,false],['email',false,false,true],['both',true,true,true]]){
   const prefs={version:5,inboxTypes:inbox?['lesson_booking']:[],pushEnabled:push,pushTypes:push?['lesson_booking']:[],emailEnabled:email,emailTypes:email?['lesson_booking']:[]};
   await query('insert into notification_preference(person_id,preferences) values($1,$2) on conflict(person_id) do update set preferences=excluded.preferences',[person,JSON.stringify(prefs)]);
   const event={type:'lesson_booking',title:'Booked',body:'Example',href:'/lessons',eventKey:`channel-test:${key}`};
   assert.equal(await notifications.createNotification({query},person,event),key!=='none');
   assert.equal(await notifications.createNotification({query},person,event),false);
   const row=(await query('select n.inbox_visible,(select count(*)::int from notification_push_delivery where notification_id=n.id) pushes,(select count(*)::int from notification_email_delivery where notification_id=n.id) emails from app_notification n where event_key=$1',[event.eventKey])).rows[0];
   if(key==='none')assert.equal(row,undefined);else{assert.equal(row.inbox_visible,inbox);assert.equal(row.pushes,Number(push));assert.equal(row.emails,Number(email));}
  }
  const security=(await query("select relrowsecurity from pg_class where oid='notification_email_delivery'::regclass")).rows[0];assert.equal(security.relrowsecurity,true);
  for(const role of ['anon','authenticated']){
   const grants=(await query("select has_table_privilege($1,'notification_email_delivery','SELECT,INSERT,UPDATE,DELETE') as allowed",[role])).rows[0];assert.equal(grants.allowed,false);
  }
 }finally{await db.close();}
});
