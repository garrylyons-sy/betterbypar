import * as presentation from '../lib/cup-draw-presentation.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validateCupDrawAudience} from '../lib/cup-draw-notification-policy.mjs';
import {buildCupBracket} from '../lib/server/cup-draw.mjs';
const ts=createRequire(import.meta.url)('typescript');
function setup(){
 const state={competition:{status:'Draft',round_count:1},attempts:[],published:[],notifications:[]};
 const client={query:async(sql,args=[])=>{
  if(sql.includes('from public.cup_competition where'))return {rows:[state.competition]};
  if(sql.includes('from public.cup_competition_entry'))return {rows:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'}]};
  if(sql.includes('from public.cup_competition_round'))return {rows:[{round_number:1,name:'Final',fixture_date:'2027-01-01'}]};
  if(sql.includes('select')&&sql.includes('from public.cup_draw_attempt'))return {rows:state.attempts.slice(-1)};
  if(sql.includes('insert into public.cup_draw_attempt')){const row={id:`attempt-${state.attempts.length+1}`,attempt_number:args[1],snapshot:JSON.parse(args[2]),status:'Provisional',revealed_count:0};state.attempts.push(row);return {rows:[row]};}
  if(sql.includes("status = 'Superseded'")){state.attempts.at(-1).status='Superseded';state.attempts.at(-1).redraw_reason=args[1];}
  if(sql.includes('set revealed_count'))state.attempts.at(-1).revealed_count=args[1];
  if(sql.includes("status = 'Confirmed'")){state.attempts.at(-1).status='Confirmed';state.attempts.at(-1).witness_name=args[1];}
  return {rows:[]};
 }};
 const source=ts.transpileModule(readFileSync(new URL('../lib/server/cup-draw-workflow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};new Function('require','exports',source)(name=> name==='@/lib/cup-draw-presentation.mjs'?presentation:name==='@/lib/cup-draw-notification-policy.mjs'?{validateCupDrawAudience}:name==='@/lib/server/cup-draw-notifications'?{notifyCupDrawConfirmed:async(_c,_id,attempt)=>{state.notifications.push(attempt);return {notified:0,push:0};}}:name==='@/lib/server/cup-draw.mjs'?{buildCupBracket}:name==='@/lib/server/cup-competitions'?{publishCupBracket:async(_c,_id,_actor,bracket)=>{state.published.push(bracket);state.competition.status='In Progress';}}:createRequire(import.meta.url)(name),api);
 return {state,client,api};
}
test('provisional draw and reveal never publish fixtures; confirmation publishes the saved snapshot',async()=>{
 const {state,client,api}=setup();await api.changeCupDraw(client,'cup','actor',{action:'draw'});
 assert.equal(state.attempts.length,1);assert.equal(state.published.length,0);assert.equal(state.notifications.length,0);
 const snapshot=structuredClone(state.attempts[0].snapshot);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'confirm',attemptId:'attempt-1',witnessName:'Pat'}),/reveal/i);
 await api.changeCupDraw(client,'cup','actor',{action:'reveal',attemptId:'attempt-1'});
 assert.equal(state.attempts[0].revealed_count,1);assert.equal(state.published.length,0);assert.equal(state.notifications.length,0);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'confirm',attemptId:'attempt-1',witnessName:' '}),/witness/i);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'confirm',attemptId:'attempt-1',witnessName:'Pat',notificationAudience:['everyone']}),/audience/);assert.equal(state.published.length,0);
 await api.changeCupDraw(client,'cup','actor',{action:'confirm',attemptId:'attempt-1',witnessName:' Pat Murphy '});
 assert.deepEqual(state.published,[snapshot.bracket]);assert.equal(state.attempts[0].witness_name,'Pat Murphy');assert.equal(state.notifications.length,1);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'redraw',attemptId:'attempt-1',reason:'Again'}),/confirmed|published/i);
});
test('redraw requires a reason, preserves discarded pairings and rejects stale browser actions',async()=>{
 const {state,client,api}=setup();await api.changeCupDraw(client,'cup','actor',{action:'draw'});
 const snapshot=structuredClone(state.attempts[0].snapshot);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'draw'}),/already|provisional/i);
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'redraw',attemptId:'attempt-1',reason:''}),/reason/i);
 await api.changeCupDraw(client,'cup','actor',{action:'redraw',attemptId:'attempt-1',reason:'Witness requested restart'});
 assert.equal(state.attempts[0].status,'Superseded');assert.deepEqual(state.attempts[0].snapshot,snapshot);assert.equal(state.attempts[1].attempt_number,2);
 for(const action of ['confirm','redraw','reveal'])await assert.rejects(api.changeCupDraw(client,'cup','actor',{action,attemptId:'attempt-1',reason:'Again',witnessName:'Pat'}),/changed|refresh|latest/i);
 assert.equal(state.published.length,0);
});

test('reveal retries cannot hide ties or skip ahead; invalid actions do not publish',async()=>{
 const {state,client,api}=setup();
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'publish'}),/valid/);
 await api.changeCupDraw(client,'cup','actor',{action:'draw'});
 await assert.rejects(api.changeCupDraw(client,'cup','actor',{action:'reveal',attemptId:'attempt-1',revealedCount:2}),/next match/);
 await api.changeCupDraw(client,'cup','actor',{action:'reveal',attemptId:'attempt-1',revealedCount:1});
 await api.changeCupDraw(client,'cup','actor',{action:'reveal',attemptId:'attempt-1',revealedCount:0});
 assert.equal(state.attempts[0].revealed_count,1);assert.equal(state.published.length,0);assert.equal(state.notifications.length,0);
});
test('new nine-team snapshots save preliminary-first reveal order without moving bracket slots',async()=>{
 const {state,client,api}=setup();state.competition.round_count=4;
 const original=client.query;client.query=async(sql,args)=>{
  if(sql.includes('from public.cup_competition_entry'))return {rows:Array.from({length:9},(_,i)=>({team_id:`team-${i+1}`,team_name:`Team ${i+1}`}))};
  if(sql.includes('from public.cup_competition_round'))return {rows:Array.from({length:4},(_,i)=>({round_number:i+1,name:`Round ${i+1}`,fixture_date:'2027-01-01'}))};
  return original(sql,args);
 };
 await api.changeCupDraw(client,'cup','actor',{action:'draw'});
 assert.deepEqual(state.attempts[0].snapshot.revealOrder,[8]);assert.equal(state.attempts[0].snapshot.bracket[0].matchNumber,1);assert.equal(state.published.length,0);
});
