import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){const source=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};new Function('require','exports',source)(name=>deps[name]??require(name),exports);return exports;}
const {Button}=load('../components/ui/button.tsx',{'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}});
const {CupDrawReview}=load('../components/cup-draw-review.tsx',{'@/components/ui/button':{Button},'@/lib/cup-draw-record':load('../lib/cup-draw-record.ts')});
const attempt={id:'a',attempt_number:1,status:'Provisional',revealed_count:0,created_at:'2026-10-21T12:00:00Z',created_by_name:'Organiser',snapshot:{entries:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'}],rounds:[{round_number:1,name:'Final',fixture_date:'2027-01-01'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:'b',status:'Scheduled'}]}};
const render=(draws,status='Draft')=>renderToStaticMarkup(React.createElement(CupDrawReview,{competitionId:'cup',name:'Cup',status,draws,onSaved:async()=>{},onMessage:()=>{}}));
test('provisional presentation hides unrevealed pairings and cannot confirm until every match is revealed',()=>{
 const hidden=render([attempt]);assert.match(hidden,/Reveal match 1/);assert.doesNotMatch(hidden,/Confirm and publish draw/);assert.doesNotMatch(hidden,/<li/);
 const revealed=render([{...attempt,revealed_count:1}]);assert.match(revealed,/<li/);assert.match(revealed,/Confirm and publish draw/);assert.match(revealed,/Witness name/);
});
test('confirmed draw has read-only full history with discarded pairings and redraw reason',()=>{
 const html=render([{...attempt,status:'Confirmed',witness_name:'Pat Witness',confirmed_at:'2026-10-21T13:00:00Z',confirmed_by_name:'Organiser'},{...attempt,id:'old',status:'Superseded',redraw_reason:'Witness restart',superseded_at:'2026-10-21T12:30:00Z',superseded_by_name:'Organiser'}],'In Progress');
 assert.match(html,/Full draw history \(2 attempts\)/);assert.match(html,/Pat Witness/);assert.match(html,/Witness restart/);assert.match(html,/Print draw record/);assert.doesNotMatch(html,/Confirm and publish draw|Run provisional draw|Reveal match/);
});
