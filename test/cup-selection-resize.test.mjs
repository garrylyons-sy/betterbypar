import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as form from '../lib/cup-competition-form.mjs';
import * as dates from '../lib/cup-round-dates.mjs';
const require=createRequire(import.meta.url);
test('resizing a cup preserves selected teams and re-enables choices; changing season clears them',async()=>{
 const states=[],dependencies=[],effects=[];let index=0,effectIndex=0;
 const react={useMemo:fn=>fn(),useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];},useEffect(fn,deps){const i=effectIndex++;if(!dependencies[i]||deps.some((v,n)=>v!==dependencies[i][n])){dependencies[i]=deps;effects.push(fn);}}};
 const data={competitions:[],seasons:[{id:'one',name:'One'},{id:'two',name:'Two'}],leagues:[],teams:Array.from({length:16},(_,i)=>({id:`team-${i}`,name:`Team ${i}`,season_id:'one',league_name:'League'}))};
 const source=ts.transpileModule(readFileSync(new URL('../components/admin-cup-competitions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports={};
 new Function('require','exports','fetch',source)(name=>name==='react'?react:name==='@/lib/cup-competition-form.mjs'?form:name==='@/lib/cup-round-dates.mjs'?dates:name.startsWith('@/')?{}:require(name),exports,async()=>({ok:true,json:async()=>data}));
 function render(){index=0;effectIndex=0;const tree=exports.AdminCupCompetitions({onMessage(){}});if(effects.length){effects.splice(0).forEach(fn=>fn());return render();}return tree;}
 function all(tree,predicate){if(Array.isArray(tree))return tree.flatMap(node=>all(node,predicate));if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...all(tree.props?.children,predicate)];}
 const find=label=>all(render(),node=>Array.isArray(node.props?.children)&&node.props.children.includes(label))[0];
 const select=label=>all(find(label),node=>node.type==='select')[0];
 const boxes=()=>all(render(),node=>node.type==='input'&&node.props.type==='checkbox');
 render();await new Promise(resolve=>setImmediate(resolve));find(' New cup').props.onClick();
 for(let n=0;n<8;n++)boxes()[n].props.onChange();
 assert.equal(boxes().filter(box=>box.props.checked).length,8);assert.equal(boxes()[8].props.disabled,true);
 select('Rounds').props.onChange({target:{value:'4'}});
 assert.equal(boxes().filter(box=>box.props.checked).length,8);assert.equal(boxes()[8].props.disabled,false);
 boxes()[8].props.onChange();assert.equal(boxes().filter(box=>box.props.checked).length,9);
 select('Rounds').props.onChange({target:{value:'3'}});
 assert.equal(boxes().filter(box=>box.props.checked).length,9);assert.equal(form.cupTeamCountError({teamCount:9,roundCount:3}).includes('Remove 1 team'),true);
 select('Season').props.onChange({target:{value:'two'}});render();select('Season').props.onChange({target:{value:'one'}});
 assert.equal(boxes().filter(box=>box.props.checked).length,0);
});
