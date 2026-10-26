import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeChallenge,normalizeDrill,demoMedia,evaluateChallenge} from '../lib/practice-policy.mjs';
const holes=Array.from({length:18},(_,i)=>({number:i+1,status:'played',par:4,strokes:5,putts:2,penalties:0}));
const round={source:'golf_ireland',importedGross:90,status:'completed',holeCount:18,holes};
test('challenge checks distinguish official scores, player observations and missing evidence',()=>{
 assert.equal(evaluateChallenge({rule:'gross_max',targetValue:90},round,18).evidence,'golf_ireland');
 assert.equal(evaluateChallenge({rule:'no_three_putts'},round,18).evidence,'player_recorded');
 assert.equal(evaluateChallenge({rule:'no_three_putts'},{...round,holes:holes.map(h=>({...h,putts:null}))},18).outcome,'needs_attestation');
 assert.equal(evaluateChallenge({rule:'no_double_bogeys'},{...round,holes:holes.map(h=>({...h,par:null}))},18).outcome,'needs_attestation');
 assert.equal(evaluateChallenge({rule:'no_lost_balls'},round,18).outcome,'needs_attestation');
 assert.equal(evaluateChallenge({rule:'no_double_bogeys'},{...round,holes:[{...holes[0],strokes:6},...holes.slice(1)]},18).outcome,'not_met');
 assert.equal(evaluateChallenge({rule:'no_three_putts'},{...round,holes:[{...holes[0],putts:3},...holes.slice(1)]},18).outcome,'not_met');
 assert.notEqual(evaluateChallenge({rule:'gross_max',targetValue:90},{...round,holeCount:9,holes:holes.slice(0,9)},18).outcome,'passed');
 assert.notEqual(evaluateChallenge({rule:'no_three_putts'},{...round,holes:holes.slice(0,10)},18).outcome,'passed');
});
test('library fields have bounds and video URLs resolve only to known safe players',()=>{
 assert.throws(()=>normalizeChallenge({title:'',description:'',rule:'custom'}));
 assert.throws(()=>normalizeChallenge({title:'Break 90',description:'',rule:'gross_max',targetValue:-5}));
 assert.equal(normalizeChallenge({title:'No lost balls',description:'Keep a ball in play',rule:'no_lost_balls'}).rule,'no_lost_balls');
 for(const url of ['javascript:alert(1)','https://evil.test/watch?v=x','http://example.test/video.mp4','https://youtube.com.evil.test/embed/abc','//evil.test/demo.mp4'])assert.equal(demoMedia(url),null);
 assert.equal(demoMedia('https://youtu.be/abcdefghijk').kind,'embed');
 assert.equal(demoMedia('https://example.test/demo.mp4').kind,'video');
 assert.equal(demoMedia('/practice/demos/putting-gate').kind,'animation');
 assert.throws(()=>normalizeDrill({title:'Gate putting',description:'A drill',steps:['Do it'],demoUrl:'javascript:bad',minutes:10}));
});

test('known gross failure cannot be overridden through missing-score attestation',()=>{
 const partial={...round,source:'manual',importedGross:null,holes:holes.map((h,i)=>({...h,strokes:i===17?null:6,status:i===17?'picked_up':'played'}))};
 assert.equal(evaluateChallenge({rule:'gross_max',targetValue:89},partial).outcome,'not_met');
 assert.equal(evaluateChallenge({rule:'gross_max',targetValue:89},{...partial,source:'golf_ireland',importedGross:103}).outcome,'not_met');
});

test('imported adjusted gross cannot establish a pass with a picked-up hole',()=>{const picked={...round,importedGross:80,holes:holes.map((h,i)=>({...h,strokes:i===17?null:4,status:i===17?'picked_up':'played'}))};assert.equal(evaluateChallenge({rule:'gross_max',targetValue:89},picked).outcome,'needs_attestation');});
