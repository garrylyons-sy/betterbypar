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
 assert.equal(migrated.version,4);
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

test('ten-day lifetime removes messages and their unread badges at the exact boundary without mutating saved data',async()=>{
 const {notificationLifetimeMs,isNotificationWithinLifetime,pruneNotificationInbox}=await import('../lib/notification-policy.mjs');
 const now=Date.parse('2026-10-21T12:00:00Z');
 assert.equal(notificationLifetimeMs,864000000);
 assert.equal(isNotificationWithinLifetime(new Date(now-notificationLifetimeMs+1),now),true);
 assert.equal(isNotificationWithinLifetime(new Date(now-notificationLifetimeMs),now),false);
 const old=new Date(now-notificationLifetimeMs).toISOString(),recent=new Date(now-1000).toISOString();
 const state={eligible:true,unreadCount:2,items:[{id:'old-unread',createdAt:old,readAt:null},{id:'old-read',createdAt:old,readAt:old},{id:'recent',createdAt:recent,readAt:null}]};
 const filtered=pruneNotificationInbox(state,now);
 assert.deepEqual(filtered.items.map(item=>item.id),['recent']);assert.equal(filtered.unreadCount,1);
 assert.equal(state.items.length,3);assert.equal(state.unreadCount,2);
 assert.equal(pruneNotificationInbox(filtered,now),filtered);
});

test('notification retention is configurable with a compatible ten-day default and strict limits',async()=>{
 const {normalizeNotificationConfig,validateNotificationConfig,notificationLifetimeMsFor,isNotificationWithinLifetime,pruneNotificationInbox}=await import('../lib/notification-policy.mjs');
 assert.equal(normalizeNotificationConfig({}).retentionDays,10);
 assert.equal(normalizeNotificationConfig({retentionDays:30}).retentionDays,30);
 for(const retentionDays of [0,366,1.5,'10',null])assert.throws(()=>validateNotificationConfig({...config,retentionDays}),/Retention/);
 assert.equal(notificationLifetimeMsFor(30),30*86400000);
 const now=Date.now(),created=new Date(now-15*86400000).toISOString();
 assert.equal(isNotificationWithinLifetime(created,now,30),true);
 const inbox={items:[{createdAt:created,readAt:null}],unreadCount:1,config:{retentionDays:30}};
 assert.equal(pruneNotificationInbox(inbox,now).items.length,1);
 assert.equal(pruneNotificationInbox({...inbox,config:{retentionDays:3}},now).items.length,0);
});

test('new event types upgrade once without expanding existing push opt-ins',async()=>{
 const {normalizeNotificationConfig,normalizeNotificationPreferences}=await import('../lib/notification-policy.mjs');
 const old={version:2,enabledTypes:['fixture_change']};const config=normalizeNotificationConfig(old);
 assert.ok(config.enabledTypes.includes('lineup_published'));assert.ok(config.enabledTypes.includes('match_result'));
 const prefs=normalizeNotificationPreferences({version:2,inboxTypes:['fixture_change'],pushTypes:['fixture_change'],pushEnabled:true});
 assert.ok(prefs.inboxTypes.includes('lineup_published'));assert.ok(prefs.inboxTypes.includes('match_result'));assert.deepEqual(prefs.pushTypes,['fixture_change']);
 assert.deepEqual(normalizeNotificationPreferences({...prefs,inboxTypes:[]}).inboxTypes,[]);
 assert.deepEqual(normalizeNotificationConfig({...config,enabledTypes:[]}).enabledTypes,[]);
});

test('cup draw category upgrades once and keeps push opt-in and Admin role eligibility independent',async()=>{
 const p=await import('../lib/notification-policy.mjs');
 const c=p.normalizeNotificationConfig({version:3,enabledTypes:[],eligibleRoles:['Administrator']});
 assert.ok(c.enabledTypes.includes('cup_draw'));assert.equal(p.isNotificationEligible(['Administrator'],c),true);assert.equal(p.isNotificationEligible(['Manager'],c),false);
 assert.equal(p.normalizeNotificationConfig({...c,enabledTypes:[]}).enabledTypes.includes('cup_draw'),false);
 const prefs=p.normalizeNotificationPreferences({version:3,inboxTypes:[],pushTypes:[],pushEnabled:true});assert.ok(prefs.inboxTypes.includes('cup_draw'));assert.equal(prefs.pushTypes.includes('cup_draw'),false);
 assert.equal(p.normalizeNotificationPreferences({...prefs,inboxTypes:[]}).inboxTypes.includes('cup_draw'),false);
});
