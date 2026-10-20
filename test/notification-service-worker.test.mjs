import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function serviceWorker(){
  const events={},shown=[],opened=[];
  const self={location:{origin:'https://snooker.example'},addEventListener:(name,callback)=>{events[name]=callback;},registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>[],openWindow:async href=>opened.push(href)}};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Date});
  return {events,shown,opened};
}
test('push stores safe destination and clicking opens it',async()=>{
  const w=serviceWorker();let pending;
  w.events.push({data:{json:()=>({title:'Match reminder',body:'Tomorrow',href:'/fixtures?id=123',tag:'notice'})},waitUntil:p=>pending=p});await pending;
  assert.equal(w.shown[0].title,'Match reminder');assert.equal(w.shown[0].options.data.href,'/fixtures?id=123');
  w.events.notificationclick({notification:{data:w.shown[0].options.data,close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.opened[0],'/fixtures?id=123');
});
test('expired push messages never produce an OS notification',()=>{
  const w=serviceWorker();w.events.push({data:{json:()=>({title:'Old reminder',expiresAt:new Date(Date.now()-1000).toISOString()})},waitUntil(){}});assert.equal(w.shown.length,0);
});
test('malformed push data is ignored and external click destinations are blocked',async()=>{
  const w=serviceWorker();let pending;
  w.events.push({data:{json:()=>{throw new Error('bad json');}},waitUntil:p=>pending=p});assert.equal(w.shown.length,0);
  for(const href of ['//evil.example','https://evil.example/','/\\evil.example']){
    w.events.notificationclick({notification:{data:{href},close(){}},waitUntil:p=>pending=p});await pending;
    assert.equal(w.opened.at(-1),'/');
  }
});
