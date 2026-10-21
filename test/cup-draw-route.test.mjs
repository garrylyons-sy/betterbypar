import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function route({user=null,admin=false}={}){
 const changes=[],audit=[];
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/cup-draw-workflow':{changeCupDraw:async(...args)=>changes.push(args)},'@/lib/server/db':{dbQuery:async()=>({rowCount:admin?1:0}),withTransaction:async fn=>fn({query:async(...args)=>audit.push(args)})}};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/admin/cup-competitions/[competitionId]/draw/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};new Function('require','exports',compiled)(name=>deps[name],api);return {api,changes,audit};
}
const id='11111111-1111-4111-8111-111111111111';
const request=()=>new Request('https://app.test/api/draw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',attemptId:'attempt-2',witnessName:'Pat'})});
test('cup draw route rejects unauthenticated and non-admin users before any mutation',async()=>{
 for(const [config,status] of [[{},401],[{user:{personId:'player'}},403]]){
  const r=route(config);assert.equal((await r.api.POST(request(),{params:Promise.resolve({competitionId:id})})).status,status);assert.equal(r.changes.length,0);assert.equal(r.audit.length,0);
 }
});
test('cup draw route passes the exact attempt and witness to the transaction and audits the action',async()=>{
 const r=route({user:{personId:'chair'},admin:true});const response=await r.api.POST(request(),{params:Promise.resolve({competitionId:id})});
 assert.equal(response.status,200);assert.equal(r.changes[0][1],id);assert.equal(r.changes[0][2],'chair');assert.deepEqual(r.changes[0][3],{action:'confirm',attemptId:'attempt-2',witnessName:'Pat'});assert.deepEqual(r.audit[0][1],['chair',id,'confirm','attempt-2']);
});
