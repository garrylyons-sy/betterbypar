import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnnouncementDraft,announcementSelection,announcementPreviewToken} from '../lib/announcement-policy.mjs';
import {defaultNotificationConfig} from '../lib/notification-policy.mjs';
const draft={title:' Notice ',body:' Body ',audience:{roles:['Manager','Player','Manager'],clubId:null,teamId:null}};
test('normalizes draft and rejects invalid roles, IDs, missing club, empty and oversized content',()=>{
 assert.deepEqual(validateAnnouncementDraft(draft),{title:'Notice',body:'Body',audience:{includeSender:true,roles:['Manager','Player'],clubId:null,teamId:null}});
 for(const change of [{title:''},{body:'x'.repeat(2001)},{audience:{roles:['Bad'],clubId:null,teamId:null}},{audience:{roles:[],clubId:'bad',teamId:null}},{audience:{roles:[],clubId:null,teamId:'11111111-1111-4111-8111-111111111111'}}])assert.throws(()=>validateAnnouncementDraft({...draft,...change}));
});
test('selection honors pilot, category and each channel preference and subscription',()=>{
 const config={...defaultNotificationConfig,enabledTypes:['announcement']};
 const rows=[{personId:'a',roles:['Player'],preferences:{}},{personId:'b',roles:['League Chair'],preferences:{version:2,inboxTypes:[],pushTypes:['announcement'],pushEnabled:true},hasPush:true},{personId:'c',roles:['League Chair'],preferences:{version:2,inboxTypes:[],pushTypes:[],pushEnabled:false}}];
 const selection=announcementSelection(rows,config);
 assert.deepEqual(selection.summary,{matched:3,eligible:2,excluded:1,inbox:0,push:1,skipped:1,enabled:true,announcementsEnabled:true});
 assert.deepEqual(selection.recipients,[{personId:'b',inbox:false,push:true}]);
 assert.equal(announcementSelection(rows,{...config,enabled:false}).recipients.length,0);
 assert.equal(announcementSelection(rows,{...config,enabledTypes:[]}).recipients.length,0);
});
test('preview tokens are stable under ordering but change with draft, policy or delivery decisions',()=>{
 const d=validateAnnouncementDraft(draft),config={...defaultNotificationConfig,enabledTypes:['announcement']};
 const a=[{personId:'b',inbox:true,push:false},{personId:'a',inbox:false,push:true}];
 const token=announcementPreviewToken(d,a,config);
 assert.equal(token,announcementPreviewToken(d,[...a].reverse(),config));
 assert.notEqual(token,announcementPreviewToken({...d,title:'Other'},a,config));
 assert.notEqual(token,announcementPreviewToken(d,a,{...config,quietStart:'21:00'}));
 assert.notEqual(token,announcementPreviewToken(d,[{...a[0],push:true},a[1]],config));
});

test('publisher drafts retain specific people and delivery choices and reject empty or invalid selections',()=>{
 const person='11111111-1111-4111-8111-111111111111';
 const input={...draft,audience:{...draft.audience,personIds:[person,person],channels:['inbox']}};
 const result=validateAnnouncementDraft(input);assert.deepEqual(result.audience.personIds,[person]);assert.deepEqual(result.audience.channels,['inbox']);
 for(const audience of [{channels:[]},{channels:['email']},{personIds:[]},{personIds:['bad']}])assert.throws(()=>validateAnnouncementDraft({...draft,audience:{...draft.audience,...audience}}));
 const config={...defaultNotificationConfig,enabledTypes:['announcement']};
 const rows=[{personId:person,roles:['League Chair'],preferences:{version:4,inboxTypes:['announcement'],pushTypes:['announcement'],pushEnabled:true},hasPush:true},{personId:'other',roles:['League Chair'],preferences:{}}];
 const selected=announcementSelection(rows,config,result.audience);
 assert.deepEqual(selected.recipients,[{personId:person,inbox:true,push:false}]);assert.equal(selected.summary.matched,1);
 assert.deepEqual(announcementSelection(rows,config,{personIds:[person],channels:['push']}).recipients,[{personId:person,inbox:false,push:true}]);
});

test('sender attribution defaults on, permits opting out, and ignores client-supplied signature text',()=>{
 const normalized=validateAnnouncementDraft(draft);assert.equal(normalized.audience.includeSender,true);
 assert.equal(validateAnnouncementDraft({...draft,audience:{...draft.audience,includeSender:false}}).audience.includeSender,false);
 assert.equal(validateAnnouncementDraft({...draft,audience:{...draft.audience,senderFooter:'Sent by someone else'}}).audience.senderFooter,undefined);
 assert.throws(()=>validateAnnouncementDraft({...draft,audience:{...draft.audience,includeSender:'yes'}}));
});
