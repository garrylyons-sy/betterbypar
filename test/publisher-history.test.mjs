import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
class AnnouncementError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const id='11111111-1111-4111-8111-111111111111';
const serverSource=ts.transpileModule(fs.readFileSync(new URL('../lib/server/notification-announcements.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const serverExports={};new Function('require','exports',serverSource)(()=>({}),serverExports);
function service({owned=true,legacy=false,messageId=id}={}){
 const calls=[];
 const query=async(sql,args)=>{calls.push({sql,args});if(sql.includes('from public.notification_announcement where id='))return {rows:owned?[{id:messageId,title:'Title',body:'Message',audience:{},summary:{eligible:30,skipped:0},recipients:legacy?null:[{personId:id,name:'Saved recipient',inbox:true,push:false}]}]:[]};if(sql.includes('count(*)'))return {rows:[{total:30}]};return {rows:[{id,name:'Saved recipient',inbox:true,push:false}]};};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../lib/server/publisher-history.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',compiled)(name=>name==='@/lib/server/db'?{dbQuery:query}:{AnnouncementError,announcementDisplayBody:serverExports.announcementDisplayBody},exports);return {api:exports,calls};
}
test('Publisher history scopes count and page queries to the signed-in sender and bounds pages',async()=>{
 const s=service(),page=await s.api.loadPublisherHistory('sender','2');assert.equal(page.pageSize,10);assert.equal(page.page,2);
 for(const call of s.calls){assert.match(call.sql,/sender_person_id=\$1/);assert.equal(call.args[0],'sender');}
 assert.deepEqual(s.calls.at(-1).args,['sender',10,10]);
 await assert.rejects(s.api.loadPublisherHistory('sender','0'),/valid/);
});
test('another Publisher cannot read message contents or recipients by guessing the ID',async()=>{
 const s=service({owned:false});await assert.rejects(s.api.loadPublisherMessage('other',id,'1'),error=>error.status===404);
 assert.equal(s.calls.length,1);assert.match(s.calls[0].sql,/sender_person_id=\$2/);assert.deepEqual(s.calls[0].args,[id,'other']);
});
test('detail uses saved recipient snapshots and pages names/channels without current audience resolution',async()=>{
 const s=service(),detail=await s.api.loadPublisherMessage('sender',id,'2');assert.equal(detail.recipientPageSize,25);assert.equal(detail.recipientPage,2);assert.equal(detail.recipientSource,'snapshot');
 assert.equal(detail.recipients[0].name,'Saved recipient');assert.ok(s.calls.some(c=>c.sql.includes('jsonb_to_recordset')));assert.equal(s.calls.some(c=>c.sql.includes('from public.person')),false);
});
test('legacy details explicitly identify that recipient records may be incomplete',async()=>{
 const s=service({legacy:true}),detail=await s.api.loadPublisherMessage('sender',id,'1');assert.equal(detail.recipientSource,'legacy');
 assert.ok(s.calls.some(c=>c.sql.includes('from public.app_notification')));
});

test('legacy recipient lookup uses the canonical stored message UUID',async()=>{
 const messageId='abcdefab-abcd-abcd-abcd-abcdefabcdef',s=service({legacy:true,messageId});
 await s.api.loadPublisherMessage('sender',messageId.toUpperCase(),'1');
 for(const call of s.calls.filter(c=>c.sql.includes('from public.app_notification')))assert.equal(call.args[1],`announcement:${messageId}`);
});
