import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(){
  const hooks=[],pending=[],requests=[];let index=0;
  const react={Fragment:Symbol.for('react.fragment'),useState(value){const i=index++;hooks[i]??={value};return [hooks[i].value,next=>{hooks[i].value=typeof next==='function'?next(hooks[i].value):next;}];},useEffect(fn,deps){const i=index++;if(!hooks[i]||deps.some((d,n)=>d!==hooks[i].deps[n])){hooks[i]?.cleanup?.();hooks[i]={deps};pending.push(()=>{hooks[i].cleanup=fn();});}}};
  const fetch=async(url,init)=>{
    requests.push({url,signal:init.signal});
    const params=new URL(url,'https://app.test').searchParams;
    if(params.get('view')==='detail')return {ok:true,json:async()=>({announcement:{body:'Full message only loaded on expansion',audience:{roles:['League Chair'],clubId:null,teamId:null}}})};
    const page=Number(params.get('page'));
    return {ok:true,json:async()=>({page,pageSize:10,total:11,totalPages:2,items:Array.from({length:page===1?10:1},(_,i)=>({id:`${page}-${i}`,title:`Message ${page}-${i}`,createdAt:'2026-10-20T12:00:00Z',senderName:'Administrator',summary:{inbox:2,push:1}}))})};
  };
  const source=readFileSync(new URL('../components/admin-announcement-history.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports={};
  new Function('require','exports','fetch',compiled)(name=>name==='react'?react:name==='@/components/ui/button'?{Button:()=>null}:name==='@/components/admin-notification-composer'?{DeliveryCounts:()=>null}:require(name),exports,fetch);
  const render=()=>{index=0;return exports.AdminAnnouncementHistory();};
  const settle=async()=>{render();for(const fn of pending.splice(0))fn();await flush();render();for(const fn of pending.splice(0))fn();await flush();};
  function all(node,predicate,result=[]){if(Array.isArray(node)){node.forEach(child=>all(child,predicate,result));return result;}if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);all(node.props?.children,predicate,result);return result;}
  const find=predicate=>all(render(),predicate)[0];
  await settle();return {requests,find,settle,all:predicate=>all(render(),predicate)};
}
test('history loads only ten summary rows, fetches details on expansion, caches them and pages on demand',async()=>{
  const ui=await harness();
  assert.equal(ui.requests.length,1);assert.match(ui.requests[0].url,/view=history&page=1/);
  assert.equal(ui.all(node=>node.type==='button'&&node.props['aria-controls']).length,10);
  ui.find(node=>node.props?.['aria-label']==='Read Message 1-0').props.onClick();await ui.settle();
  assert.equal(ui.requests.length,2);assert.match(ui.requests[1].url,/view=detail&id=1-0/);
  assert.ok(ui.find(node=>node.type==='p'&&node.props.children==='Full message only loaded on expansion'));
  ui.find(node=>node.props?.['aria-label']==='Collapse Message 1-0').props.onClick();await ui.settle();
  ui.find(node=>node.props?.['aria-label']==='Read Message 1-0').props.onClick();await ui.settle();
  assert.equal(ui.requests.length,2);
  ui.find(node=>node.props?.children==='Next').props.onClick();await ui.settle();
  assert.match(ui.requests[2].url,/view=history&page=2/);
  assert.equal(ui.all(node=>node.type==='button'&&node.props['aria-controls']).length,1);
  assert.equal(ui.find(node=>node.props?.children==='Next').props.disabled,true);
  assert.equal(ui.find(node=>node.props?.children==='Previous').props.disabled,false);
});
