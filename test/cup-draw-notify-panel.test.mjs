import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as cup from '../lib/cup-draw-notification-policy.mjs';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function all(tree,match,result=[]){if(Array.isArray(tree)){for(const item of tree)all(item,match,result);}else if(tree&&typeof tree==='object'){if(match(tree))result.push(tree);all(tree.props?.children,match,result);}return result;}
test('named recipients require preview and failed send retries reuse the same request without double taps',async()=>{
 const hooks=[true],requests=[];let index=0,effectRan=false,effect,failSend=true;
 const Button=()=>null;
 const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v];},useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},useEffect(fn){if(!effectRan){effect=fn;effectRan=true;}}};
 const fetch=async(url,init)=>{
  if(!init?.body)return {ok:true,json:async()=>({title:'Cup draw confirmed',body:'Alpha v Beta',people:[{id:'person-a',name:'Noel O’Kelly'},{id:'person-b',name:'Other player'}],eligibleRoles:['Manager'],history:[]})};
  const body=JSON.parse(init.body);requests.push(body);
  if(body.action==='preview')return {ok:true,json:async()=>({preview:{summary:{notified:1,inbox:1,push:0,excluded:0,skipped:0},previewToken:'checked'}})};
  if(failSend){failSend=false;throw new Error('Connection interrupted');}
  return {ok:true,json:async()=>({summary:{notified:1,inbox:1,push:0}})};
 };
 const source=ts.transpileModule(fs.readFileSync(new URL('../components/cup-draw-notify.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,api={};
 const deps={'react':react,'@/components/ui/button':{Button},'@/lib/cup-draw-notification-policy.mjs':cup,'@/lib/notification-policy.mjs':policy};
 new Function('require','exports','fetch',source)(name=>deps[name]??require(name),api,fetch);
 function render(){index=0;const root=api.CupDrawNotify({competitionId:'cup',attemptId:'draw'}),form=all(root,n=>typeof n.type==='function'&&n.type!==Button)[0];return form.type(form.props);}
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 render();effect();await tick();
 all(render(),n=>n.type==='select')[0].props.onChange({target:{value:'people'}});
 all(render(),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});
 const buttons=()=>all(render(),n=>n.type===Button);
 assert.equal(buttons().some(n=>typeof n.props.children==='string'&&n.props.children.startsWith('Send draw')),false);
 buttons().find(n=>n.props.children==='Preview recipients').props.onClick();await tick();
 assert.deepEqual(requests[0].audience,{personIds:['person-a']});
 const send=()=>buttons().find(n=>Array.isArray(n.props.children));
 const first=send();first.props.onClick();first.props.onClick();await tick();
 assert.equal(requests.filter(r=>r.action==='send').length,1);
 send().props.onClick();await tick();
 const sends=requests.filter(r=>r.action==='send');assert.equal(sends.length,2);assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(sends[0].previewToken,'checked');
 assert.ok(all(render(),n=>n.props.role==='status').length);
});
