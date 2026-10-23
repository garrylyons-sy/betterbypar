import {buildCupBracket} from '../lib/server/cup-draw.mjs';
import * as presentation from '../lib/cup-draw-presentation.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as cupPolicy from '../lib/cup-draw-notification-policy.mjs';
import * as notificationPolicy from '../lib/notification-policy.mjs';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){const source=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};new Function('require','exports',source)(name=>name==='@/lib/cup-draw-presentation.mjs'?presentation:deps[name]??require(name),exports);return exports;}
const {Button}=load('../components/ui/button.tsx',{'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}});
const board=load('../components/cup-draw-board.tsx');
const {CupDrawReview}=load('../components/cup-draw-review.tsx',{'@/components/cup-draw-notify':{CupDrawNotify:()=>null},'@/components/cup-draw-board':board,'@/lib/cup-draw-notification-policy.mjs':cupPolicy,'@/lib/notification-policy.mjs':notificationPolicy,'@/components/ui/button':{Button},'@/lib/cup-draw-record':load('../lib/cup-draw-record.ts')});
const attempt={id:'a',attempt_number:1,status:'Provisional',revealed_count:0,created_at:'2026-10-21T12:00:00Z',created_by_name:'Organiser',snapshot:{entries:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'}],rounds:[{round_number:1,name:'Final',fixture_date:'2027-01-01'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:'b',status:'Scheduled'}]}};
const render=(draws,status='Draft')=>renderToStaticMarkup(React.createElement(CupDrawReview,{competitionId:'cup',name:'Cup',status,draws,onSaved:async()=>{},onMessage:()=>{}}));
test('redraw is a secondary action button and reveal language refers only to matches',()=>{
 const source=fs.readFileSync(new URL('../components/cup-draw-review.tsx',import.meta.url),'utf8');
 assert.match(source,/variant="secondary"[^\n]*Redraw…/);
 assert.doesNotMatch(source,/Reveal next team|draw positions revealed/);
 assert.match(source,/matches revealed/);
});
test('provisional presentation hides unrevealed pairings and cannot confirm until every match is revealed',()=>{
 const hidden=render([attempt]);assert.match(hidden,/Reveal match 1/);assert.doesNotMatch(hidden,/Confirm and publish draw/);assert.doesNotMatch(hidden,/<li/);
 const revealed=render([{...attempt,revealed_count:1}]);assert.match(revealed,/<li/);assert.match(revealed,/Confirm and publish draw/);assert.match(revealed,/Witness name/);
});
test('confirmed draw has read-only full history with discarded pairings and redraw reason',()=>{
 const html=render([{...attempt,status:'Confirmed',witness_name:'Pat Witness',confirmed_at:'2026-10-21T13:00:00Z',confirmed_by_name:'Organiser'},{...attempt,id:'old',status:'Superseded',redraw_reason:'Witness restart',superseded_at:'2026-10-21T12:30:00Z',superseded_by_name:'Organiser'}],'In Progress');
 assert.match(html,/Full draw history \(2 attempts\)/);assert.match(html,/Pat Witness/);assert.match(html,/Witness restart/);assert.match(html,/Print draw record/);assert.doesNotMatch(html,/Confirm and publish draw|Run provisional draw|Reveal match/);
});

test('confirmation offers all four notification audiences, defaulting to nobody',()=>{
 const html=render([{...attempt,revealed_count:1}]);
 for(const label of ['League Chairs','Admins','Managers of teams','Players on teams'])assert.ok(html.includes(label));
 assert.doesNotMatch(html,/checked=""/);assert.match(html,/leave all unchecked to notify nobody/);
});
test('confirm request carries only the notification groups selected by the organiser',async()=>{
 const hooks=[];let index=0;const sent=[];
 const hookReact={useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v];}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../components/cup-draw-review.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};const deps={'@/components/cup-draw-notify':{CupDrawNotify:()=>null},'@/components/cup-draw-board':board,'react':hookReact,'@/lib/cup-draw-notification-policy.mjs':cupPolicy,'@/lib/notification-policy.mjs':notificationPolicy,'@/components/ui/button':{Button},'@/lib/cup-draw-record':{}};
 new Function('require','exports','fetch',source)(name=>name==='@/lib/cup-draw-presentation.mjs'?presentation:deps[name]??require(name),exports,async(_url,init)=>{sent.push(JSON.parse(init.body));return {ok:true,json:async()=>({notificationSummary:{notified:1}})};});
 const render=()=>{index=0;return exports.CupDrawReview({competitionId:'cup',name:'Cup',status:'Draft',draws:[{...attempt,revealed_count:1}],onSaved:async()=>{},onMessage:()=>{}});};
 function all(tree,match,result=[]){if(Array.isArray(tree)){for(const t of tree)all(t,match,result);}else if(tree&&typeof tree==='object'){if(match(tree))result.push(tree);all(tree.props?.children,match,result);}return result;}
 const inputs=()=>all(render(),n=>n.type==='input');
 inputs().find(n=>n.props.placeholder).props.onChange({target:{value:'Pat Witness'}});
 const checks=inputs().filter(n=>n.props.type==='checkbox');assert.equal(checks.length,4);assert.ok(checks.every(n=>n.props.checked===false));
 checks[0].props.onChange({target:{checked:true}});inputs().filter(n=>n.props.type==='checkbox')[2].props.onChange({target:{checked:true}});
 all(render(),n=>n.type===Button&&n.props.children==='Confirm and publish draw')[0].props.onClick();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,1);assert.equal(sent[0].action,'confirm');assert.deepEqual(sent[0].notificationAudience,['chairs','managers']);
});

test('nine-team review reveals one pairing per step and withholds confirmation until every bye pairing is shown',()=>{
 const entries=Array.from({length:9},(_,i)=>({team_id:String(i+1),team_name:`Team ${i+1}`}));
 const snapshot={entries,bracket:buildCupBracket({teamIds:entries.map(e=>e.team_id),roundCount:4,random:()=>0.999}),revealOrder:[8],rounds:[{round_number:1,name:'Round of 16',fixture_date:'2027-01-01'},{round_number:2,name:'Quarter Final',fixture_date:'2027-01-08'},{round_number:3,name:'Semi Final',fixture_date:'2027-01-15'},{round_number:4,name:'Final',fixture_date:'2027-01-22'}]};
 for(const [revealed_count,byes] of [[1,0],[2,2],[3,4],[4,6],[5,7]]){
  const html=render([{...attempt,snapshot,revealed_count}]);
  assert.equal((html.match(/\(bye\)/g)??[]).length,byes);
  if(revealed_count<5){assert.doesNotMatch(html,/Confirm and publish draw/);assert.match(html,new RegExp(`${revealed_count} of 5 matches revealed`));}
  else assert.match(html,/Confirm and publish draw/);
 }
});
