import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const id='11111111-1111-4111-8111-111111111111';
function compile(path,deps){
  const exports={};const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports',source)(name=>deps[name]??require(name),exports);return exports;
}
function route({user=null,operator=false,exists=true}={}){
  const calls=[];
  const api=compile('../app/api/admin/people/notifications/route.ts',{
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},
    '@/lib/server/auth':{currentUser:async()=>user},
    '@/lib/server/maintenance':{isPlatformOperator:async()=>operator},
    '@/lib/server/db':{dbQuery:async(sql,args)=>{calls.push({sql,args});return {rows:exists?[{active:true,activeAccount:true,devices:2,preferences:{...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['announcement']}}]:[]};}},
    '@/lib/server/notifications':{notificationAccess:async()=>({eligible:true,config:policy.defaultNotificationConfig})},
    '@/lib/server/notification-push':{pushReadiness:()=>({ready:true,publicKey:'must-not-be-returned'})},
    '@/lib/notification-policy.mjs':policy
  });
  return {api,calls};
}
test('personal notification summary requires a real platform administrator before querying the person',async()=>{
  for(const [options,status] of [[{},401],[{user:{personId:id}},403]]){
    const r=route(options),response=await r.api.GET(new Request(`https://app.test/api?personId=${id}&testUser=admin`));
    assert.equal(response.status,status);assert.equal(r.calls.length,0);
  }
});
test('summary returns normalized preferences and device count without credentials or message content',async()=>{
  const r=route({user:{personId:id},operator:true});
  const response=await r.api.GET(new Request(`https://app.test/api?personId=${id}`));
  assert.equal(response.status,200);assert.equal(response.body.devices,2);assert.equal(response.body.pushReady,true);
  assert.equal(response.body.preferences.pushEnabled,true);assert.deepEqual(response.body.preferences.pushTypes,['announcement']);
  assert.equal(response.headers['Cache-Control'],'no-store');assert.deepEqual(r.calls[0].args,[id]);
  assert.doesNotMatch(JSON.stringify(response.body),/must-not-be-returned|endpoint|p256dh|auth|body|message/);
  assert.equal(r.api.PATCH,undefined);
});
test('invalid or missing people cannot expose notification data',async()=>{
  const r=route({user:{personId:id},operator:true});
  assert.equal((await r.api.GET(new Request('https://app.test/api?personId=invalid'))).status,400);assert.equal(r.calls.length,0);
  const missing=route({user:{personId:id},operator:true,exists:false});
  assert.equal((await missing.api.GET(new Request(`https://app.test/api?personId=${id}`))).status,404);
});
test('person summary is compact, read only and folds saved category preferences away',()=>{
  const data={eligible:false,enabled:true,activeAccount:true,preferences:policy.defaultNotificationPreferences,enabledTypes:policy.notificationTypes,devices:0,pushReady:true};
  let index=0;
  const component=compile('../components/admin-person-notifications.tsx',{'react':{useEffect(){},useState:()=>index++===0?[{personId:id,data,error:''},()=>{}]:[0,()=>{}]}});
  const html=require('react-dom/server').renderToStaticMarkup(component.AdminPersonNotifications({personId:id}));
  assert.match(html,/Outside the current notification rollout/);assert.match(html,/Alert types/);assert.match(html,/0 devices/);
  assert.match(html,/<details class=/);assert.doesNotMatch(html,/<details[^>]+open|<input|<select|<textarea/);
  const console=readFileSync(new URL('../components/admin-console.tsx',import.meta.url),'utf8');
  assert.match(console,/canManageLeagueChair \? <AdminPersonNotifications key=\{person.personId\} personId=\{person.personId\}/);
});

test('admin person summary shows only active alert types and omits retired or globally disabled rows',()=>{
 const data={eligible:true,enabled:true,activeAccount:true,preferences:policy.defaultNotificationPreferences,enabledTypes:['announcement','match_reminder','cup_draw'],devices:1,pushReady:true};
 let index=0;
 const component=compile('../components/admin-person-notifications.tsx',{'react':{useEffect(){},useState:()=>index++===0?[{personId:id,data,error:''},()=>{}]:[0,()=>{}]}});
 const html=require('react-dom/server').renderToStaticMarkup(component.AdminPersonNotifications({personId:id}));
 assert.match(html,/Announcements &amp; cup draws/);
 assert.doesNotMatch(html,/disabled globally|Match reminders|Ladder deadline|Fixture changes|Opponents published|Team publication deadlines|Ladder challenges|Match results/);
});
