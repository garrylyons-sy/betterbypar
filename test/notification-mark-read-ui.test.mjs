import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../components/notification-center.tsx',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetch){
  const states=[],refs=[];let index=0,refIndex=0,error='';
  const react={useEffect(){},useRef(value){const i=refIndex++;refs[i]??={current:value};return refs[i];},useState(value){const i=index++;if(!(i in states))states[i]=value;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
  const center={state:{eligible:true,unreadCount:1,items:[{id:'notice',title:'Notice',body:'Body',type:'announcement',href:'/?notifications=1',createdAt:'2026-10-20',readAt:null}]},panel:'inbox',setPanel(){},setError(value){error=value;},refresh:async()=>{center.state.items[0].readAt='2026-10-20T12:00:00Z';center.state.unreadCount=0;}};
  const exports={};const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','fetch',compiled)(name=>name==='react'?react:name==='@/components/ui/button'?{Button:()=>null}:name==='@/lib/notification-policy.mjs'?{safeNotificationHref:value=>value}:name.startsWith('@/lib/')?{}:require(name),exports,fetch);
  const render=()=>{index=0;refIndex=0;return exports.NotificationCenter({center});};
  function find(node,label){if(Array.isArray(node))return node.map(child=>find(child,label)).find(Boolean);if(!node||typeof node!=='object')return null;if(node.type==='button'&&node.props.children===label)return node;return find(node.props?.children,label);}
  return {button:label=>find(render(),label),get error(){return error;}};
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
