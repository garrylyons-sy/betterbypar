import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const comp='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222';
function setup({user=null,admin=false,fail=false,duplicate=false}={}){
 const calls=[],order=[];
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/db':{dbQuery:async()=>({rowCount:admin?1:0}),withTransaction:async fn=>{const result=await fn({query(){}});if(fail)throw new Error('Commit failed');order.push('commit');return result;}},'@/lib/server/notification-dispatch':{scheduleNotificationPush:()=>order.push('push')},'@/lib/server/cup-draw-resend':{cupDrawSendOptions:async(...args)=>{calls.push(args);return {people:[]};},previewCupDrawSend:async(...args)=>{calls.push(args);return {summary:{notified:1},recipients:[{personId:'private'}],audience:{groups:['chairs']},previewToken:'token'};},sendCupDrawNotification:async(...args)=>{calls.push(args);return {summary:{push:1},duplicate};}}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../app/api/admin/cup-competitions/[competitionId]/draw-notifications/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,api={};new Function('require','exports',source)(name=>deps[name],api);return {api,calls,order};
}
const context={params:Promise.resolve({competitionId:comp})};
const request=action=>new Request('https://app.test/api',{method:'POST',body:JSON.stringify({action,attemptId:attempt,audience:{groups:['chairs']},requestId:'id',previewToken:'token'})});
test('manual draw notification options, preview and send require authenticated administrator',async()=>{
 for(const [options,status] of [[{},401],[{user:{personId:'player'}},403]]){
  const r=setup(options);
  assert.equal((await r.api.GET(new Request(`https://app.test/api?attemptId=${attempt}`),context)).status,status);
  for(const action of ['preview','send'])assert.equal((await r.api.POST(request(action),context)).status,status);
  assert.equal(r.calls.length,0);
 }
});
test('preview is non-delivering and never returns internal recipient records',async()=>{
 const r=setup({user:{personId:'admin'},admin:true}),response=await r.api.POST(request('preview'),context);
 assert.equal(response.status,200);assert.equal(response.body.preview.previewToken,'token');assert.equal(response.body.preview.recipients,undefined);assert.deepEqual(r.order,['commit']);
 assert.equal(response.headers['Cache-Control'],'no-store');
});
test('send dispatch occurs after commit, with no delivery on rollback or duplicate retry',async()=>{
 for(const [config,want] of [[{},['commit','push']],[{fail:true},[]],[{duplicate:true},['commit']]]){
 const r=setup({user:{personId:'admin'},admin:true,...config});
 const response=await r.api.POST(request('send'),context);assert.equal(response.status,config.fail?400:200);assert.deepEqual(r.order,want);
 assert.equal(r.calls[0][1],comp);assert.equal(r.calls[0][2],attempt);assert.equal(r.calls[0][3],'admin');
 }
});
