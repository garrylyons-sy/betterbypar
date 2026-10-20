import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function serviceWorker(windows=[],timer=setTimeout){
  const events={},shown=[],opened=[];
  const self={location:{origin:'https://snooker.example'},addEventListener:(name,callback)=>{events[name]=callback;},registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>windows,openWindow:async href=>opened.push(href)}};
  class MessageChannel {constructor(){this.port1={close(){}};this.port2={postMessage:data=>this.port1.onmessage?.({data}),close(){}};}}
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Date,MessageChannel,setTimeout:timer,clearTimeout});
  return {events,shown,opened};
}
test('push stores safe destination and clicking opens it',async()=>{
  const w=serviceWorker();let pending;
  w.events.push({data:{json:()=>({title:'Match reminder',body:'Tomorrow',href:'/fixtures?id=123',tag:'notice'})},waitUntil:p=>pending=p});await pending;
  assert.equal(w.shown[0].title,'Match reminder');assert.equal(w.shown[0].options.data.href,'/fixtures?id=123');
  w.events.notificationclick({notification:{data:w.shown[0].options.data,close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.opened[0],'/fixtures?id=123');
});
test('phone notification focuses and messages an existing app without navigating or opening another window',async()=>{
  const calls=[];
  const w=serviceWorker([{url:'https://snooker.example/',focus:async()=>calls.push('focus'),navigate:async()=>calls.push('reload'),postMessage:(data,ports)=>{calls.push(data.href);ports[0].postMessage({handled:true});}}]);
  let pending;
  w.events.notificationclick({notification:{data:{href:'/?notifications=1'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.deepEqual(calls,['focus','/?notifications=1']);assert.equal(w.opened.length,0);
});
test('an unrelated admin window is not reloaded for a notification',async()=>{
  const w=serviceWorker([{url:'https://snooker.example/admin',navigate:async()=>assert.fail('must not replace admin'),focus:async()=>{}}]);
  let pending;w.events.notificationclick({notification:{data:{href:'/?notifications=1'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.opened[0],'/?notifications=1');
});
test('an older app with no message handler falls back to opening the destination',async()=>{
  const calls=[];
  const w=serviceWorker([{url:'https://snooker.example/',focus:async()=>{},postMessage(){},navigate:async href=>calls.push(href)}],fn=>setTimeout(fn,0));
  let pending;w.events.notificationclick({notification:{data:{href:'/?page=Fixtures&fixtureId=123'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.deepEqual(calls,['/?page=Fixtures&fixtureId=123']);assert.equal(w.opened.length,0);
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
