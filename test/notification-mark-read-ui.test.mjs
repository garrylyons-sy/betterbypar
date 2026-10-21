import {CupDrawInboxMessage} from './helpers/cup-draw-inbox-component.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../components/notification-center.tsx',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetch){
  const states=[],refs=[];let index=0,refIndex=0,error='',refreshes=0;
  const react={useEffect(){},useRef(value){const i=refIndex++;refs[i]??={current:value};return refs[i];},useState(value){const i=index++;if(!(i in states))states[i]=value;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
  const center={state:{eligible:true,unreadCount:1,items:[{id:'notice',title:'Notice',body:'Body',type:'announcement',href:'/?notifications=1',createdAt:'2026-10-20',readAt:null}]},panel:'inbox',setPanel(){},setError(value){error=value;},setState:update=>{center.state=typeof update==='function'?update(center.state):update;},refresh:async()=>{refreshes++;if(center.state.items[0])center.state.items[0].readAt='2026-10-20T12:00:00Z';center.state.unreadCount=0;}};
  center.dismissLocally=ids=>{const removed=Array.isArray(ids)?ids:[ids];center.setState(previous=>({...previous,items:previous.items.filter(item=>!removed.includes(item.id)),unreadCount:Math.max(0,previous.unreadCount-(previous.items.some(item=>removed.includes(item.id)&&!item.readAt)?1:0))}));};
  const exports={};const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','fetch',compiled)(name=>name==='@/components/cup-draw-inbox-message'?{CupDrawInboxMessage}:name==='react'?react:name==='@/components/ui/button'?{Button:'button'}:name==='@/lib/notification-policy.mjs'?{safeNotificationHref:value=>value}:name.startsWith('@/lib/')?{}:require(name),exports,fetch);
  const render=()=>{index=0;refIndex=0;return exports.NotificationCenter({center});};
  function find(node,label){if(Array.isArray(node))return node.map(child=>find(child,label)).find(Boolean);if(!node||typeof node!=='object')return null;if(node.type==='button'&&(node.props.children===label||node.props['aria-label']===label))return node;return find(node.props?.children,label);}
  return {button:label=>find(render(),label),get error(){return error;},get refreshes(){return refreshes;},get state(){return center.state;},setItems(items){center.state.items=items;}};
}
test('one tap immediately shows progress, suppresses duplicate requests and completes the read update',async()=>{
  let complete,requests=0;
  const ui=harness(async()=>{requests++;return new Promise(resolve=>{complete=resolve;});});
  const original=ui.button('Mark read');original.props.onClick();original.props.onClick();
  assert.equal(requests,1);
  assert.equal(ui.button('Marking…').props.disabled,true);
  complete({ok:true});await flush();
  assert.equal(ui.button('Mark read'),undefined);assert.equal(ui.button('Marking…'),undefined);
});
test('a failed read shows an error and allows a retry',async()=>{
  const ui=harness(async()=>({ok:false}));ui.button('Mark read').props.onClick();await flush();
  assert.match(ui.error,/Could not mark/);assert.equal(ui.button('Mark read').props.disabled,false);
});

test('wastebasket removes the item and unread badge after success, with one request for repeated taps',async()=>{
 let complete,requests=0;const ui=harness(async(_url,init)=>{assert.equal(init.method,'DELETE');assert.deepEqual(JSON.parse(init.body),{id:'notice'});requests++;return new Promise(resolve=>complete=resolve);});
 const bin=ui.button('Delete notification: Notice');bin.props.onClick();bin.props.onClick();assert.equal(requests,1);assert.equal(ui.button('Delete notification: Notice').props.disabled,true);
 complete({ok:true});await flush();assert.equal(ui.state.items.length,0);assert.equal(ui.state.unreadCount,0);assert.equal(ui.refreshes,1);
});
test('failed deletion keeps the message and supports retry',async()=>{
 const ui=harness(async()=>({ok:false}));ui.button('Delete notification: Notice').props.onClick();await flush();assert.equal(ui.state.items.length,1);assert.equal(ui.state.unreadCount,1);assert.match(ui.error,/Could not delete/);assert.equal(ui.button('Delete notification: Notice').props.disabled,false);
});

test('a refresh already in flight cannot restore a successfully deleted item or its unread badge',async()=>{
 const states=[],refs=[];let stateIndex=0,refIndex=0,complete;
 const react={useEffect(){},useCallback:fn=>fn,useRef(value){const i=refIndex++;refs[i]??={current:value};return refs[i];},useState(value){const i=stateIndex++;if(!(i in states))states[i]=value;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
 const exports={};const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','fetch','window',compiled)(name=>name==='react'?react:name==='@/lib/notification-policy.mjs'?{pruneNotificationInbox:payload=>payload}:name.startsWith('@/')?{}:require(name),exports,async()=>new Promise(resolve=>complete=resolve),{location:{search:''}});
 const render=()=>{stateIndex=0;refIndex=0;return exports.useNotificationCenter(true);};
 let center=render();center.setState({eligible:true,items:[{id:'notice',readAt:null}],unreadCount:1});center=render();
 const pending=center.refresh();center.dismissLocally('notice');
 complete({ok:true,json:async()=>({eligible:true,items:[{id:'notice',readAt:null}],unreadCount:1})});await pending;
 assert.equal(render().state.items.length,0);assert.equal(render().state.unreadCount,0);
 const fresh=render().refresh();complete({ok:true,json:async()=>({eligible:true,items:[{id:'new',readAt:null}],unreadCount:1})});await fresh;
 assert.deepEqual(render().state.items.map(item=>item.id),['new']);assert.equal(render().state.unreadCount,1);
});

test('delete all read clears only returned read IDs, blocks repeated taps and preserves unread',async()=>{
 let complete,requests=0;const ui=harness(async(_url,init)=>{requests++;assert.deepEqual(JSON.parse(init.body),{allRead:true});return new Promise(resolve=>complete=resolve);});
 ui.setItems([{id:'read',title:'Read',readAt:'2026-10-20',type:'announcement'},{id:'unread',title:'Unread',readAt:null,type:'announcement'}]);
 const button=ui.button('Delete all read notifications');assert.ok(button);button.props.onClick();button.props.onClick();assert.equal(requests,1);assert.equal(ui.button('Delete all read notifications').props.disabled,true);
 complete({ok:true,json:async()=>({ids:['read']})});await flush();assert.deepEqual(ui.state.items.map(item=>item.id),['unread']);
});
test('failed delete all read leaves the inbox intact and allows retry',async()=>{
 const ui=harness(async()=>({ok:false}));ui.setItems([{id:'read',title:'Read',readAt:'2026-10-20',type:'announcement'}]);ui.button('Delete all read notifications').props.onClick();await flush();assert.equal(ui.state.items.length,1);assert.match(ui.error,/Could not delete/);assert.equal(ui.button('Delete all read notifications').props.disabled,false);
});

test('read mutations and bulk deletion cannot overlap and accidentally delete newly read messages',async()=>{
 let complete,requests=0;const ui=harness(async()=>{requests++;return new Promise(resolve=>complete=resolve);});
 const mark=ui.button('Mark read');mark.props.onClick();ui.button('Delete all read notifications').props.onClick();assert.equal(requests,1);
 complete({ok:true});await flush();
 const bulk=ui.button('Delete all read notifications');bulk.props.onClick();mark.props.onClick();assert.equal(requests,2);
 complete({ok:true,json:async()=>({ids:[]})});await flush();
});
