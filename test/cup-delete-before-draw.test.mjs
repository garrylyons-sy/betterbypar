import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as form from '../lib/cup-competition-form.mjs';
import * as dates from '../lib/cup-round-dates.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function all(node,match,result=[]){if(Array.isArray(node)){for(const child of node)all(child,match,result);}else if(node&&typeof node==='object'){if(match(node))result.push(node);all(node.props?.children,match,result);}return result;}
for(const provisional of [false,true])test(`collapsed ${provisional?'provisional':'undrawn'} cup can be deleted without revealing or witnessing it`,async()=>{
 const cup={id:'cup-a',name:'Draft Cup',status:'Draft',round_count:3,entries:[],rounds:[],format:[],audience:'Everyone',draws:provisional?[{id:'draw-a',status:'Provisional',revealed_count:0,witness_name:null}]:[]};
 const data={competitions:[cup],seasons:[],teams:[],leagues:[]},states=[data,false];let index=0;const requests=[];
 const react={useMemo:fn=>fn(),useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../components/admin-cup-competitions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,api={};
 new Function('require','exports','fetch',source)(name=>name==='react'?react:name==='@/lib/cup-competition-form.mjs'?form:name==='@/lib/cup-round-dates.mjs'?dates:name.startsWith('@/')?{}:require(name),api,async(url,options)=>{requests.push({url,...options});return {ok:true,json:async()=>({...data,competitions:[]})};});
 const render=()=>{index=0;return api.AdminCupCompetitions({onMessage(){}});};
 const remove=()=>all(render(),n=>n.props['aria-label']==='Delete Draft Cup')[0];
 assert.ok(remove(),'Delete must be available while the competition card is collapsed');
 remove().props.onClick();assert.equal(requests.length,0,'Opening confirmation must not delete anything');
 let dialog=all(render(),n=>n.props.role==='dialog')[0];assert.ok(dialog);
 assert.equal(all(dialog,n=>n.type==='input').length,0,'Deletion must not require a witness');
 all(dialog,n=>n.props.children==='Cancel')[0].props.onClick();assert.equal(all(render(),n=>n.props.role==='dialog').length,0);assert.equal(requests.length,0);
 remove().props.onClick();dialog=all(render(),n=>n.props.role==='dialog')[0];
 all(dialog,n=>Array.isArray(n.props.children)&&n.props.children.includes('Delete permanently'))[0].props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1);assert.equal(requests[0].method,'DELETE');assert.deepEqual(JSON.parse(requests[0].body),{competitionId:'cup-a'});assert.equal(remove(),undefined);
});
