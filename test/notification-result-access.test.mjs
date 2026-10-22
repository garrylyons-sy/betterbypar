import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const id='11111111-1111-4111-8111-111111111111';
function route({user=null,eligible=true,roles=['League Chair'],recipient=true,rows=[{id,homeTeamScore:4,awayTeamScore:3}]}={}){
 const queries=[];
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/notifications':{notificationAccess:async()=>({eligible,roles,config:{...policy.defaultNotificationConfig,eligibleRoles:['League Chair','Manager']}}),matchResultRecipients:async()=>recipient?[id]:[]},'@/lib/notification-policy.mjs':policy,'@/lib/server/db':{dbQuery:async(sql,args)=>{queries.push({sql,args});return {rows};}}};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/notifications/result/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};new Function('require','exports',source)(name=>deps[name],api);return {api,queries};
}
test('result destination checks real authentication, current result audience and rollout before reading',async()=>{
 for(const [options,status] of [[{},401],[{user:{personId:id},roles:['Manager'],recipient:false},403],[{user:{personId:id},eligible:false},403]]){
  const r=route(options);assert.equal((await r.api.GET(new Request(`https://app.test/api?fixtureId=${id}&testUser=admin`))).status,status);assert.equal(r.queries.length,0);
 }
});
test('result destination is parameterized, returns only completed results and cannot cache them',async()=>{
 const r=route({user:{personId:id}});
 assert.equal((await r.api.GET(new Request('https://app.test/api?fixtureId=invalid'))).status,400);assert.equal(r.queries.length,0);
 const response=await r.api.GET(new Request(`https://app.test/api?fixtureId=${id}`));
 assert.equal(response.status,200);assert.equal(response.body.result.homeTeamScore,4);assert.equal(response.headers['Cache-Control'],'no-store');
 assert.deepEqual(r.queries[0].args,[id]);assert.match(r.queries[0].sql,/f\.status='Completed'/);
 const missing=route({user:{personId:id},rows:[]});assert.equal((await missing.api.GET(new Request(`https://app.test/api?fixtureId=${id}`))).status,404);
});

test('a manager in the result audience can open the exact result while unrelated managers cannot',async()=>{
 for(const [recipient,status] of [[true,200],[false,403]]){
 const r=route({user:{personId:id},roles:['Manager'],recipient});
 const response=await r.api.GET(new Request(`https://app.test/api?fixtureId=${id}`));
 assert.equal(response.status,status);
 assert.equal(r.queries.length,recipient?1:0);
 }
});
