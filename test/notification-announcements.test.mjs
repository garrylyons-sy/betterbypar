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
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/maintenance':{isPlatformOperator:async()=>operator},'@/lib/server/notification-announcements':{AnnouncementError:class extends Error{},loadAnnouncementOptions:async()=>{operations++;return {clubs:[]};},previewAnnouncement:async()=>{operations++;return {matched:1};},sendAnnouncement:async()=>{operations++;return {duplicate:false};}}};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/admin/notifications/announcements/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',compiled)(name=>deps[name],exports);return {api:exports,get operations(){return operations;}};
}
test('API denies anonymous and nonoperators before reads and writes regardless testUser URL',async()=>{
 for(const [options,status] of [[{},401],[{user:{personId:id},operator:false},403]]){
 const r=route(options);assert.equal((await r.api.GET()).status,status);
 assert.equal((await r.api.POST(new Request('https://example.test/api?testUser=admin',{method:'POST',body:JSON.stringify({action:'send',...draft})}))).status,status);
 assert.equal(r.operations,0);
 }
});
test('API permits real operator options and preview, rejects invalid action and malformed JSON',async()=>{
 const r=route({user:{personId:id},operator:true});assert.equal((await r.api.GET()).status,200);
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
 const s=service();await s.api.loadAnnouncementOptions();
 const history=s.calls.find(c=>c.sql.includes('from public.notification_announcement a'));
 assert.match(history.sql,/left join public.person p/);
 assert.match(history.sql,/Former administrator/);
});
test('club role filters require role assignment in that club; team roles also require selected team',()=>{
 const s=service(),sql=s.api.announcementAudienceSql;
 assert.match(sql,/a\.role='Administrator' or \$1::uuid is null or a\.club_id=\$1/);
 assert.match(sql,/a\.role not in \('Manager','Player'\) or \$2::uuid is null or a\.team_id=\$2/);
});
