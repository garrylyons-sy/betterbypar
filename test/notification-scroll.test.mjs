import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../components/notification-center.tsx',import.meta.url),'utf8');

function modalHarness(){
  const effects=[];
  const listeners=new Map();
  const document={body:{style:{position:'relative',top:'',left:'',width:'',overflow:'auto'}},documentElement:{style:{overflow:'',scrollBehavior:'smooth'}}};
  const initial=structuredClone(document);
  document.addEventListener=(name,handler,options)=>listeners.set(name,{handler,options});
  document.removeEventListener=(name,handler)=>{if(listeners.get(name)?.handler===handler)listeners.delete(name);};
  const scrolls=[];
  const window={scrollX:12,scrollY:640,scrollTo:(...args)=>scrolls.push(args)};
  const dialog={showModal(){},close(){}};
  const inside={};
  const content={scrollTop:0,clientHeight:400,scrollHeight:1200,contains:target=>target===inside};
  let refIndex=0;
  const hooks={useState:value=>[value,()=>{}],useRef:()=>({current:refIndex++===0?dialog:content}),useEffect:fn=>effects.push(fn)};
  const exports={};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports','window','document','navigator','fetch',compiled)(name=>name==='react'?hooks:name==='@/components/ui/button'?{Button:()=>null}:name.startsWith('@/lib/notification-')?{}:require(name),exports,window,document,{},async()=>({ok:true,json:async()=>({})}));
  exports.NotificationCenter({center:{state:{eligible:true,items:[],unreadCount:0},panel:'settings',setPanel(){},setError(){},refresh(){}}});
  const cleanups=effects.map(effect=>effect());
  return {document,initial,scrolls,content,inside,listeners,cleanup(){for(const cleanup of cleanups)cleanup?.();}};
}
test('notification modal locks background scrolling and restores page position on dismissal or unmount',()=>{
  const {document,initial,scrolls,listeners,cleanup}=modalHarness();
  assert.equal(document.body.style.position,'fixed');
  assert.equal(document.body.style.top,'-640px');
  assert.equal(document.documentElement.style.overflow,'hidden');
  cleanup();
  assert.deepEqual(document.body,initial.body);
  assert.deepEqual(document.documentElement,initial.documentElement);
  assert.equal(listeners.size,0);
  assert.deepEqual(scrolls,[[12,640]]);
});

test('phone swipes cannot move the background or escape the panel at its scroll boundaries',()=>{
  const ui=modalHarness();
  try{
    assert.ok(ui.listeners.has('touchmove'),'missing explicit mobile scroll guard');
    assert.equal(ui.listeners.get('touchmove').options.passive,false);
    function swipe(target,from,to,count=1){
      let prevented=false;
      ui.listeners.get('touchstart').handler({touches:Array.from({length:count},()=>({clientY:from}))});
      ui.listeners.get('touchmove').handler({target,touches:Array.from({length:count},()=>({clientY:to})),cancelable:true,preventDefault(){prevented=true;}});
      return prevented;
    }
    assert.equal(swipe({},200,100),true,'backdrop and header swipes must be blocked');
    assert.equal(swipe(ui.inside,100,102),false,'small finger movement on Mark read must not cancel the tap');
    assert.equal(swipe({},100,102),false,'small finger movement on header buttons must not cancel the tap');
    assert.equal(swipe(ui.inside,100,200),true,'pulling past the top must be blocked');
    assert.equal(swipe(ui.inside,200,100),false,'scrolling down within the list must work');
    ui.content.scrollTop=800;
    assert.equal(swipe(ui.inside,200,100),true,'pushing past the bottom must be blocked');
    assert.equal(swipe(ui.inside,100,200),false,'scrolling back up must work');
    ui.content.scrollTop=300;
    assert.equal(swipe(ui.inside,100,200),false,'middle-of-list swipes must work');
    ui.content.scrollHeight=400;
    assert.equal(swipe(ui.inside,200,100),true,'short panels must not pass scrolling through');
    assert.equal(swipe(ui.inside,100,200,2),false,'pinch zoom must remain available');
  }finally{ui.cleanup();}
});

test('modal content has its own bounded scroll area with scroll chaining contained',()=>{
  assert.match(source,/open:flex/);
  assert.match(source,/min-h-0[^"\n]*overflow-y-auto[^"\n]*overscroll-contain/);
});
