import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as scheduling from '../lib/fixture-scheduling.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react');
const stream={id:'fixture',streamId:'stream',videoId:'M7lc1UVf-VE',homeTeam:'Home',awayTeam:'Away',fixtureDate:'2026-10-22T19:30:00Z',competition:'A League',status:'Scheduled',publisherName:'Publisher',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),canEnd:true};
async function harness({publisher=true,viewer=true,fixturePages=[[stream]],fixtureFetch}={}){
 const state=[],effects=[],calls=[],listeners={};let index=0,pending=[],fail=false,streams=[stream],data;
 const hooks={useState(initial){const i=index++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef(initial){const i=index++;if(!(i in state))state[i]={current:initial};return state[i];},useEffect(fn,deps){const i=index++;const old=effects[i];if(!old||!deps||deps.some((v,j)=>v!==old.deps[j])){pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}}};
 const fetch=async(url,init)=>{calls.push([url,init]);if(fail)return {ok:false,status:403,json:async()=>({error:'Viewing permission required.'})};if(init?.method==='POST'){const b=JSON.parse(init.body);if(b.action==='end')streams=[];return {ok:true,json:async()=>({ok:true})};}if(url.includes('view=fixtures')){const params=new URL(url,'https://app.test').searchParams;const page=Number(params.get('page'));if(fixtureFetch)return fixtureFetch(params);return {ok:true,json:async()=>({items:fixturePages[page-1]??[],page,hasMore:page<fixturePages.length})};}return {ok:true,json:async()=>({streams,canPublish:publisher,canView:viewer})};};
 const deps={'@/lib/fixture-scheduling.mjs':scheduling,'react':hooks,'@/components/ui/button':{Button:p=>React.createElement('button',p)},'@/components/ui/card':Object.fromEntries(['Card','CardHeader','CardContent','CardTitle'].map(n=>[n,p=>React.createElement('div',p)]))};
 const exports={};const code=ts.transpileModule(fs.readFileSync(new URL('../components/match-livestreams.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const document={visibilityState:'visible',addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener(){}};
 new Function('require','exports','fetch','document','window','setInterval','clearInterval','setTimeout','clearTimeout',code)(n=>deps[n]??require(n),exports,fetch,document,{addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener(){}},()=>1,()=>{},()=>2,()=>{});
 function render(){index=0;pending=[];data=exports.MatchLivestreams({publisher,viewer});for(const fn of pending)fn();return data;}
 const all=(tree,fn,result=[])=>{if(Array.isArray(tree)){tree.forEach(t=>all(t,fn,result));return result;}if(tree&&typeof tree==='object'){if(fn(tree))result.push(tree);all(tree.props?.children,fn,result);}return result;};
 async function settle(){render();await new Promise(r=>setImmediate(r));render();await new Promise(r=>setImmediate(r));render();}
 const find=fn=>all(render(),fn)[0];
 await settle();return {find,all:fn=>all(render(),fn),calls,settle,deny(){fail=true;},cleanup(){for(const e of effects)e?.cleanup?.();},refresh(){listeners.focus?.();}};
}
test('viewers load video only after Watch and Close removes the embedded player',async()=>{
 const ui=await harness({publisher:false});try{
 assert.equal(ui.find(n=>n.type==='iframe'),undefined);
 assert.equal(ui.find(n=>n.props?.['aria-label']==='Manage livestreams'),undefined);
 ui.find(n=>n.props?.['aria-label']==='Watch Home v Away').props.onClick();await ui.settle();
 const player=ui.find(n=>n.type==='iframe');assert.equal(player.props.src,'https://www.youtube.com/embed/M7lc1UVf-VE?autoplay=0');
 ui.find(n=>n.props?.['aria-label']==='Close viewer').props.onClick();assert.equal(ui.find(n=>n.type==='iframe'),undefined);
 }finally{ui.cleanup();}
});
test('Publisher selects a fixture and submits its YouTube link with no client sender identity',async()=>{
 const ui=await harness();try{
 ui.find(n=>n.props?.['aria-label']==='Manage livestreams').props.onClick();await ui.settle();
 ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture').props.onChange();
 ui.find(n=>n.props?.type==='url').props.onChange({target:{value:'https://youtu.be/M7lc1UVf-VE'}});
 const form=ui.find(n=>n.type==='form'&&n.props['aria-label']==='Make a match live');
 form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});await ui.settle();
 const posts=ui.calls.filter(c=>c[1]?.method==='POST');assert.equal(posts.length,1);
 assert.deepEqual(JSON.parse(posts[0][1].body),{action:'make-live',fixtureId:'fixture',youtubeUrl:'https://youtu.be/M7lc1UVf-VE'});
 }finally{ui.cleanup();}
});
test('refresh denial clears an already open viewer and previously loaded stream links',async()=>{
 const ui=await harness({publisher:false});try{
 ui.find(n=>n.props?.['aria-label']==='Watch Home v Away').props.onClick();await ui.settle();assert.ok(ui.find(n=>n.type==='iframe'));
 ui.deny();ui.refresh();await ui.settle();assert.equal(ui.find(n=>n.type==='iframe'),undefined);assert.equal(ui.find(n=>n.props?.['aria-label']==='Watch Home v Away'),undefined);
 }finally{ui.cleanup();}
});
test('ending a Publisher listing removes it from the current live list and viewer',async()=>{
 const ui=await harness();try{
 ui.find(n=>n.props?.['aria-label']==='Watch Home v Away').props.onClick();await ui.settle();
 ui.find(n=>n.props?.['aria-label']==='End Home v Away').props.onClick();await ui.settle();
 assert.equal(ui.find(n=>n.type==='iframe'),undefined);assert.equal(ui.find(n=>n.props?.['aria-label']==='Watch Home v Away'),undefined);
 assert.deepEqual(JSON.parse(ui.calls.find(c=>c[1]?.method==='POST')[1].body),{action:'end',id:'stream'});
 }finally{ui.cleanup();}
});

test('match browser appends more matches without hiding earlier choices and publishes the selected card',async()=>{
 const second={...stream,id:'fixture-2',homeTeam:'Second home'};
 const ui=await harness({fixturePages:[[stream],[second]]});try{
 ui.find(n=>n.props?.['aria-label']==='Manage livestreams').props.onClick();await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture'));
 ui.find(n=>n.props?.['aria-label']==='Load more matches').props.onClick();await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture'));
 ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture-2').props.onChange();await ui.settle();
 assert.ok(ui.find(n=>n.props?.['aria-label']==='Selected match'));
 assert.equal(ui.find(n=>n.props?.['aria-label']==='Search matches'&&n.type==='form'),undefined);
 ui.find(n=>n.props?.type==='url').props.onChange({target:{value:'https://youtu.be/M7lc1UVf-VE'}});
 ui.find(n=>n.type==='form'&&n.props['aria-label']==='Make a match live').props.onSubmit({preventDefault(){}});await ui.settle();
 assert.equal(JSON.parse(ui.calls.find(c=>c[1]?.method==='POST')[1].body).fixtureId,'fixture-2');
 }finally{ui.cleanup();}
});
test('searching to change a match keeps the existing selection and YouTube link until replaced',async()=>{
 const ui=await harness({fixtureFetch:params=>({ok:true,json:async()=>({items:params.get('q')?[{...stream,id:'other'}]:[stream],hasMore:false})})});try{
 ui.find(n=>n.props?.['aria-label']==='Manage livestreams').props.onClick();await ui.settle();
 ui.find(n=>n.props?.type==='radio').props.onChange();await ui.settle();
 ui.find(n=>n.props?.type==='url').props.onChange({target:{value:'https://youtu.be/M7lc1UVf-VE'}});
 ui.find(n=>n.props?.['aria-label']==='Change match').props.onClick();await ui.settle();
 ui.find(n=>n.type==='input'&&n.props['aria-label']==='Search matches').props.onChange({target:{value:'Another club'}});
 ui.find(n=>n.type==='form'&&n.props['aria-label']==='Search matches').props.onSubmit({preventDefault(){}});await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='other'));
 ui.find(n=>n.props?.['aria-label']==='Keep selected match').props.onClick();await ui.settle();
 assert.equal(ui.find(n=>n.props.type==='url').props.value,'https://youtu.be/M7lc1UVf-VE');
 ui.find(n=>n.type==='form'&&n.props['aria-label']==='Make a match live').props.onSubmit({preventDefault(){}});await ui.settle();
 assert.equal(JSON.parse(ui.calls.find(c=>c[1]?.method==='POST')[1].body).fixtureId,'fixture');
 }finally{ui.cleanup();}
});
test('failed Load more retains previous results and retries the same page',async()=>{
 let failed=false;const ui=await harness({fixtureFetch:params=>{const page=Number(params.get('page'));if(page===2&&!failed){failed=true;return {ok:false,json:async()=>({error:'Try again'})};}return {ok:true,json:async()=>({items:page===1?[stream]:[{...stream,id:'second'}],hasMore:page===1})};}});try{
 ui.find(n=>n.props?.['aria-label']==='Manage livestreams').props.onClick();await ui.settle();
 ui.find(n=>n.props?.['aria-label']==='Load more matches').props.onClick();await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture'));
 ui.find(n=>n.props?.['aria-label']==='Retry match search').props.onClick();await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='second'));
 const pages=ui.calls.filter(c=>c[0].includes('view=fixtures')).map(c=>new URL(c[0],'https://app.test').searchParams.get('page'));
 assert.deepEqual(pages,['1','2','2']);
 }finally{ui.cleanup();}
});

test('reopening the match browser starts with the nearest matches after loading more',async()=>{
 const ui=await harness({fixturePages:[[stream],[{...stream,id:'second'}]]});try{
 const toggle=()=>ui.find(n=>n.props?.['aria-label']==='Manage livestreams').props.onClick();
 toggle();await ui.settle();ui.find(n=>n.props?.['aria-label']==='Load more matches').props.onClick();await ui.settle();
 toggle();await ui.settle();toggle();await ui.settle();
 assert.ok(ui.find(n=>n.props?.type==='radio'&&n.props.value==='fixture'));
 }finally{ui.cleanup();}
});
