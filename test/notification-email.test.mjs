import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as policy from '../lib/notification-policy.mjs';

const compile = path => ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
const source = compile('../lib/server/notification-email.ts');
const emailHelpers = {};
vm.runInNewContext(compile('../lib/server/email.ts'),{exports:emailHelpers,process:{env:{APP_URL:'https://club.example'}}});
function worker({eligible=true,sourceCurrent=true,preferences={},config={},job={},address='current@example.com',providerStatus='Sent',providerThrows=false,env={},database}={}) {
  const updates=[],payloads=[],accessCalls=[],sourceCalls=[],queries=[];
  const delivery={id:'delivery',notification_id:'notification',person_id:'person',type:'lesson_reminder',title:'Your lesson',body:'Practice <putting> & "pace"\nThen <script>alert(1)</script>',href:'/?section=lessons&booking=booking-123',expires_at:null,attempts:1,lock_token:'2026-10-26 12:00:00.123456+00',...job};
  const state={eligible,sourceCurrent,address,preferences:{...policy.defaultNotificationPreferences,inboxTypes:[],pushTypes:[],pushEnabled:false,emailEnabled:true,emailTypes:['lesson_reminder'],...preferences},config:{...policy.defaultNotificationConfig,quietStart:'00:00',quietEnd:'00:00',...config}};
  const dbQuery=async(sql,args=[])=>{
    queries.push({sql,args});
    if(sql.startsWith('update public.notification_email_delivery')) updates.push({sql,args});
    if(database)return database.query(sql,args);
    if(sql.includes('with due as'))return {rows:[delivery]};
    if(sql.includes('select p.email'))return {rows:state.address?[{email:state.address}]:[]};
    return {rows:[],rowCount:1};
  };
  const dependencies={
    '@/lib/server/db':{dbQuery},
    '@/lib/server/notifications':{
      notificationAccess:async personId=>{accessCalls.push(personId);return {eligible:state.eligible,roles:['Club Member'],preferences:state.preferences,config:state.config};},
      notificationSourceIsCurrent:async(...args)=>{sourceCalls.push(args);return state.sourceCurrent;}
    },
    '@/lib/notification-policy.mjs':policy,
    '@/lib/server/email':{...emailHelpers,sendAppEmail:async payload=>{payloads.push(payload);if(providerThrows)throw Error('Provider unavailable');return {status:providerStatus};}}
  };
  const exports={};
  vm.runInNewContext(source,{exports,require:id=>{assert.ok(dependencies[id],`Unexpected dependency ${id}`);return dependencies[id];},process:{env:{RESEND_API_KEY:'test-only',EMAIL_FROM:'club@example.com',...env}},Date,URL});
  return {run:exports.processNotificationEmail,state,updates,payloads,accessCalls,sourceCalls,queries};
}

test('email opt-outs and revoked access skip queued work without contacting a provider',async()=>{
  for(const options of [{preferences:{emailEnabled:false}},{preferences:{emailTypes:[]}},{eligible:false},{sourceCurrent:false},{address:null},{job:{expires_at:new Date(Date.now()-1000)}}]){
    const w=worker(options);const result=await w.run();assert.equal(result.skipped,1);assert.equal(w.payloads.length,0);assert.equal(w.updates[0].args[2],'Skipped');
  }
});
test('email-only recipients can receive alerts after reading the app notification',async()=>{
  const w=worker({job:{read_at:new Date(),readAt:new Date()}});
  assert.equal((await w.run()).sent,1);assert.equal(w.payloads.length,1);
});
test('queued work reevaluates live preferences, access, source retention and recipient address',async()=>{
  const w=worker();
  w.state.preferences.emailEnabled=false;
  assert.equal((await w.run()).skipped,1);assert.equal(w.payloads.length,0);
  w.state.preferences.emailEnabled=true;w.state.address='updated@example.com';
  assert.equal((await w.run()).sent,1);assert.equal(w.payloads[0].to,'updated@example.com');
  assert.deepEqual(w.accessCalls,['person','person']);
  assert.equal(w.sourceCalls.length,1);assert.equal(w.sourceCalls[0][0],'notification');assert.equal(w.sourceCalls[0][1],'person');assert.equal(w.sourceCalls[0][4],policy.defaultNotificationConfig.retentionDays);
  w.state.sourceCurrent=false;
  assert.equal((await w.run()).skipped,1);assert.equal(w.payloads.length,1);
});
test('provider failures retry with a bounded attempt budget, including thrown failures',async()=>{
  for(const provider of [{providerStatus:'Failed'},{providerStatus:'Queued'},{providerThrows:true}]){
    for(const attempts of [1,5]){
      const w=worker({...provider,job:{attempts}});const result=await w.run();
      assert.equal(result[attempts===5?'failed':'retried'],1);
      assert.equal(w.updates[0].args[2],attempts===5?'Failed':'Pending');
      assert.equal(w.updates[0].args[3],'Email delivery failed');assert.equal(w.updates[0].args[4],300);
    }
  }
});
test('retries preserve provider idempotency, escaped content and the exact booking link',async()=>{
  const w=worker();await w.run();await w.run();
  const [first,second]=w.payloads;
  assert.equal(first.idempotencyKey,'notification-notification');assert.equal(second.idempotencyKey,first.idempotencyKey);
  assert.equal(first.html,'<p>Practice &lt;putting&gt; &amp; &quot;pace&quot;<br>Then &lt;script&gt;alert(1)&lt;/script&gt;</p><p><a href="https://club.example/?section=lessons&amp;booking=booking-123">View details</a></p>');
  assert.ok(first.text.endsWith('View details: https://club.example/?section=lessons&booking=booking-123'));
  assert.equal(w.updates[0].args[1],'2026-10-26 12:00:00.123456+00');
});
test('unsafe links remain on the application origin',async()=>{
  for(const href of ['//evil.example/path','https://evil.example/path','/\\evil.example/path']){
    const w=worker({job:{href}});await w.run();assert.ok(w.payloads[0].text.endsWith('View details: https://club.example/'));
  }
});
test('local demo and missing email configuration never claim work or contact providers',async()=>{
  for(const env of [{LOCAL_DEMO:'1'},{RESEND_API_KEY:''},{EMAIL_FROM:''}]){
    const w=worker({env});const result=await w.run();assert.equal(result.emailReady,false);assert.equal(result.claimed,0);assert.equal(w.queries.length,0);assert.equal(w.payloads.length,0);
  }
});
test('quiet-hour deferral executes claim and completion SQL without consuming an attempt',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create table app_notification(id text primary key,person_id text,type text,title text,body text,href text,expires_at timestamptz);
      create table notification_email_delivery(id text primary key,notification_id text,status text,available_at timestamptz default now(),attempts integer default 0,locked_at timestamptz,last_error text,sent_at timestamptz);
      insert into app_notification values('notification','person','lesson_reminder','Lesson','Soon','/?section=lessons',null);
      insert into notification_email_delivery(id,notification_id,status,attempts) values('delivery','notification','Pending',4);`);
    // A 23-hour quiet window that always contains the current Dublin minute.
    const local=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',hour:'2-digit',hourCycle:'h23'}).format(new Date());
    const quietStart=`${local}:00`,quietEnd=`${String((Number(local)+23)%24).padStart(2,'0')}:00`;
    const w=worker({database:db,config:{quietStart,quietEnd}});const result=await w.run();
    assert.equal(result.retried,1);assert.equal(w.payloads.length,0);
    const row=(await db.query('select status,attempts,last_error,locked_at,available_at>now() as deferred from notification_email_delivery')).rows[0];
    assert.deepEqual(row,{status:'Pending',attempts:4,last_error:null,locked_at:null,deferred:true});
    assert.equal((await w.run()).claimed,0);
  }finally{await db.close();}
});
