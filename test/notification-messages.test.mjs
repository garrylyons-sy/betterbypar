import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const id='11111111-1111-4111-8111-111111111111';
function service({eligible=true,exists=true}={}){
 const calls=[],events=[];
 const query=async(sql,args)=>{calls.push({sql,args});return {rows:exists?[{id,title:'Title',body:'Body',event_key:`announcement:${id}`,read_at:'first-read',opened_at:'first-open',availableUntil:'2099-01-01'}]:[]};};
 const deps={'@/lib/server/db':{dbQuery:query,withTransaction:async fn=>{events.push('begin');try{const result=await fn({query});events.push('commit');return result;}catch(error){events.push('rollback');throw error;}}},'@/lib/server/notifications':{notificationAccess:async()=>({eligible,config:{retentionDays:10}}),syncAnnouncementReceipts:async(_client,person,rows)=>events.push(['sync',person,rows])}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/server/notification-messages.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',source)(name=>deps[name],exports);return {api:exports,calls,events};
}
test('specific message reads enforce recipient, lifetime and source expiry while allowing push-only rows',async()=>{
 const s=service();await s.api.loadRecipientMessage('recipient',id);
 const call=s.calls[0];assert.deepEqual(call.args,['recipient',`announcement:${id}`,10]);assert.match(call.sql,/person_id=\$1/);assert.match(call.sql,/created_at>now/);assert.match(call.sql,/expires_at>now/);assert.doesNotMatch(call.sql,/inbox_visible|update public/);
});
test('opened acknowledgement is monotonic, marks read and syncs durable history inside the transaction',async()=>{
 const s=service();const result=await s.api.recordMessageOpened('recipient',id);assert.equal(result.openedAt,'first-open');
 assert.match(s.calls[0].sql,/opened_at=coalesce\(opened_at,now\(\)\)/);assert.match(s.calls[0].sql,/read_at=coalesce/);
 assert.equal(s.events[0],'begin');assert.equal(s.events[1][0],'sync');assert.equal(s.events[1][1],'recipient');assert.equal(s.events[2],'commit');
});
test('unavailable, expired or ineligible messages never create a receipt',async()=>{
 const missing=service({exists:false});await assert.rejects(missing.api.recordMessageOpened('other',id),error=>error.status===404);assert.deepEqual(missing.events,['begin','rollback']);
 const denied=service({eligible:false});await assert.rejects(denied.api.loadRecipientMessage('recipient',id),error=>error.status===403);assert.equal(denied.calls.length,0);
});
