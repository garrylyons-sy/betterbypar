import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8');
const component=source.slice(source.indexOf('function PwaPullToRefresh('),source.indexOf('function DesktopRail('));
function harness(){
  const effects=[],listeners=new Map(),states=[],refs=[];let index=0,refIndex=0,modal=false,refreshes=0;
  const hooks={useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=value;}];},useRef(initial){const i=refIndex++;refs[i]??={current:initial};return refs[i];},useEffect(fn){effects.push(fn);}};
  const window={scrollY:0,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setTimeout(){}};
  const document={querySelector:selector=>{assert.match(selector,/dialog\[open\]/);return modal?{}:null;}};
  const exports={};
  const compiled=ts.transpileModule(component+'\nexport {PwaPullToRefresh};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports','useState','useRef','useEffect','isPwaContainer','window','document',compiled)(require,exports,hooks.useState,hooks.useRef,hooks.useEffect,()=>true,window,document);
  const render=()=>{index=0;refIndex=0;return exports.PwaPullToRefresh({onRefresh:()=>refreshes++});};
  render();effects.splice(0).forEach(fn=>fn());
  const touch=(name,y,extra={})=>listeners.get(name)({touches:[{clientY:y}],...extra});
  return {touch,render,setModal:value=>{modal=value;},get refreshes(){return refreshes;},get distance(){return states[0];}};
}
test('normal page swipes still trigger pull to refresh',()=>{
  const ui=harness();ui.touch('touchstart',0);ui.touch('touchmove',200);ui.touch('touchend',200);
  assert.equal(ui.refreshes,1);
});
test('swipes in an open notification or other modal never show or trigger page refresh',()=>{
  const ui=harness();ui.setModal(true);ui.touch('touchstart',0);ui.touch('touchmove',220);ui.touch('touchend',220);
  assert.equal(ui.distance,0);assert.equal(ui.refreshes,0);assert.equal(ui.render(),null);
  ui.setModal(false);ui.touch('touchstart',0);ui.touch('touchmove',200);ui.touch('touchend',200);assert.equal(ui.refreshes,1);
});
test('opening a modal during a pull cancels tracking before move or release',()=>{
  for(const nextEvent of ['touchmove','touchend']){
    const ui=harness();ui.touch('touchstart',0);ui.touch('touchmove',200);ui.setModal(true);ui.touch(nextEvent,220);ui.touch('touchend',220);
    assert.equal(ui.refreshes,0);assert.equal(ui.distance,0);
  }
});
test('a prevented modal swipe or cancelled touch cannot refresh the app',()=>{
  for(const variant of ['prevented','cancelled']){
    const ui=harness();ui.touch('touchstart',0);ui.touch('touchmove',200);
    if(variant==='prevented')ui.touch('touchmove',220,{defaultPrevented:true});else ui.touch('touchcancel',200);
    ui.touch('touchend',220);assert.equal(ui.refreshes,0);assert.equal(ui.distance,0);
  }
});
