import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(receipt={}){
 const hooks=[],pending=[],requests=[];let index=0;
 const react={useState(value){const i=index++;hooks[i]??={value};return [hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},useEffect(fn,deps){const i=index++;if(!hooks[i]||deps.some((value,n)=>value!==hooks[i].deps[n])){hooks[i]?.cleanup?.();hooks[i]={deps};pending.push(()=>hooks[i].cleanup=fn());}}};
 const exports={},source=ts.transpileModule(fs.readFileSync(new URL('../components/publisher-message-history.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const fetch=async url=>{requests.push(url);const params=new URL(url,'https://app.test').searchParams;if(params.get('view')==='detail')return {ok:true,json:async()=>({announcement:{id:params.get('id'),title:'Message',body:'Full saved body',recipientTotal:26,recipientSource:'snapshot',recipientPage:Number(params.get('recipientPage')),recipientTotalPages:2,recipients:[{personId:'person',name:'Saved recipient name',inbox:true,push:false,...receipt}]}})};return {ok:true,json:async()=>({items:[{id:'message',title:'Message',createdAt:'2026-10-22T12:00:00Z',summary:{inbox:26,push:0}}],page:Number(params.get('page')),pageSize:10,total:11,totalPages:2})};};
 new Function('require','exports','fetch',source)(name=>name==='react'?react:name==='@/components/ui/button'?{Button:()=>null}:require(name),exports,fetch);
 const render=()=>{index=0;return exports.PublisherMessageHistory();};
 const settle=async()=>{for(let n=0;n<2;n++){render();pending.splice(0).forEach(fn=>fn());await flush();}};
 function all(node,predicate){if(Array.isArray(node))return node.flatMap(child=>all(child,predicate));if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...all(node.props?.children,predicate)];}
 const find=predicate=>all(render(),predicate)[0];await settle();return {find,settle,requests};
}
test('Publisher history loads summary pages only, then lazy-loads message recipients on expansion',async()=>{
 const ui=await harness();assert.equal(ui.requests.length,1);assert.match(ui.requests[0],/view=history&page=1/);
 ui.find(node=>node.props?.['aria-controls']==='publisher-sent-message').props.onClick();await ui.settle();
 assert.match(ui.requests[1],/view=detail&id=message&recipientPage=1/);
 assert.ok(ui.find(node=>node.props?.children==='Full saved body'));assert.ok(ui.find(node=>node.props?.children==='Saved recipient name'));
 ui.find(node=>node.props?.children==='Next recipients').props.onClick();await ui.settle();assert.match(ui.requests.at(-1),/recipientPage=2/);
 ui.find(node=>node.props?.children==='Next').props.onClick();await ui.settle();assert.match(ui.requests.at(-1),/view=history&page=2/);
 assert.equal(ui.find(node=>node.props?.children==='Full saved body'),undefined);
});

test('Publisher recipient status prioritizes Opened over Marked read and otherwise shows Unread',async()=>{
 for(const [receipt,status] of [[{},'Unread'],[{readAt:'2026-10-22T12:00:00Z'},'Marked read'],[{readAt:'2026-10-22T12:00:00Z',openedAt:'2026-10-22T13:00:00Z'},'Opened']]){
  const ui=await harness(receipt);ui.find(node=>node.props?.['aria-controls']==='publisher-sent-message').props.onClick();await ui.settle();assert.ok(ui.find(node=>node.props?.children===status));
 }
});
