import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../components/notification-center.tsx',import.meta.url),'utf8');

test('notification modal locks background scrolling and restores page position on dismissal or unmount',()=>{
  const effects=[];
  const document={body:{style:{position:'relative',top:'',left:'',width:'',overflow:'auto'}},documentElement:{style:{overflow:'',scrollBehavior:'smooth'}}};
  const initial=structuredClone(document);
  const scrolls=[];
  const window={scrollX:12,scrollY:640,scrollTo:(...args)=>scrolls.push(args)};
  const dialog={showModal(){},close(){}};
  const hooks={useState:value=>[value,()=>{}],useRef:()=>({current:dialog}),useEffect:fn=>effects.push(fn)};
  const exports={};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports','window','document','navigator','fetch',compiled)(name=>name==='react'?hooks:name==='@/components/ui/button'?{Button:()=>null}:name==='@/lib/notification-policy.mjs'?{}:require(name),exports,window,document,{},async()=>({ok:true,json:async()=>({})}));
  exports.NotificationCenter({center:{state:{eligible:true,items:[],unreadCount:0},panel:'settings',setPanel(){},setError(){},refresh(){}}});
  const cleanups=effects.map(effect=>effect());
  assert.equal(document.body.style.position,'fixed');
  assert.equal(document.body.style.top,'-640px');
  assert.equal(document.documentElement.style.overflow,'hidden');
  for(const cleanup of cleanups)cleanup?.();
  assert.deepEqual(document,initial);
  assert.deepEqual(scrolls,[[12,640]]);
});

test('modal content has its own bounded scroll area with scroll chaining contained',()=>{
  assert.match(source,/open:flex/);
  assert.match(source,/min-h-0[^"\n]*overflow-y-auto[^"\n]*overscroll-contain/);
});
