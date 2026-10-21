import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const id='11111111-1111-4111-8111-111111111111';
function route({user=null,eligible=true}={}){
 const deleted=[];const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/notifications':{notificationAccess:async()=>({eligible}),dismissNotification:async(...args)=>{deleted.push(args);return [id];}}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../app/api/notifications/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};new Function('require','exports',source)(name=>deps[name],api);return {api,deleted};
}
const request=body=>new Request('https://app.test/api/notifications',{method:'DELETE',body:JSON.stringify(body)});
test('notification removal requires real authentication, inbox access and one valid notification ID',async()=>{
 for(const [config,body,status] of [[{},{id},401],[{user:{personId:'owner'},eligible:false},{id},403],[{user:{personId:'owner'}},{all:true},400],[{user:{personId:'owner'}},{id:'invalid'},400]]){
 const r=route(config);assert.equal((await r.api.DELETE(request(body))).status,status);assert.equal(r.deleted.length,0);
 }
});
test('notification removal uses the signed-in owner and is safe to repeat',async()=>{
 const r=route({user:{personId:'owner'}});
 for(let n=0;n<2;n++)assert.equal((await r.api.DELETE(request({id,personId:'somebody-else'}))).status,200);
 assert.deepEqual(r.deleted,[['owner',id],['owner',id]]);
});

test('delete all read is explicit, owner-scoped and rejects mixed or broad delete requests',async()=>{
 const r=route({user:{personId:'owner'}});
 const response=await r.api.DELETE(request({allRead:true,personId:'other'}));
 assert.equal(response.status,200);assert.deepEqual(r.deleted,[['owner',undefined]]);assert.deepEqual(response.body.ids,[id]);
 for(const body of [{all:true},{allRead:false},{allRead:true,id},{allRead:'true'},null])assert.equal((await r.api.DELETE(request(body))).status,400);
});
