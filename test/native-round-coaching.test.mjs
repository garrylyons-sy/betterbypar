import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(){const path='mobile/src/components/native-round-coaching-data.ts';let source='';try{source=readFileSync(path,'utf8');}catch{}const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
const api=load();
const option={clubId:'club-a',clubName:'Castle',playerId:'player-a',name:'Player A'};
const page=(overrides={})=>({coach:true,options:[option],selected:option,rounds:[{id:'r1'}],hasMore:false,round:{id:'r1',clubId:option.clubId,playerId:option.playerId,data:{status:'completed'}},comments:[],...overrides});
test('professional round requests always retain coach, club and optional player/round scope',()=>{
 assert.equal(typeof api.coachingRoundPath,'function');
 const url=new URL(api.coachingRoundPath('club & a','player a','round a',50),'https://local.test');
 assert.equal(url.pathname,'/api/round-coaching');assert.deepEqual(Object.fromEntries(url.searchParams),{view:'coach',clubId:'club & a',playerId:'player a',roundId:'round a',offset:'50'});
});
test('professional round response rejects another club, player, role and private draft',()=>{
 assert.equal(typeof api.assertCoachingRoundScope,'function');
 assert.doesNotThrow(()=>api.assertCoachingRoundScope(page(),'club-a','player-a'));
 for(const invalid of [page({coach:false}),page({selected:{...option,clubId:'other'}}),page({selected:{...option,playerId:'other'}}),page({round:{...page().round,clubId:'other'}}),page({round:{...page().round,playerId:'other'}}),page({round:{...page().round,data:{status:'draft'}}})])assert.throws(()=>api.assertCoachingRoundScope(invalid,'club-a','player-a'));
 assert.throws(()=>api.assertCoachingRoundScope(page({selected:null}),'club-a','player-a'));
});
test('earlier history merges without duplicates and retains the opened round',()=>{
 assert.equal(typeof api.mergeCoachingRoundPage,'function');
 const previous=page(),next=page({rounds:[{id:'r1'},{id:'r2'}],round:{...page().round,id:'r2'},hasMore:true});
 const result=api.mergeCoachingRoundPage(previous,next);assert.deepEqual(result.rounds.map(r=>r.id),['r1','r2']);assert.equal(result.round.id,'r1');assert.equal(result.hasMore,true);
 assert.throws(()=>api.mergeCoachingRoundPage(previous,page({selected:{...option,playerId:'other'}})));
});
function discussionHarness(){
 const calls=[],effects=[],elements=[],jsx=(type,props)=>{const value={type,props};elements.push(value);return value;};
 const mocks={react:{useEffect:fn=>effects.push(fn),useRef:value=>({current:value}),useState:value=>[value,()=>{}]},'react-native':{View:'View'},'expo-crypto':{randomUUID:()=> 'test-key'},'../../../shared/round-presentation.mjs':{roundHoleLabel:(_,hole)=>`Hole ${hole}`},'../lib/session':{useSession:()=>({request:async(path,body)=>{calls.push({path,body});return {comments:[]};}})},'./ui':{Action:'Action',Card:'Card',Choice:'Choice',Copy:'Copy',Status:'Status'},'./round-fields':{RoundTextInput:'RoundTextInput'},'react/jsx-runtime':{jsx,jsxs:jsx}};
 const code=ts.transpileModule(readFileSync('mobile/src/components/round-discussion.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 new Function('module','exports','require',code)(module,module.exports,name=>{assert.ok(name in mocks,`Unexpected native dependency: ${name}`);return mocks[name];});
 return {render:props=>{module.exports.NativeRoundDiscussion({roundId:'round-a',revision:2,holeCount:9,onReload:async()=>{},...props});for(const effect of effects)effect();},calls,elements};
}
test('professional discussion loads and refreshes through the professional access view',async()=>{
 const h=discussionHarness();h.render({coachScope:{clubId:'club-a',playerId:'player-a'}});await new Promise(setImmediate);
 const initial=new URL(h.calls[0].path,'https://local.test');assert.deepEqual(Object.fromEntries(initial.searchParams),{roundId:'round-a',view:'coach',clubId:'club-a',playerId:'player-a'});
 h.elements.find(e=>e.type==='Action'&&e.props.label==='Refresh round & discussion').props.onPress();await new Promise(setImmediate);assert.equal(h.calls[1].path,h.calls[0].path);
});
test('player discussion retains its player access view',async()=>{
 const h=discussionHarness();h.render({});await new Promise(setImmediate);assert.deepEqual(Object.fromEntries(new URL(h.calls[0].path,'https://local.test').searchParams),{roundId:'round-a'});
});
