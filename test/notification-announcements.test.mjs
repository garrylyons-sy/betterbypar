import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../lib/notification-policy.mjs';
import * as announcements from '../lib/announcement-policy.mjs';
const id='11111111-1111-4111-8111-111111111111';
const draft={title:'Notice',body:'Body',audience:{roles:[],clubId:null,teamId:null}};
function service(options={}){
 const events=[],calls=[];let saved=options.saved;
 const query=async(sql,args=[])=>{
 calls.push({sql,args});
 if(sql.startsWith("select concat_ws(' ',first_name,last_name)"))return {rows:[{name:'Real Sender'}]};
 if(options.failSnapshot&&sql.startsWith('update public.notification_announcement set recipients'))throw Error('snapshot failed');
 if(sql.startsWith('select count(*)::int as total'))return {rows:[{total:options.total??0}]};
 if(sql.includes('from public.notification_announcement where id='))return {rows:saved?[saved]:[]};
 if(sql.includes('as "personId"'))return {rows:options.rows??[{personId:id,roles:['League Chair'],preferences:{version:2,inboxTypes:['announcement'],pushTypes:['announcement'],pushEnabled:true},hasPush:true}]};
 if(sql.includes('insert into public.notification_announcement')){saved={id:args[0],senderPersonId:args[1],title:args[2],body:args[3],audience:JSON.parse(args[4]),summary:JSON.parse(args[5]),createdAt:'now'};return {rows:[saved]};}
 return {rows:[],rowCount:1};
 };
 const deps={
 '@/lib/server/db':{dbQuery:query,withTransaction:async cb=>{events.push('begin');try{const result=await cb({query});if(options.failCommit)throw Error('commit failed');events.push('commit');return result;}catch(e){events.push('rollback');throw e;}}},
 '@/lib/server/notifications':{loadNotificationConfig:async()=>({...policy.defaultNotificationConfig,enabledTypes:['announcement'],...options.config})},
 '@/lib/server/notification-dispatch':{scheduleNotificationPush:()=>events.push('dispatch')},
 '@/lib/announcement-policy.mjs':announcements
 };
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/server/notification-announcements.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',source)(name=>deps[name],exports);
 return {api:exports,events,calls,get saved(){return saved;}};
}
test('preview reports eligible recipients; send writes bulk inbox and outbox then dispatches only after commit',async()=>{
 const s=service(),preview=await s.api.previewAnnouncement(draft);
 assert.equal(preview.inbox,1);assert.equal(preview.push,1);
 const result=await s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:preview.previewToken});
 assert.equal(result.duplicate,false);assert.deepEqual(s.events,['begin','commit','dispatch']);
 const insert=s.calls.find(c=>c.sql.includes('insert into public.app_notification'));
 assert.match(insert.sql,/jsonb_to_recordset/);assert.match(insert.sql,/notification_push_delivery/);
 const recipients=JSON.parse(insert.args[0]);assert.deepEqual(recipients,[{personId:id,inbox:true,push:true}]);
});
test('stale previews, disabled categories and no reachable people never persist or dispatch',async()=>{
 for(const options of [{},{config:{enabled:false}},{rows:[]}]){
 const s=service(options);await assert.rejects(()=>s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:'outdated'}));
 assert.equal(s.calls.some(c=>c.sql.includes('insert into public.app_notification')),false);assert.equal(s.events.includes('dispatch'),false);
 }
});
test('same sender and draft retries return persisted record; conflicting reuse fails',async()=>{
 const saved={id,senderPersonId:id,...draft,summary:{inbox:1}},s=service({saved});
 assert.equal((await s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:'old'})).duplicate,true);
 assert.equal(s.events.includes('dispatch'),false);
 await assert.rejects(()=>s.api.sendAnnouncement(id,{...draft,title:'Changed',requestId:id,previewToken:'old'}),e=>e.status===409);
 await assert.rejects(()=>s.api.sendAnnouncement('another',{...draft,requestId:id,previewToken:'old'}),e=>e.status===409);
});
test('failed commit never dispatches',async()=>{
 const s=service({failCommit:true}),p=await s.api.previewAnnouncement(draft);
 await assert.rejects(()=>s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:p.previewToken}),/commit failed/);
 assert.deepEqual(s.events,['begin','rollback']);
});
function route({user=null,operator=false}={}){
 let operations=0;
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/maintenance':{isPlatformOperator:async()=>operator},'@/lib/server/notification-announcements':{AnnouncementError:class extends Error{},loadAnnouncementOptions:async()=>{operations++;return {clubs:[]};},loadAnnouncementHistory:async page=>{operations++;return {page};},loadAnnouncementDetail:async id=>{operations++;return {id};},previewAnnouncement:async()=>{operations++;return {matched:1};},sendAnnouncement:async()=>{operations++;return {duplicate:false};}}};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/admin/notifications/announcements/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',compiled)(name=>deps[name],exports);return {api:exports,get operations(){return operations;}};
}
test('API denies anonymous and nonoperators before reads and writes regardless testUser URL',async()=>{
 for(const [options,status] of [[{},401],[{user:{personId:id},operator:false},403]]){
 const r=route(options);assert.equal((await r.api.GET(new Request('https://example.test/api'))).status,status);
 assert.equal((await r.api.POST(new Request('https://example.test/api?testUser=admin',{method:'POST',body:JSON.stringify({action:'send',...draft})}))).status,status);
 assert.equal(r.operations,0);
 }
});
test('API permits real operator options and preview, rejects invalid action and malformed JSON',async()=>{
 const r=route({user:{personId:id},operator:true});assert.equal((await r.api.GET(new Request('https://example.test/api'))).status,200);
 assert.deepEqual((await r.api.POST(new Request('https://example.test/api',{method:'POST',body:JSON.stringify({action:'preview',...draft})}))).body,{preview:{matched:1}});
 for(const body of ['{','{"action":"other"}'])assert.equal((await r.api.POST(new Request('https://example.test/api',{method:'POST',body}))).status,400);
});
test('send recomputes preference and subscription reachability instead of trusting preview',async()=>{
 const options={rows:[{personId:id,roles:['League Chair'],preferences:{version:2,inboxTypes:['announcement'],pushTypes:['announcement'],pushEnabled:true},hasPush:true}]};
 const s=service(options),p=await s.api.previewAnnouncement(draft);
 options.rows[0].hasPush=false;
 await assert.rejects(()=>s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:p.previewToken}),e=>e.status===409);
 assert.equal(s.calls.some(c=>c.sql.includes('insert into public.app_notification')),false);
 const fresh=await s.api.previewAnnouncement(draft);assert.equal(fresh.inbox,1);assert.equal(fresh.push,0);
 await s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:fresh.previewToken});
 const insert=s.calls.find(c=>c.sql.includes('insert into public.app_notification'));
 assert.deepEqual(JSON.parse(insert.args[0]),[{personId:id,inbox:true,push:false}]);
});
test('history preserves announcements whose sender was deleted and labels the former administrator',async()=>{
 const s=service();await s.api.loadAnnouncementHistory('1');
 const history=s.calls.find(c=>c.sql.includes('from public.notification_announcement a'));
 assert.match(history.sql,/left join public.person p/);
 assert.match(history.sql,/Former administrator/);
});
test('audience options do not eagerly load history, message bodies or detail',async()=>{
 const s=service();await s.api.loadAnnouncementOptions();
 assert.equal(s.calls.some(c=>c.sql.includes('notification_announcement')),false);
});
test('sent history is bounded to ten rows, uses stable ordering and validates pagination',async()=>{
 const s=service();const result=await s.api.loadAnnouncementHistory('1');
 assert.equal(result.pageSize,10);
 const list=s.calls.find(c=>c.sql.includes('from public.notification_announcement a'));
 assert.doesNotMatch(list.sql,/a\.body|a\.audience/);
 assert.match(list.sql,/order by a\.created_at desc,a\.id desc/);
 assert.match(list.sql,/limit \$1 offset \$2/);
 assert.deepEqual(list.args,[10,0]);
 for(const page of ['0','-1','1.5','no','1000000000000000000'])await assert.rejects(()=>s.api.loadAnnouncementHistory(page),e=>e.status===400);
});
test('message details validate IDs and return a missing message as 404',async()=>{
 const s=service();await assert.rejects(()=>s.api.loadAnnouncementDetail('invalid'),e=>e.status===400);
 await assert.rejects(()=>s.api.loadAnnouncementDetail(id),e=>e.status===404);
});
test('club role filters require role assignment in that club; team roles also require selected team',()=>{
 const s=service(),sql=s.api.announcementAudienceSql;
 assert.match(sql,/a\.role='Administrator' or \$1::uuid is null or a\.club_id=\$1/);
 assert.match(sql,/a\.role not in \('Manager','Player'\) or \$2::uuid is null or a\.team_id=\$2/);
});

test('history clamps pages to available results and applies the offset on the server',async()=>{
 const s=service({total:23});const result=await s.api.loadAnnouncementHistory('99');
 assert.equal(result.page,3);assert.equal(result.totalPages,3);assert.equal(result.total,23);
 assert.deepEqual(s.calls.find(c=>c.sql.includes('from public.notification_announcement a')).args,[10,20]);
});
test('history and detail GET views require the same real operator authorization as sending',async()=>{
 for(const view of ['history&page=2','detail&id='+id]){
  for(const [options,status] of [[{},401],[{user:{personId:id},operator:false},403]]){
   const r=route(options);assert.equal((await r.api.GET(new Request('https://example.test/api?view='+view))).status,status);assert.equal(r.operations,0);
  }
 }
 const r=route({user:{personId:id},operator:true});
 assert.deepEqual((await r.api.GET(new Request('https://example.test/api?view=history&page=2'))).body,{page:'2'});
 assert.deepEqual((await r.api.GET(new Request('https://example.test/api?view=detail&id='+id))).body,{announcement:{id}});
 assert.equal((await r.api.GET(new Request('https://example.test/api?view=unknown'))).status,400);
});

test('publisher send rechecks permission inside the transaction before persisting or dispatching',async()=>{
 const s=service(),preview=await s.api.previewAnnouncement(draft);
 await assert.rejects(s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:preview.previewToken},async()=>{throw Error('Publisher access revoked');}),/revoked/);
 assert.deepEqual(s.events,['begin','rollback']);assert.equal(s.calls.some(c=>c.sql.includes('insert into public.notification_announcement')),false);
});

test('recipient snapshots are written in the same send transaction and snapshot failure cannot dispatch',async()=>{
 const s=service(),preview=await s.api.previewAnnouncement(draft);
 await s.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:preview.previewToken});
 const snapshot=s.calls.find(c=>c.sql.startsWith('update public.notification_announcement set recipients'));
 assert.equal(snapshot.args[0],id);assert.match(snapshot.sql,/concat_ws/);assert.match(snapshot.sql,/r\.inbox/);assert.match(snapshot.sql,/r\.push/);
 const failing=service({failSnapshot:true}),checked=await failing.api.previewAnnouncement(draft);
 await assert.rejects(failing.api.sendAnnouncement(id,{...draft,requestId:id,previewToken:checked.previewToken}),/snapshot failed/);
 assert.deepEqual(failing.events,['begin','rollback']);assert.equal(failing.calls.some(c=>c.sql.includes('insert into public.app_notification')),false);
});

test('sender footer uses the authenticated sender identity and opt-out leaves notification text unchanged',async()=>{
 for(const includeSender of [true,false]){
 const s=service(),input={...draft,audience:{...draft.audience,includeSender,senderFooter:'Sent by Spoof'}};
 const preview=await s.api.previewAnnouncement(input);await s.api.sendAnnouncement(id,{...input,requestId:id,previewToken:preview.previewToken});
 const notification=s.calls.find(call=>call.sql.includes('insert into public.app_notification'));
 assert.equal(notification.args[2],includeSender?'Body\n\nSent by Real Sender':'Body');
 assert.equal(s.saved.audience.senderFooter,includeSender?'Sent by Real Sender':null);
 }
});

test('full 2000-character body is retained while the sender footer is appended outside the message allowance',async()=>{
 const s=service(),input={...draft,body:'x'.repeat(2000)},preview=await s.api.previewAnnouncement(input);
 await s.api.sendAnnouncement(id,{...input,requestId:id,previewToken:preview.previewToken});
 assert.equal(s.saved.body.length,2000);
 assert.equal(s.calls.find(c=>c.sql.includes('insert into public.app_notification')).args[2],'x'.repeat(2000)+'\n\nSent by Real Sender');
});
