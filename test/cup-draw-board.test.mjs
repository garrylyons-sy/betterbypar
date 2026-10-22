import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as presentation from '../lib/cup-draw-presentation.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function render(count){
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL('../components/cup-draw-board.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',source)(name=>name==='@/lib/cup-draw-presentation.mjs'?presentation:require(name),exports);
 return renderToStaticMarkup(React.createElement(exports.CupDrawBoard,{snapshot:{entries:[{team_id:'a',team_name:'Castle A'},{team_id:'b',team_name:'Dun Laoghaire A'}],rounds:[{round_number:1,name:'Final',fixture_date:'2026-10-22'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:'b',status:'Scheduled'}]},revealedCount:count,spotlight:true}));
}
test('before reveal, the draw stage never renders hidden team names in text or attributes',()=>{
 const html=render(0);assert.doesNotMatch(html,/Castle|Laoghaire/);assert.match(html,/ready|Ready/);
});
test('a reveal puts the selected pairing on stage and identifies its round and home-away positions',()=>{
 const html=render(1);assert.match(html,/Latest pairing/);assert.match(html,/Castle A/);assert.match(html,/Dun Laoghaire A/);assert.match(html,/Home/);assert.match(html,/Away/);assert.match(html,/Final/);
 assert.match(html,/<p class="sr-only" aria-live="polite" aria-atomic="true">Final, match 1: Castle A versus Dun Laoghaire A\.<\/p>/);
});
