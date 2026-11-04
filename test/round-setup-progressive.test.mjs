import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import * as rounds from '../lib/golf-rounds.mjs';import * as capture from '../shared/round-capture.mjs';import * as courses from '../shared/course-catalogue.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function render({manual=false,details=null,club='',courseId=''}={}){
 let index=0;const state={7:{courses:[{id:'course',clubName:'Castle',name:'Castle',location:'Dublin',tees:[]}]},8:false,10:club,11:courseId,12:manual},api={};
 const deps={react:{...React,useEffect(){},useRef:value=>({current:value}),useState(initial){const i=index++;return[Object.hasOwn(state,i)?state[i]:initial,()=>{}];}},'@/components/golf-ui':{golfInput:'input',golfRequest:()=>{throw Error('Render must not request');}},'@/lib/golf-rounds.mjs':rounds,'@/shared/round-capture.mjs':capture,'@/shared/course-catalogue.mjs':courses,'./round-capture.module.css':{default:{}}};
 new Function('require','exports',ts.transpileModule(readFileSync('components/round-capture.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id]??require(id),api);
 const draft=rounds.normalizeRound({courseName:manual?'Unlisted Links':'Castle',playedOn:'2026-11-04',holeCount:18,format:'strokes',status:'draft',holes:[]});
 return renderToStaticMarkup(React.createElement(api.RoundCapture,{draft:{...draft,courseDetails:details},saved:null,busy:false,onChange(){},onPendingChange(){}}));
}
test('initial web setup only shows club selection; selecting a layout alone does not expose incomplete round fields',()=>{
 for(const html of [render(),render({club:'Castle',courseId:'course'})]){assert.match(html,/Golf club/);assert.doesNotMatch(html,/Date played|Handicap Index|Playing handicap|How do you want to enter it/);}
});
test('manual entry explicitly opens the form and explains the approval boundary',()=>{const html=render({manual:true});assert.match(html,/Date played/);assert.match(html,/administrator approval/);assert.match(html,/Unlisted Links/);});
test('a chosen rated tee reveals the round options and keeps the course metadata read-only',()=>{
 const details={clubName:'Castle',courseName:'Castle',teeName:'White',ratingCategory:'men',par:72,ratedHoleCount:18,courseRating:70,slopeRating:120,totalDistance:null,distanceUnit:'m',sourceUrl:'https://example.test/card',reviewedOn:'2026-11-04',holes:Array.from({length:18},(_,i)=>({number:i+1,par:4}))};
 const html=render({details,club:'Castle',courseId:'course'});assert.match(html,/Date played/);assert.match(html,/Handicap Index/);assert.match(html,/How do you want to enter it/);assert.doesNotMatch(html,/placeholder="e.g. White"/);
});
