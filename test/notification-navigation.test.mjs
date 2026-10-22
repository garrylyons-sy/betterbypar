import {CupDrawInboxMessage} from './helpers/cup-draw-inbox-component.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const path=new URL('../lib/notification-navigation.mjs',import.meta.url);
const navigation=existsSync(path)?await import(path):{};
const contexts=[{id:'player',name:'A',role:'Player',club:'Club A'},{id:'manager',name:'B',role:'Manager',club:'Club B'}];
test('notification navigation selects the requested screen and team context without losing fixture identity',()=>{
  assert.equal(typeof navigation.notificationDestination,'function');
  const result=navigation.notificationDestination('/?page=Fixtures&fixtureId=fixture&team=B&role=Manager&club=Club%20B',contexts);
  assert.equal(result.page,'Fixtures');assert.equal(result.fixtureId,'fixture');assert.equal(result.contextId,'manager');
});
test('announcement opens the inbox without changing the current screen or team',()=>{
  assert.equal(typeof navigation.notificationDestination,'function');
  const result=navigation.notificationDestination('/?notifications=1',contexts);
  assert.equal(result.inbox,true);assert.equal(result.page,null);assert.equal(result.contextId,null);
});
test('unsafe destinations are sanitized before updating app navigation',()=>{
  assert.equal(typeof navigation.notificationDestination,'function');
  for(const href of ['//evil.example','https://evil.example','/\\evil.example'])assert.equal(navigation.notificationDestination(href,contexts).href,'/');
});

test('opening an inbox item prevents browser navigation and routes inside the mounted app',()=>{
  const require=createRequire(import.meta.url),ts=require('typescript');
  const source=readFileSync(new URL('../components/notification-center.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const opened=[],exports={};
  const hooks={useEffect(){},useRef:()=>({current:null}),useState:value=>[value,()=>{}]};
  new Function('require','exports',compiled)(name=>name==='@/components/notification-message'?{NotificationMessage:()=>null}:name==='@/components/cup-draw-inbox-message'?{CupDrawInboxMessage}:name==='react'?hooks:name==='@/components/ui/button'?{Button:()=>null}:name==='@/lib/notification-policy.mjs'?{safeNotificationHref:value=>value}:name==='@/lib/notification-navigation.mjs'?{...navigation,openNotificationHref:href=>opened.push(href)}:require(name),exports);
  const tree=exports.NotificationCenter({center:{state:{eligible:true,items:[{id:'item',type:'announcement',title:'Title',body:'Message',href:'/?notifications=1',createdAt:'2026-10-20',readAt:'2026-10-20'}],unreadCount:0},panel:'inbox',setPanel(){},setError(){},refresh(){}}});
  function find(node){if(Array.isArray(node))return node.map(find).find(Boolean);if(!node||typeof node!=='object')return null;return node.type==='a'?node:find(node.props?.children);}
  const link=find(tree);let prevented=0;
  link.props.onClick({button:0,preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.deepEqual(opened,['/?notifications=1']);
  link.props.onClick({button:0,ctrlKey:true,preventDefault(){assert.fail('modified click should retain browser behaviour');}});
  assert.equal(opened.length,1);
});

test('result links open Results and select the matching league and season context',()=>{
 const contexts=[{id:'a',name:'Castle A',role:'Player',club:'Castle',league:'A League',season:'2026/27'},{id:'b',name:'Castle B',role:'Manager',club:'Castle',league:'B League',season:'2026/27'}];
 const result=navigation.notificationDestination('/?page=Results&fixtureId=completed&league=B+League&season=2026%2F27',contexts);
 assert.equal(result.page,'Results');assert.equal(result.fixtureId,'completed');assert.equal(result.contextId,'b');
 const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8');
 assert.match(shell,/requestedPage === "Results"/);assert.match(shell,/NotifiedResultCard key=\{selectedFixtureId\}/);
});

test('announcement deep links select the exact message without navigating the main app',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const result=navigation.notificationDestination(`/?notifications=1&message=${id}`,contexts);
 assert.equal(result.messageId,id);assert.equal(result.inbox,true);assert.equal(result.page,null);
 assert.equal(navigation.notificationDestination('/?notifications=1&message=invalid').messageId,null);
});
