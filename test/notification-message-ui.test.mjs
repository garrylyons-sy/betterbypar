import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness({visible=false,failFirst=false}={}){
 const hooks=[],pending=[],requests=[],listeners=new Map();let index=0,callbacks=0,posts=0;
 const react={useRef(value){const i=index++;hooks[i]??={current:value};return hooks[i];},useState(value){const i=index++;hooks[i]??={value};return [hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},useEffect(fn,deps){const i=index++;if(!hooks[i]||deps.some((value,n)=>value!==hooks[i].deps[n])){hooks[i]?.cleanup?.();hooks[i]={deps};pending.push(()=>hooks[i].cleanup=fn());}}};
 const document={visibilityState:visible?'visible':'hidden',addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
 const exports={},source=ts.transpileModule(fs.readFileSync(new URL('../components/notification-message.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const fetch=async(url,init)=>{requests.push({url,method:init.method??'GET'});if(init.method==='POST'){posts++;return {ok:!failFirst||posts>1};}return {ok:true,json:async()=>({message:{id:'notice',announcementId:'message',title:'Exact message title',body:'Exact full message',createdAt:'2026-10-22T12:00:00Z',availableUntil:'2099-01-01T00:00:00Z'}})};};
 new Function('require','exports','fetch','document','setTimeout','clearTimeout',source)(name=>name==='react'?react:name==='@/components/ui/button'?{Button:()=>null}:require(name),exports,fetch,document,()=>1,()=>{});
 const render=()=>{index=0;return exports.NotificationMessage({announcementId:'message',onOpened:()=>callbacks++});};
 const settle=async()=>{for(let n=0;n<3;n++){render();pending.splice(0).forEach(fn=>fn());await flush();}};
 function all(node,predicate){if(Array.isArray(node))return node.flatMap(child=>all(child,predicate));if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...all(node.props?.children,predicate)];}
 await settle();return {requests,settle,find:predicate=>all(render(),predicate)[0],get callbacks(){return callbacks;},show:async()=>{document.visibilityState='visible';await listeners.get('visibilitychange')?.();await settle();}};
}
test('exact-message panel loads body without a receipt in background and acknowledges once when visible',async()=>{
 const ui=await harness();assert.ok(ui.find(node=>node.props?.children==='Exact full message'));assert.deepEqual(ui.requests.map(r=>r.method),['GET']);assert.equal(ui.callbacks,0);
 await ui.show();assert.deepEqual(ui.requests.map(r=>r.method),['GET','POST']);assert.equal(ui.callbacks,1);
 await ui.show();assert.equal(ui.requests.length,2);
});
test('failed opened receipt offers retry without reloading message contents',async()=>{
 const ui=await harness({visible:true,failFirst:true});assert.equal(ui.callbacks,0);
 const retry=ui.find(node=>node.props?.children==='Retry read status');assert.ok(retry);retry.props.onClick();await ui.settle();
 assert.deepEqual(ui.requests.map(r=>r.method),['GET','POST','POST']);assert.equal(ui.callbacks,1);
});
