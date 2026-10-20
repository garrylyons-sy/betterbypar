import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultNotificationConfig as config, defaultNotificationPreferences as prefs, isNotificationEligible, isQuietTime, canDeliverPush, safeNotificationHref, validateNotificationConfig, reminderIsDue, fixtureEventKey } from '../lib/notification-policy.mjs';
test('pilot eligibility requires enabled current chair role', () => {
 assert.equal(isNotificationEligible(['Player'], config), false);
 assert.equal(isNotificationEligible(['League Chair'], config), true);
 assert.equal(isNotificationEligible(['League Chair'], {...config, enabled:false}), false);
});
test('Dublin quiet hours cross midnight and account for summer time', () => {
 assert.equal(isQuietTime(new Date('2026-07-01T21:30:00Z'), config), true);
 assert.equal(isQuietTime(new Date('2026-07-01T08:30:00Z'), config), false);
 assert.equal(isQuietTime(new Date(), {...config,quietStart:'08:00',quietEnd:'08:00'}), false);
});
test('push needs opt-in unread unexpired eligible item and independent push category', () => {
 const n={type:'fixture_change',read_at:null,expires_at:'2026-10-21T12:00:00Z'};
 const now=new Date('2026-10-20T12:00:00Z');
 assert.equal(canDeliverPush(n,prefs,config,['League Chair'],now),false);
 assert.equal(canDeliverPush(n,{...prefs,pushEnabled:true,inboxTypes:[]},config,['League Chair'],now),true);
 assert.equal(canDeliverPush({...n,read_at:'x'},{...prefs,pushEnabled:true},config,['League Chair'],now),false);
 assert.equal(canDeliverPush(n,{...prefs,pushEnabled:true},config,['Player'],now),false);
 assert.equal(canDeliverPush({...n,expires_at:'2026-10-19T12:00:00Z'},{...prefs,pushEnabled:true},config,['League Chair'],now),false);
 assert.equal(canDeliverPush({...n,expires_at:'invalid'},{...prefs,pushEnabled:true},config,['League Chair'],now),false);
});
test('safe destinations and strict config validation',()=>{
 for(const href of ['https://evil.test','//evil.test','/\\evil.test','/x\n']) assert.equal(safeNotificationHref(href),'/');
 assert.equal(safeNotificationHref('/club/ladder?club=Test'),'/club/ladder?club=Test');
 assert.throws(()=>validateNotificationConfig({...config,matchReminderHours:0}));
});
test('reminders never flood historical deadlines and reschedules get distinct keys',()=>{
 const now=new Date('2026-10-20T12:00:00Z');
 assert.equal(reminderIsDue('2026-10-19T12:00:00Z',24,now),false);
 assert.equal(reminderIsDue('invalid',24,now),false);
 assert.equal(reminderIsDue('2026-10-21T11:00:00Z',24,now),true);
 assert.equal(reminderIsDue('2026-10-22T12:00:00Z',24,now),false);
 assert.notEqual(fixtureEventKey('x','2026-10-21T12:00:00Z'),fixtureEventKey('x','2026-10-22T12:00:00Z'));
});

test('announcements migrate inbox/config once without opting existing devices into new push category', async()=>{
 const {normalizeNotificationConfig,normalizeNotificationPreferences,defaultNotificationPreferences}=await import('../lib/notification-policy.mjs');
 const oldTypes=['fixture_change','match_reminder','lineup_reminder','ladder_challenge'];
 const migrated=normalizeNotificationConfig({...config,version:undefined,enabledTypes:oldTypes});
 assert.ok(migrated.enabledTypes.includes('announcement'));
 assert.equal(migrated.version,2);
 const preferences=normalizeNotificationPreferences({inboxTypes:oldTypes,pushTypes:oldTypes,pushEnabled:true});
 assert.ok(preferences.inboxTypes.includes('announcement'));
 assert.equal(preferences.pushTypes.includes('announcement'),false);
 assert.equal(preferences.pushEnabled,true);
 assert.equal(defaultNotificationPreferences.pushTypes.includes('announcement'),false);
 assert.equal(normalizeNotificationPreferences({...preferences,inboxTypes:[],pushTypes:[]}).inboxTypes.includes('announcement'),false);
 assert.equal(normalizeNotificationConfig({...migrated,enabledTypes:[]}).enabledTypes.includes('announcement'),false);
});
test('announcements still require role eligibility, account opt-in and per-type push opt-in',()=>{
 const n={type:'announcement',expires_at:'2026-10-21T12:00:00Z'};
 const now=new Date('2026-10-20T12:00:00Z');
 assert.equal(canDeliverPush(n,{...prefs,pushEnabled:true},config,['League Chair'],now),false);
 assert.equal(canDeliverPush(n,{...prefs,pushEnabled:true,pushTypes:['announcement']},config,['League Chair'],now),true);
 assert.equal(canDeliverPush(n,{...prefs,pushEnabled:true,pushTypes:['announcement']},config,['Player'],now),false);
});
