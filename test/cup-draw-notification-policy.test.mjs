import assert from 'node:assert/strict';
import test from 'node:test';
import * as policy from '../lib/notification-policy.mjs';
import {validateCupDrawAudience,cupDrawMessage,selectCupDrawRecipients} from '../lib/cup-draw-notification-policy.mjs';
import {cupDrawPushPayload} from '../lib/cup-draw-notification-policy.mjs';
test('cup draw audience defaults to nobody and rejects unknown roles',()=>{
 assert.deepEqual(validateCupDrawAudience(undefined),[]);
 assert.deepEqual(validateCupDrawAudience(['managers','chairs','managers']),['managers','chairs']);
 for(const v of ['all',null,['Player'],['everyone']])assert.throws(()=>validateCupDrawAudience(v),/audience/i);
});
const snapshot={entries:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'},{team_id:'c',team_name:'Castle'}],rounds:[{round_number:1,name:'Semi Final',fixture_date:'2027-01-01'},{round_number:2,name:'Final',fixture_date:'2027-01-08'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:null,status:'Bye'},{roundNumber:1,matchNumber:2,homeTeamId:'b',awayTeamId:'c',status:'Scheduled'},{roundNumber:2,matchNumber:1,homeTeamId:null,awayTeamId:null,homeSourceMatchNumber:1,awaySourceMatchNumber:2,status:'Awaiting Teams'}]};
test('draw message contains competition, every saved pairing, bye and round dates',()=>{
 const text=cupDrawMessage('Interclub Cup',snapshot);
 assert.match(text,/Interclub Cup draw is confirmed/);assert.match(text,/Alpha \(bye\) v Winner of Preliminary match 1/);assert.match(text,/1\. Beta v Castle/);assert.match(text,/Preliminary round/);assert.match(text,/Final/);assert.match(text,/2027/);
});
test('cup recipient union deduplicates people and applies rollout, channel opt-outs and active push subscription',()=>{
 const config={...policy.defaultNotificationConfig,eligibleRoles:['League Chair','Manager','Player','Administrator']};
 const rows=[{personId:'chair',roles:['League Chair'],preferences:{...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['announcement']},hasPush:true},{personId:'chair',roles:['League Chair'],hasPush:true},{personId:'mgr',roles:['Manager'],preferences:{...policy.defaultNotificationPreferences,inboxTypes:[],pushTypes:[],version:4}},{personId:'player',roles:['Player'],preferences:{...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['announcement']},hasPush:false},{personId:'excluded',roles:['Club Member']},{personId:'admin',roles:['Administrator']}];
 const result=selectCupDrawRecipients(rows,config);
 assert.deepEqual(result.recipients.map(r=>r.personId),['chair','player','admin']);assert.equal(result.summary.matched,5);assert.equal(result.summary.excluded,1);assert.equal(result.summary.skipped,1);
 assert.equal(selectCupDrawRecipients(rows,{...config,enabledTypes:[]}).recipients.length,0);
});
test('large Unicode cup draws fit push payload budget while short draws remain complete',()=>{
 const original={title:'Cup draw confirmed',body:'Full draw\nAlpha v Beta',href:'/?notifications=1',tag:'id',expiresAt:null};assert.deepEqual(cupDrawPushPayload(original),original);
 const result=cupDrawPushPayload({...original,body:'🎱 Alpha v Beta\n'.repeat(1000)});
 assert.ok(Buffer.byteLength(JSON.stringify(result),'utf8')<=3800);assert.match(result.body,/full draw/i);assert.equal(result.href,original.href);
});

test('new draw notices show actual draw rounds and dates without all future-winner placeholders',()=>{
 const extended={...snapshot,rounds:[...snapshot.rounds,{round_number:3,name:'Later final',fixture_date:'2027-01-15'}],bracket:[...snapshot.bracket,{roundNumber:3,matchNumber:1,homeSourceMatchNumber:1,awaySourceMatchNumber:2,status:'Awaiting Teams'}]};
 const text=cupDrawMessage('Cup',extended);assert.match(text,/Later final — 15 Jan 2027/);assert.doesNotMatch(text,/Winner of Final match/);
});
test('announcement selection controls cup draw inbox and push without a separate cup preference',()=>{
 const config={...policy.defaultNotificationConfig,enabledTypes:['announcement']};
 const row={personId:'chair',roles:['League Chair'],hasPush:true,preferences:{version:4,inboxTypes:['announcement'],pushTypes:['announcement'],pushEnabled:true}};
 const result=selectCupDrawRecipients([row],config);assert.deepEqual(result.recipients,[{personId:'chair',inbox:true,push:true}]);
 const now=new Date('2026-10-22T12:00:00Z');assert.equal(policy.canDeliverPush({type:'cup_draw'},row.preferences,config,row.roles,now),true);
 const oldCupOnly={...row,preferences:{version:4,inboxTypes:['cup_draw'],pushTypes:['cup_draw'],pushEnabled:true}};assert.equal(selectCupDrawRecipients([oldCupOnly],config).recipients.length,0);
 assert.equal(selectCupDrawRecipients([row],{...config,enabledTypes:['cup_draw']}).recipients.length,0);
});
