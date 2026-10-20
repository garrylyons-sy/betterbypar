import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import test from 'node:test';
const path=new URL('../components/admin-notification-composer.tsx',import.meta.url);
const source=existsSync(path) ? readFileSync(path,'utf8') : '';
test('composer supplies intersecting role and club/team audience controls and plain text preview',()=>{
  assert.match(source,/roles: \[\]/);
  assert.match(source,/team\.clubId === draft\.audience\.clubId/);
  assert.match(source,/team\.league/);
  assert.match(source,/team\.season/);
  assert.match(source,/maxLength=\{120\}/);
  assert.match(source,/maxLength=\{2000\}/);
  assert.match(source,/\{draft\.body\}/);
  assert.doesNotMatch(source,/dangerouslySetInnerHTML|window\.confirm|testUser/);
});
test('preview and sends lock immediately, edits reset preview, retries preserve request identity',()=>{
  assert.match(source,/if \(busyRef\.current\) return/);
  assert.match(source,/busyRef\.current = true/);
  assert.match(source,/setPreview\(null\)/);
  assert.match(source,/requestId\.current = null/);
  assert.match(source,/requestId\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(source,/previewToken: preview\.previewToken/);
  assert.match(source,/disabled=\{busy\}/);
  assert.match(source,/Send to \{recipientCount\} recipient/);
  assert.match(source,/response\.status === 409/);
});
test('shows pilot exclusions, opted out recipients, disabled states and actual send history',()=>{
  for(const text of ['League Chair','Excluded by rollout','Opted out / no enabled channel','Notifications are disabled','Announcements are disabled']) assert.ok(source.includes(text),text);
  for(const field of ['matched','eligible','excluded','inbox','push','skipped']) assert.ok(source.includes(`counts.${field}`),field);
  assert.match(source,/data\.announcement/);
  const settings=readFileSync(new URL('../components/admin-notifications.tsx',import.meta.url),'utf8');
  assert.match(settings,/onSent=/);
  assert.match(settings,/historyOpen &&/);
  assert.match(settings,/settingsLoaded &&/);
});

// Small hook harness exercises the client component with mocked HTTP; no real sends.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const React=require('react');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(post) {
  let sentCount=0;
  const hooks=[];let index=0;let effect;
  const hookReact={
    useState(initial){const i=index++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];},
    useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},
    useEffect(fn){index++;effect ??= fn;}
  };
  const exports={};
  const requests=[];
  const fetch=async(url,init)=>{
    if(!init?.method)return {ok:true,json:async()=>({clubs:[{id:'club',name:'Club'}],teams:[],history:[],eligibleRoles:['League Chair'],enabled:true,announcementsEnabled:true})};
    const payload=JSON.parse(init.body);requests.push(payload);return post(payload,requests.length);
  };
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const customRequire=name=>name==='react'?hookReact:name==='@/components/ui/button'?{Button:props=>React.createElement('button',props)}:name==='@/lib/notification-policy.mjs'?{notificationRoles:['Player','League Chair']}:require(name);
  new Function('require','exports','fetch','window','crypto',compiled)(customRequire,exports,fetch,{addEventListener(){},removeEventListener(){}},{randomUUID:()=>`request-${Math.random()}`});
  const render=()=>{index=0;return exports.AdminNotificationComposer({onMessage(){},onSent(){sentCount++;}});};
  function all(tree,predicate,result=[]) {
    if(Array.isArray(tree)){for(const child of tree)all(child,predicate,result);return result;}
    if(!tree || typeof tree!=='object')return result;
    if(predicate(tree))result.push(tree);
    all(tree.props?.children,predicate,result);return result;
  }
  const find=predicate=>all(render(),predicate)[0];
  const input=maxLength=>find(node=>node.props?.maxLength===maxLength);
  render();effect();await flush();
  const edit=(length,value)=>input(length).props.onChange({target:{value}});
  const preview=async()=>{find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await flush();};
  const send=()=>find(node=>node.props?.onClick && node.props.type==='button');
  return {find,edit,preview,send,requests,get sentCount(){return sentCount;}};
}
const counts={matched:5,eligible:3,excluded:2,inbox:2,push:1,skipped:1,previewToken:'token',enabled:true,announcementsEnabled:true};
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
test('mocked composer resets its preview after a draft edit',async()=>{
  const ui=await harness(async()=>response({preview:counts}));
  ui.edit(120,'Title');ui.edit(2000,'Message');await ui.preview();
  assert.ok(ui.send());
  ui.edit(2000,'Changed');assert.equal(ui.send(),undefined);
  assert.equal(ui.requests[0].action,'preview');
  assert.deepEqual(ui.requests[0].audience,{roles:[],clubId:null,teamId:null});
});
test('mocked composer prevents concurrent sends and preserves request ID after network failure',async()=>{
  let rejectSend;
  const ui=await harness(async payload=>payload.action==='preview'?response({preview:counts}):new Promise((resolve,reject)=>{rejectSend=reject;}));
  ui.edit(120,'Title');ui.edit(2000,'Message');await ui.preview();
  const button=ui.send();button.props.onClick();button.props.onClick();await flush();
  assert.equal(ui.requests.length,2);
  assert.equal(ui.find(node=>node.type==='fieldset').props.disabled,true);
  rejectSend(new Error('Connection lost'));await flush();
  const original=ui.requests[1].requestId;
  await ui.preview();
  ui.send().props.onClick();await flush();
  assert.equal(ui.requests[3].requestId,original);
  assert.equal(ui.requests[3].previewToken,'token');
  rejectSend(new Error('Connection lost'));await flush();
});
test('mocked composer clears a stale preview on 409 and records successful sends in history',async()=>{
  let conflict=true;
  const sent={id:'sent',title:'Title',body:'Message',createdAt:'2026-10-20T12:00:00Z',summary:counts,audience:{roles:[],clubId:null,teamId:null}};
  const ui=await harness(async payload=>payload.action==='preview'?response({preview:counts}):conflict?response({error:'Audience changed. Preview again.'},409):response({announcement:sent,duplicate:false}));
  ui.edit(120,'Title');ui.edit(2000,'Message');await ui.preview();
  ui.send().props.onClick();await flush();assert.equal(ui.send(),undefined);
  conflict=false;await ui.preview();ui.send().props.onClick();await flush();
  assert.equal(ui.send(),undefined);
  assert.equal(ui.sentCount,1);
  assert.equal(ui.find(node=>node.props?.maxLength===120).props.value,'');
});
