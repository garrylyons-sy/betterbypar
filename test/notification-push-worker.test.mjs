import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createECDH } from 'node:crypto';
import ts from 'typescript';
import * as cupPolicy from '../lib/cup-draw-notification-policy.mjs';
import * as policy from '../lib/notification-policy.mjs';
import * as pushPolicy from '../lib/notification-push-policy.mjs';

const source=ts.transpileModule(readFileSync(new URL('../lib/server/notification-push.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
function worker({eligible=true,read=false,pushEnabled=true,failure,endpointOwned=true,active=true,sourceCurrent=true,expiresAt=null,batches=1,jobsPerBatch=1,sendElapsed=0}={}) {
  // Fixed test-only key; never configure application env or contact providers.
  const key=createECDH('prime256v1');key.setPrivateKey(Buffer.alloc(32,1));
  const env={VAPID_SUBJECT:'mailto:test@example.com',VAPID_PUBLIC_KEY:key.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:key.getPrivateKey().toString('base64url')};
  const updates=[],payloads=[],options=[];let sends=0,claims=0,freshChecks=0,elapsed=0;
  class Clock extends Date {static now(){return Date.now()+elapsed;}}
  const job={id:'delivery',notification_id:'notification',subscription_id:'device',person_id:'person',endpoint:'https://fcm.googleapis.com/fcm/send/device',p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16).toString('base64url'),active:true,type:'match_reminder',title:'Match reminder',body:'Tomorrow',href:'//evil.com',read_at:null,expires_at:null,attempts:1,lock_token:'2026-10-20 12:00:00.123456+00'};
  const dbQuery=async(sql,args)=>{
    if(sql.includes('with due as')){assert.match(sql,/for update skip locked/i);assert.match(sql,/locked_at<now\(\)-interval '10 minutes'/);return {rows:claims++<batches?Array.from({length:jobsPerBatch},(_,i)=>({...job,id:`delivery-${claims}-${i}`})):[]};}
    if(sql.includes('select n.read_at')){freshChecks++;return {rows:[{read_at:read?new Date():null,expires_at:expiresAt,active}]};}
    updates.push({sql,args});return {rows:[],rowCount:sql.startsWith('insert into public.notification_push_subscription')&&!endpointOwned?0:1};
  };
  const deps={
    'web-push':{sendNotification:async(_subscription,payload,settings)=>{sends++;elapsed+=sendElapsed;payloads.push(JSON.parse(payload));options.push(settings);assert.equal(JSON.parse(payload).href,'/');if(failure)throw {statusCode:failure};}},
    'node:crypto':{createECDH},
    '@/lib/notification-policy.mjs':policy,
    '@/lib/cup-draw-notification-policy.mjs':cupPolicy,
    '@/lib/notification-push-policy.mjs':pushPolicy,
    '@/lib/server/db':{dbQuery},
    '@/lib/server/notifications':{notificationSourceIsCurrent:async()=>sourceCurrent,notificationAccess:async()=>({eligible,roles:eligible?['League Chair']:[],config:{...policy.defaultNotificationConfig,quietStart:'00:00',quietEnd:'00:00'},preferences:{...policy.defaultNotificationPreferences,pushEnabled}})}
  };
  const exports={};vm.runInNewContext(source,{exports,require:id=>deps[id],process:{env},Buffer,URL,Date:Clock,console});
  return {run:exports.processNotificationPush,subscribe:exports.subscribeNotificationPush,updates,payloads,options,get freshChecks(){return freshChecks;},get sends(){return sends;}};
}
test('worker reevaluates opt-out, read state and eligibility before send',async()=>{
  for(const options of [{eligible:false},{read:true},{pushEnabled:false}]){
    const w=worker(options);const result=await w.run();assert.equal(result.skipped,1);assert.equal(w.sends,0);assert.equal(w.updates[0].args[2],'Skipped');
  }
});
test('drains successive claim batches instead of leaving reminder backlog until next hour',async()=>{
  const w=worker({batches:4,jobsPerBatch:5});const result=await w.run();assert.equal(result.sent,20);assert.equal(result.claimed,20);
});
test('stops claiming waves when the wall-clock budget cannot accommodate another provider timeout',async()=>{
  const w=worker({batches:100,jobsPerBatch:5,sendElapsed:1000});const result=await w.run();assert.equal(result.sent,30);
  assert.ok(w.options.every(option=>option.timeout<=5000));
});
test('rereads read state, subscription activation and source before sending claimed work',async()=>{
  for(const settings of [{active:false},{sourceCurrent:false},{expiresAt:new Date(Date.now()-1000)}]){
    const w=worker(settings);assert.equal((await w.run()).skipped,1);assert.equal(w.sends,0);
  }
  const w=worker();await w.run();assert.equal(w.freshChecks,1);
});
test('provider TTL cannot outlive the notification and expiry travels to the service worker',async()=>{
  const expiresAt=new Date(Date.now()+90000);const w=worker({expiresAt});await w.run();
  assert.ok(w.options[0].TTL>0&&w.options[0].TTL<=90);assert.equal(w.payloads[0].expiresAt,expiresAt.toISOString());
});
test('successful delivery has a same-origin payload and guarded lock completion',async()=>{
  const w=worker();const result=await w.run();assert.equal(result.sent,1);assert.equal(w.sends,1);
  assert.equal(w.updates[0].args[1],'2026-10-20 12:00:00.123456+00');assert.match(w.updates[0].sql,/locked_at=\$2::timestamptz/);
});
test('gone subscription deactivates while provider outage queues a bounded retry',async()=>{
  const gone=worker({failure:410});assert.equal((await gone.run()).failed,1);assert.match(gone.updates[0].sql,/set active=false/);assert.equal(gone.updates[1].args[2],'Failed');
  const retry=worker({failure:503});assert.equal((await retry.run()).retried,1);assert.equal(retry.updates[0].args[2],'Pending');assert.equal(retry.updates[0].args[4],60);
});
test('device upsert never transfers another account endpoint',async()=>{
  const key=createECDH('prime256v1');key.setPrivateKey(Buffer.alloc(32,1));
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/device',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16).toString('base64url')}};
  const owned=worker();assert.equal(await owned.subscribe('owner',subscription),true);
  assert.equal(owned.updates[0].args[0],'owner');assert.match(owned.updates[0].sql,/where notification_push_subscription.person_id=excluded.person_id/);
  const other=worker({endpointOwned:false});assert.equal(await other.subscribe('other',subscription),false);
});
