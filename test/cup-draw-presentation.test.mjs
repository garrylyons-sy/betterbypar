import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCupBracket} from '../lib/server/cup-draw.mjs';
import {cupDrawRevealOrder,cupDrawPresentation} from '../lib/cup-draw-presentation.mjs';
const entries=Array.from({length:9},(_,i)=>({team_id:String(i+1),team_name:`Team ${i+1}`}));
const bracket=buildCupBracket({teamIds:entries.map(e=>e.team_id),roundCount:4,random:()=>0.999});
const snapshot={entries,bracket,rounds:[{round_number:1,name:'Round of 16',fixture_date:'2027-01-01'},{round_number:2,name:'Quarter Final',fixture_date:'2027-01-08'},{round_number:3,name:'Semi Final',fixture_date:'2027-01-15'},{round_number:4,name:'Final',fixture_date:'2027-01-22'}]};
test('nine-team draw reveals its one actual preliminary match before seven bye teams',()=>{
 assert.deepEqual(cupDrawRevealOrder(bracket),[8,1,2,3,4,5,6,7]);
 assert.equal(bracket[0].matchNumber,1);
 const view=cupDrawPresentation({...snapshot,revealOrder:cupDrawRevealOrder(bracket)},1);
 assert.equal(view.rounds[0].name,'Preliminary round');assert.equal(view.rounds[0].ties.length,1);
 assert.equal(view.rounds[0].ties[0].home,'Team 8');assert.equal(view.rounds[0].ties[0].away,'Team 9');
 assert.equal(view.rounds[1].ties[0].home,'Team not revealed');assert.equal(view.rounds[1].ties[0].away,'Team not revealed');
});
test('bye recipients are paired explicitly in the next round with preliminary winner routes',()=>{
 const view=cupDrawPresentation(snapshot);
 const quarter=view.rounds[1];assert.equal(quarter.name,'Quarter Final');assert.equal(quarter.ties.length,4);
 assert.equal(quarter.ties[0].home,'Team 1');assert.equal(quarter.ties[0].away,'Team 2');
 assert.equal(quarter.ties[1].home,'Team 3');assert.equal(quarter.ties[1].away,'Team 4');
 assert.equal(quarter.ties[3].home,'Team 7');assert.equal(quarter.ties[3].away,'Winner of Preliminary match 1');
 assert.equal(view.preliminaryMatches,1);assert.equal(view.byes,7);
});
test('legacy partially revealed draws retain their original order without leaking unrevealed names',()=>{
 const view=cupDrawPresentation(snapshot,2);
 assert.equal(view.rounds[0].ties[0].home,'Team not revealed');assert.equal(view.rounds[1].ties[0].home,'Team 1');assert.equal(view.rounds[1].ties[0].away,'Team 2');assert.equal(view.rounds[1].ties[1].home,'Team not revealed');
});
test('full brackets without byes retain normal round naming and match numbering',()=>{
 const s={...snapshot,entries:entries.slice(0,8),bracket:buildCupBracket({teamIds:entries.slice(0,8).map(e=>e.team_id),roundCount:3,random:()=>0.999}),rounds:snapshot.rounds.slice(1).map((r,i)=>({...r,round_number:i+1}))};
 const view=cupDrawPresentation(s);assert.equal(view.rounds[0].name,'Quarter Final');assert.equal(view.rounds[0].ties.length,4);assert.equal(view.byes,0);assert.equal(view.rounds[1].ties[0].home,'Winner of Quarter Final match 1');
});
