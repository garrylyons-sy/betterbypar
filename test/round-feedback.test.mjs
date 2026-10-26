import test from 'node:test';import assert from 'node:assert/strict';
import {generateRoundFeedback} from '../lib/server/round-feedback.mjs';
import {normalizeRound} from '../lib/golf-rounds.mjs';
const round=normalizeRound({courseName:'Castle',teeName:'White',playedOn:'2026-10-25',holeCount:9,format:'strokes',status:'completed',commentary:'Choose the middle of the green',holes:[{number:1,par:4,strokes:5,putts:2,penalties:0,status:'played',comment:'Missed left',shots:[]}]});
test('local feedback cannot use inherited live AI keys',async()=>{const f=await generateRoundFeedback(round,[],{env:{LOCAL_DEMO:'1',ROUND_AI_MODE:'live',OPENAI_API_KEY:'ignored'},fetcher:()=>{throw new Error('Must not call network');}});assert.equal(f.mode,'demo');});
test('live feedback requires configuration and never silently falls back',async()=>{await assert.rejects(generateRoundFeedback(round,[],{env:{ROUND_AI_MODE:'live'}}),/not configured/);await assert.rejects(generateRoundFeedback(round,[],{env:{ROUND_AI_MODE:'off'}}),/not configured/);});
test('live feedback uses structured output, does not forward PII and validates hole references',async()=>{
 let sent;const result={summary:'Recorded bogey on hole 1.',strengths:['You added context.'],focus:['Review the decision.'],thoughts:[1,2,3].map(n=>({title:`Thought ${n}`,reason:'Hole 1',action:'Choose a clear target.'})),holes:[{number:1,observation:'Five strokes on a par four.',question:''}]};
 const fetcher=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(init.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]})};};
 const env={ROUND_AI_MODE:'live',OPENAI_API_KEY:'test-key'};const f=await generateRoundFeedback({...round,playerName:'Private name',golfIrelandNumber:'123456789'},[],{env,fetcher});assert.equal(f.mode,'live');assert.equal(sent.store,false);assert.equal(sent.text.format.type,'json_schema');assert.doesNotMatch(JSON.stringify(sent),/Private name|123456789/);
 result.holes[0].number=18;await assert.rejects(generateRoundFeedback(round,[],{env,fetcher}),/valid feedback/);
});
