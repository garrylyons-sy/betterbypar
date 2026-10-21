import assert from 'node:assert/strict';
import test from 'node:test';
import {cupDrawInboxContent} from '../lib/cup-draw-inbox.mjs';
const body='Test Cup draw is confirmed. 7 teams have byes into Quarter Final.\n\nPreliminary round — 25 Oct 2026\n1. Castle A v Stackstown A\n\nQuarter Final — 3 Nov 2026\n1. Newlands A (bye) v Grange A (bye)\n2. Fitzwilliam B (bye) v Winner of Preliminary match 1\n\nSemi Final — 10 Nov 2026\n1. Winner of Quarter Final match 1 v Winner of Quarter Final match 2\n\nFinal — 17 Nov 2026\n1. Winner of Semi Final match 1 v Winner of Semi Final match 2';
test('existing draw messages keep actual pairings and bye routes but collapse future placeholders into dates',()=>{
 const view=cupDrawInboxContent(body);assert.match(view.summary,/Test Cup draw/);assert.equal(view.rounds.length,2);
 assert.equal(view.rounds[0].matches[0].text,'Castle A v Stackstown A');assert.equal(view.rounds[1].matches[1].text,'Fitzwilliam B (bye) v Winner of Preliminary match 1');
 assert.deepEqual(view.schedule,[{name:'Semi Final',date:'10 Nov 2026'},{name:'Final',date:'17 Nov 2026'}]);
});
test('new concise messages and plain messages remain readable without losing text',()=>{
 const view=cupDrawInboxContent('Cup confirmed.\n\nFinal — 17 Nov 2026\n1. Alpha v Beta');assert.equal(view.rounds[0].matches[0].text,'Alpha v Beta');
 assert.equal(cupDrawInboxContent('Just a message').summary,'Just a message');
});

import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as inbox from '../lib/cup-draw-inbox.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const compiled=ts.transpileModule(fs.readFileSync(new URL('../components/cup-draw-inbox-message.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const api={};new Function('require','exports',compiled)(name=>name==='@/lib/cup-draw-inbox.mjs'?inbox:require(name),api);
test('draw card starts collapsed, separates pairings and dates, and opening it marks the message read',()=>{
 let opened=0;const tree=api.CupDrawInboxMessage({body,onOpen:()=>opened++});
 const html=renderToStaticMarkup(tree);assert.match(html,/View draw/);assert.doesNotMatch(html,/<details[^>]*\bopen/);assert.match(html,/Later round dates/);assert.doesNotMatch(html,/Winner of Quarter Final match 1 v Winner of Quarter Final match 2/);assert.doesNotMatch(html,/<a\b/);
 function find(node){if(!node||typeof node!=='object')return null;if(node.type==='details')return node;for(const child of React.Children.toArray(node.props?.children)){const result=find(child);if(result)return result;}return null;}
 const details=find(tree);details.props.onToggle({currentTarget:{open:false}});assert.equal(opened,0);details.props.onToggle({currentTarget:{open:true}});assert.equal(opened,1);
});
test('draw footer uses actual draw time in Ireland and the saved witness without duplication',()=>{
 const footer=inbox.withCupDrawWitness(body,{drawnAt:'2026-10-21T15:22:00Z',witnessName:'Pat Witness'});
 assert.match(footer,/Draw made at .*21 October 2026.*16:22.*witnessed by Pat Witness/);
 assert.equal(inbox.withCupDrawWitness(footer,{drawnAt:'2026-10-21T15:22:00Z',witnessName:'Pat Witness'}),footer);
 const view=cupDrawInboxContent(footer);assert.match(view.footer,/witnessed by Pat Witness/);assert.equal(view.notes.length,0);
 assert.equal(inbox.withCupDrawWitness(body,{}),body);
});
