import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
class MessageAccessError extends Error{constructor(message,status=404){super(message);this.status=status;}}
function route({signedIn=true,allowed=true}={}){
 const calls=[],deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>signedIn?{personId:'owner'}:null},'@/lib/server/notification-messages':{MessageAccessError,loadRecipientMessage:async(...args)=>{calls.push(['load',...args]);if(!allowed)throw new MessageAccessError('Message unavailable.');return {id:'message'};},recordMessageOpened:async(...args)=>{calls.push(['open',...args]);if(!allowed)throw new MessageAccessError('Message unavailable.');return {openedAt:'now'};}}};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/notifications/message/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',compiled)(name=>deps[name],exports);return {api:exports,calls};
}
const request=()=>new Request('https://app.test/api/notifications/message?id=message&personId=other&testUser=admin');
test('receiver message GET never marks opened and binds to the actual signed-in recipient',async()=>{
 const r=route();assert.equal((await r.api.GET(request())).status,200);assert.deepEqual(r.calls,[['load','owner','message']]);
 assert.equal((await r.api.POST(request())).status,200);assert.deepEqual(r.calls[1],['open','owner','message']);
});
test('receiver message API denies anonymous and inaccessible messages without contents or receipts',async()=>{
 for(const [config,status] of [[{signedIn:false},401],[{allowed:false},404]]){
 const r=route(config);assert.equal((await r.api.GET(request())).status,status);assert.equal((await r.api.POST(request())).status,status);
 }
});
