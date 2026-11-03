import test from 'node:test';import assert from 'node:assert/strict';
import {availablePracticeRounds,drillLogBody,practiceProgress} from '../shared/practice-presentation.mjs';
test('practice picker includes only rounds inside the assigned window without changing the input',()=>{
 const rounds=[{id:'before',playedOn:'2026-10-01'},{id:'end',playedOn:'2026-11-02'},{id:'after',playedOn:'2026-11-03'}];
 assert.deepEqual(availablePracticeRounds(rounds,{startsOn:'2026-10-02',dueOn:'2026-11-02'}).map(r=>r.id),['end']);assert.equal(rounds.length,3);
});
test('drill logs preserve duplicate keys while rejecting fractional durations and dates outside the plan',()=>{
 const item={id:'assignment',startsOn:'2026-10-01',dueOn:'2026-11-02'};
 const body=drillLogBody(item,{date:'2026-11-01',minutes:'12',note:' Focus ',clientKey:'same-key'},'2026-11-02');
 assert.equal(body.clientKey,'same-key');assert.equal(body.minutes,12);assert.equal(body.note,'Focus');
 for(const minutes of ['0','1.5','181','12abc'])assert.throws(()=>drillLogBody(item,{date:'2026-11-01',minutes,note:'',clientKey:'key'},'2026-11-02'));
 for(const date of ['2026-09-30','2026-11-03','2026-02-30'])assert.throws(()=>drillLogBody(item,{date,minutes:'10',note:'',clientKey:'key'},'2026-11-02'));
});
test('practice progress caps the visual bar while retaining the real session count',()=>{
 assert.deepEqual(practiceProgress({goalSessions:2,sessions:[{}, {}, {}]}),{completed:3,target:2,fraction:1});
 assert.equal(practiceProgress({goalSessions:3,sessions:[]}).fraction,0);
});
