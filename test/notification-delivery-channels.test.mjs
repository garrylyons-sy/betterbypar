import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../lib/notification-policy.mjs';
const config=policy.normalizeNotificationConfig({version:5,eligibleRoles:['Club Member'],enabledTypes:['lesson_booking','lesson_reminder','lesson_cancelled','lesson_feedback'],quietStart:'00:00',quietEnd:'00:00'});
test('golf events use configured role eligibility without a special bypass',()=>{
 for(const type of ['lesson_booking','lesson_reminder','lesson_cancelled','lesson_feedback']){
  assert.equal(policy.isEligibleForNotification(type,['Club Member'],config),true);
  assert.equal(policy.isEligibleForNotification(type,['Club Member'],{...config,eligibleRoles:[]}),false);
 }
});
test('email choices support none, app only, email only and both independently',()=>{
 const n={type:'lesson_booking',expires_at:'2031-06-02T12:00Z'},now=new Date('2031-06-02T08:00Z');
 for(const [push,email] of [[false,false],[true,false],[false,true],[true,true]]){
  const prefs=policy.normalizeNotificationPreferences({version:5,inboxTypes:[],pushTypes:['lesson_booking'],pushEnabled:push,emailTypes:['lesson_booking'],emailEnabled:email});
  assert.equal(policy.canDeliverEmail(n,prefs,config,['Club Member'],now),email);
  assert.equal(policy.canDeliverPush(n,prefs,config,['Club Member'],now),push);
 }
});
test('legacy opt-outs remain opted out and email is never enabled by migration',()=>{
 const p=policy.normalizeNotificationPreferences({version:4,inboxTypes:[],pushTypes:[],pushEnabled:false});
 assert.deepEqual(p.inboxTypes,[]);assert.deepEqual(p.pushTypes,[]);assert.equal(p.emailEnabled,false);
 const opted=policy.normalizeNotificationPreferences({version:4,inboxTypes:['lesson_booking'],pushTypes:[],pushEnabled:false});assert.ok(opted.inboxTypes.includes('lesson_reminder'));assert.equal(opted.emailEnabled,false);
});
test('email respects disabled category, role, expiry and quiet time but reading the app does not cancel opted-in email',()=>{
 const p=policy.normalizeNotificationPreferences({version:5,emailEnabled:true,emailTypes:['lesson_booking']});
 const now=new Date('2031-06-02T08:00Z'),n={type:'lesson_booking',read_at:now,expires_at:'2031-06-02T12:00Z'};
 assert.equal(policy.canDeliverEmail(n,p,config,['Club Member'],now),true);
 assert.equal(policy.canDeliverEmail(n,p,{...config,enabledTypes:[]},['Club Member'],now),false);
 assert.equal(policy.canDeliverEmail(n,p,config,[],now),false);
 assert.equal(policy.canDeliverEmail({...n,expires_at:'2030-01-01Z'},p,config,['Club Member'],now),false);
});
