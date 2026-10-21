import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as form from '../lib/cup-competition-form.mjs';
import * as dates from '../lib/cup-round-dates.mjs';
const require=createRequire(import.meta.url);
test('cancel closes the new cup form without creating a competition or leaving admin',()=>{
 const states=[];let index=0,requests=0;
 const react={useEffect(){},useMemo:fn=>fn(),useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],update=>states[i]=typeof update==='function'?update(states[i]):update];}};
 const exports={};const source=ts.transpileModule(readFileSync(new URL('../components/admin-cup-competitions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports','fetch',source)(name=>name==='react'?react:name==='@/lib/cup-competition-form.mjs'?form:name==='@/lib/cup-round-dates.mjs'?dates:name.startsWith('@/')?{}:require(name),exports,()=>{requests++;throw Error('Unexpected network request');});
 function find(node,label){if(Array.isArray(node))return node.map(child=>find(child,label)).find(Boolean);if(!node||typeof node!=='object')return null;if(node.props?.children===label||Array.isArray(node.props?.children)&&node.props.children.includes(label))return node;return find(node.props?.children,label);}
 const render=()=>{index=0;return exports.AdminCupCompetitions({onMessage(){}});};
 find(render(),' New cup').props.onClick();assert.ok(find(render(),'Create competition'));
 const cancel=find(render(),'Cancel');assert.ok(cancel,'new cup form needs a Cancel button');cancel.props.onClick();
 assert.equal(find(render(),'Create competition'),undefined);assert.equal(requests,0);assert.ok(find(render(),' New cup'));
});
