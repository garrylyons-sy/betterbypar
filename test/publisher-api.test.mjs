import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {validateAnnouncementDraft} from '../lib/announcement-policy.mjs';
class AnnouncementError extends Error{constructor(message,status){super(message);this.status=status;}}
function route({signedIn=true,publisher=true}={}){
 const calls=[];
 const deps={'@/lib/server/publisher-history':{loadPublisherHistory:async(...args)=>{calls.push(['history',...args]);return {items:[]};},loadPublisherMessage:async(...args)=>{calls.push(['detail',...args]);throw new AnnouncementError('Message not found.',404);}},'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>signedIn?{personId:'sender'}:null},'@/lib/server/publisher':{requirePublisher:async id=>{calls.push(['authorize',id]);if(!publisher)throw new AnnouncementError('Publisher access required.',403);},loadPublisherPeople:async()=>{calls.push(['people']);return [{id:'person',name:'Person'}];}},'@/lib/server/notification-announcements':{AnnouncementError,loadAnnouncementOptions:async()=>({enabled:true}),previewAnnouncement:async input=>{calls.push(['preview']);validateAnnouncementDraft(input);return {previewToken:'token'};},sendAnnouncement:async(id,input,authorize)=>{await authorize({});calls.push(['send',id,input]);return {announcement:{id:'message'}};}}};
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL('../app/api/publisher/messages/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(name=>deps[name],exports);return {api:exports,calls};
}
const draft={title:'Hi',body:'Message',audience:{roles:[],clubId:null,teamId:null}};
const request=body=>new Request('https://app.test/api/publisher/messages?testUser=admin',{method:'POST',body:JSON.stringify(body)});
test('publisher API denies anonymous people and non-Publishers before audience data or sends',async()=>{
 for(const [config,status] of [[{signedIn:false},401],[{publisher:false},403]]){
  const r=route(config);assert.equal((await r.api.GET()).status,status);assert.equal((await r.api.POST(request({...draft,action:'send'}))).status,status);assert.equal(r.calls.some(c=>c[0]==='people'||c[0]==='send'),false);
 }
});
test('publisher API supports options, validates message length and uses the signed-in sender',async()=>{
 const r=route();assert.equal((await r.api.GET()).status,200);
 assert.equal((await r.api.POST(request({...draft,body:'x'.repeat(2001),action:'preview'}))).status,400);
 assert.equal((await r.api.POST(request({...draft,action:'preview'}))).status,200);
 assert.equal((await r.api.POST(request({...draft,action:'send',personId:'another'}))).status,200);
 assert.equal(r.calls.find(c=>c[0]==='send')[1],'sender');assert.equal(r.calls.filter(c=>c[0]==='authorize').length,5);
});

test('Publisher history and details bind ownership to currentUser, ignoring supplied sender IDs',async()=>{
 const r=route();const base='https://app.test/api/publisher/messages?personId=other&';
 assert.equal((await r.api.GET(new Request(base+'view=history&page=2'))).status,200);
 assert.equal((await r.api.GET(new Request(base+'view=detail&id=message&recipientPage=3'))).status,404);
 assert.deepEqual(r.calls.find(call=>call[0]==='history'),['history','sender','2']);
 assert.deepEqual(r.calls.find(call=>call[0]==='detail'),['detail','sender','message','3']);
 assert.equal((await r.api.GET(new Request(base+'view=invalid'))).status,400);
});
