import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../lib/notification-policy.mjs';

function server(query) {
 const source=fs.readFileSync(new URL('../lib/server/notifications.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const db={dbQuery:query,withTransaction:callback=>callback({query})};
 new Function('require','exports',compiled)(name=>name.includes('notification-policy')?policy:db,exports);
 return exports;
}
function handler(overrides={}) {
 const calls=[];
 const query=async(sql,args=[])=>{
 calls.push({sql,args});
 if(sql==='select config from public.notification_config where singleton = true')return {rows:[{config:overrides.config??policy.defaultNotificationConfig}]};
 if(sql.includes('as roles,np.preferences'))return {rows:overrides.inactive?[]:[{roles:overrides.roles??['League Chair'],preferences:overrides.preferences??policy.defaultNotificationPreferences}]};
 if(sql.includes('insert into public.app_notification'))return {rows:overrides.duplicate?[]:[{id:'notification-1'}],rowCount:overrides.duplicate?0:1};
 return {rows:[],rowCount:0};
 };
 return {calls,query};
}
const event={type:'fixture_change',title:'Changed',body:'Fixture changed',href:'//evil.test',eventKey:'fixture-1'};
test('creation rejects disabled, wrong role and inactive accounts without writing',async()=>{
 for(const overrides of [{config:{...policy.defaultNotificationConfig,enabled:false}},{roles:['Player']},{inactive:true}]){
 const {query,calls}=handler(overrides);assert.equal(await server(query).createNotification({query},'person-a',event),false);
 assert.equal(calls.some(c=>c.sql.includes('insert into public.app_notification')),false);
 }
});
test('inbox-disabled category still queues push independently for that recipient only',async()=>{
 const {query,calls}=handler({preferences:{inboxTypes:[],pushTypes:['fixture_change'],pushEnabled:true}});
 assert.equal(await server(query).createNotification({query},'person-a',event),true);
 const saved=calls.find(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(saved.args[0],'person-a');assert.equal(saved.args[4],'/');assert.equal(saved.args[7],false);
 const queued=calls.find(c=>c.sql.includes('insert into public.notification_push_delivery'));
 assert.deepEqual(queued.args,['notification-1','person-a']);assert.match(queued.sql,/person_id=\$2 and active/);
});
test('duplicate creation cannot requeue delivery and opt-out never queues',async()=>{
 for(const overrides of [{duplicate:true,preferences:{...policy.defaultNotificationPreferences,pushEnabled:true}},{}]){
 const {query,calls}=handler(overrides);await server(query).createNotification({query},'person-a',event);
 assert.equal(calls.some(c=>c.sql.includes('insert into public.notification_push_delivery')),false);
 }
});
test('read updates always scope to signed-in person, even with supplied item ID',async()=>{
 const {query,calls}=handler();await server(query).markNotificationsRead('person-a','other-item');
 const update=calls.find(c=>c.sql.includes('update public.app_notification'));
 assert.match(update.sql,/where person_id=\$1/);assert.deepEqual(update.args,['person-a','other-item']);
});
test('noneligible inbox reveals neither config nor preferences or data',async()=>{
 const {query,calls}=handler({roles:['Manager']});
 assert.deepEqual(await server(query).loadNotificationInbox('person-a'),{eligible:false,items:[],unreadCount:0});
 assert.equal(calls.some(c=>c.sql.includes('from public.app_notification')),false);
});
test('scheduled reminders SQL excludes historical and completed fixtures, scopes managers to missing teams',async()=>{
 const {query,calls}=handler();await server(query).processNotificationReminders();
 const fixtures=calls.find(c=>c.sql.includes('where f.status=\'Scheduled\''));
 assert.ok(fixtures);assert.match(fixtures.sql,/>now\(\)/);assert.match(fixtures.sql,/time '19:30'/);assert.match(fixtures.sql,/Europe\/Dublin/);
 const ladders=calls.find(c=>c.sql.includes("where ch.status in ('Pending','Accepted','Scheduled')"));
 assert.ok(ladders);assert.match(ladders.sql,/end>now\(\)/);
});
test('ladder creation hooks target actual challenged person and response targets challenger',()=>{
 const source=fs.readFileSync(new URL('../app/api/club/ladder/route.ts',import.meta.url),'utf8');
 assert.match(source,/notifyLadderChallenge\(client, created.rows\[0\].id, \[target.rows\[0\].person_id\], "received"\)/);
 assert.match(source,/notifyLadderChallenge\(client, row.id, \[row.challenger_person_id\], "accepted"\)/);
});
test('reminders reach managers of unpublished teams only and never broadcast ladder deadlines',async()=>{
 const base=handler();const calls=base.calls;const kickoff=new Date(Date.now()+2*3600000);
 const query=async(sql,args=[])=>{
 if(sql.includes("where f.status='Scheduled'")) {calls.push({sql,args});return {rows:[{id:'fixture',home_team_id:'home',away_team_id:'away',home_name:'Home',away_name:'Away',fixture_date:kickoff,kickoff}]};}
 if(sql.includes('select team_id from public.fixture_lineup')){calls.push({sql,args});return {rows:[{team_id:'home'}]};}
 if(sql.includes('select distinct person_id from (')){calls.push({sql,args});return {rows:[{person_id:'chair'}]};}
 return base.query(sql,args);
 };
 await server(query).processNotificationReminders();
 const recipients=calls.filter(c=>c.sql.includes('select distinct person_id from ('));
 assert.deepEqual(recipients.map(c=>c.args),[[['home','away'],['Player','Manager']],[['away'],['Manager']]]);
 assert.ok(recipients.every(c=>c.sql.includes("where role='League Chair'")));
 const inserted=calls.filter(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(inserted.length,2);assert.ok(inserted.every(c=>c.args[0]==='chair'));
});
test('fixture changes and completed ladders invalidate stale pending notifications',async()=>{
 const {query,calls}=handler();await server(query).expireLadderNotifications({query},'challenge-a');
 const update=calls.find(c=>c.sql.includes('update public.app_notification'));
 assert.deepEqual(update.args,['ladder:challenge-a:%']);assert.match(update.sql,/expires_at=now\(\)/);
 const source=fs.readFileSync(new URL('../lib/server/notifications.ts',import.meta.url),'utf8');
 assert.match(source,/type in \('match_reminder','lineup_reminder'\)/);
});
test('transactional fixture and challenge changes schedule push dispatch after commit',()=>{
 const matches=fs.readFileSync(new URL('../app/api/admin/matches/route.ts',import.meta.url),'utf8');
 const ladder=fs.readFileSync(new URL('../app/api/club/ladder/route.ts',import.meta.url),'utf8');
 assert.match(matches,/if \(result.notificationCreated\) scheduleNotificationPush\(\)/);
 assert.ok(matches.indexOf('if (result.notificationCreated)')>matches.indexOf('return { matchId, notificationCreated:'));
 assert.match(ladder,/if \(action === "challenge" \|\| action === "respond"\) scheduleNotificationPush\(\)/);
 assert.ok(ladder.indexOf('scheduleNotificationPush();')>ladder.indexOf('const auditResult = result'));
});
const fixtureId='11111111-1111-4111-8111-111111111111';
const challengeId='22222222-2222-4222-8222-222222222222';
const future=new Date(Date.now()+2*3600000);
test('venue edits preserve current scheduled reminders; obsolete dates and cancelled fixtures expire',async()=>{
 const base=handler();
 const query=async(sql,args=[])=>{
 if(sql.includes('select f.*,ht.name'))return {rows:[{id:fixtureId,fixture_date:future,kickoff:future,status:'Scheduled',home_team_id:'home',away_team_id:'away'}]};
 if(sql.includes('txid_current'))return {rows:[{revision:'123'}]};
 return base.query(sql,args);
 };
 await server(query).notifyFixtureChanged({query},fixtureId,[],'Venue updated');
 const update=base.calls.find(c=>c.sql.includes("type in ('match_reminder','lineup_reminder')"));
 assert.match(update.sql,/\$3::text <> 'Scheduled' or event_key not like \$2/);
 assert.deepEqual(update.args,[`fixture:${fixtureId}:%`,`fixture:${fixtureId}:${future.toISOString()}:%`,'Scheduled']);
});
test('lineup publication expires only recipients with no remaining unpublished side',async()=>{
 for(const remaining of [['away-manager','chair'],[]]){
 const calls=[];const query=async(sql,args=[])=>{
 calls.push({sql,args});
 if(sql.startsWith('select home_team_id'))return {rows:[{home_team_id:'home',away_team_id:'away'}]};
 if(sql.startsWith('select team_id'))return {rows:remaining.length?[{team_id:'home'}]:[{team_id:'home'},{team_id:'away'}]};
 if(sql.includes('select distinct person_id'))return {rows:remaining.map(person_id=>({person_id}))};
 return {rows:[]};
 };
 await server(query).refreshFixtureLineupNotifications({query},fixtureId);
 const updated=calls.find(c=>c.sql.startsWith('update public.app_notification'));
 assert.deepEqual(updated.args,[`fixture:${fixtureId}:%`,remaining]);assert.match(updated.sql,/not\(person_id=any\(\$2::uuid\[\]\)\)/);
 }
});
test('source freshness rejects rescheduled/completed fixtures and published lineup reminders',async()=>{
 for(const variant of ['changed-date','completed','published','current']){
 const query=async(sql)=>{
 if(sql.startsWith('select type,event_key'))return {rows:[{type:'lineup_reminder',event_key:`fixture:${fixtureId}:${future.toISOString()}:lineup_reminder:initial`,expires_at:future}]};
 if(sql.includes('select f.*'))return {rows:[{id:fixtureId,fixture_date:variant==='changed-date'?new Date(future.getTime()+3600000):future,kickoff:future,status:variant==='completed'?'Completed':'Scheduled',home_team_id:'home',away_team_id:'away'}]};
 if(sql.startsWith('select team_id'))return {rows:variant==='published'?[{team_id:'home'},{team_id:'away'}]:[]};
 if(sql.includes('select distinct person_id'))return {rows:[{person_id:'manager'}]};
 return {rows:[]};
 };
 assert.equal(await server(query).notificationSourceIsCurrent('item','manager'),variant==='current',variant);
 }
});
test('ladder source freshness rejects accepted received events, withdrawn players and terminal/deadline changes',async()=>{
 for(const variant of ['accepted','withdrawn','completed','deadline-change','current']){
 const kind=variant==='deadline-change'?`deadline:response:${new Date(future.getTime()-1000).toISOString()}`:'received';
 const query=async(sql)=>{
 if(sql.startsWith('select type,event_key'))return {rows:[{type:'ladder_challenge',event_key:`ladder:${challengeId}:${kind}`,expires_at:future}]};
 return {rows:[{status:variant==='accepted'?'Accepted':variant==='completed'?'Completed':'Pending',challenger:'other',challenged:'manager',ladder_active:true,club_active:true,challenger_status:'Active',challenged_status:variant==='withdrawn'?'Withdrawn':'Active',response_due_at:future,play_by:future}]};
 };
 assert.equal(await server(query).notificationSourceIsCurrent('item','manager'),variant==='current',variant);
 }
});
test('received ladder notification expires exactly at response deadline',async()=>{
 const base=handler();const query=async(sql,args=[])=>sql.includes('select l.name')?{rows:[{name:'Ladder',club_name:'Club',response_due_at:future}]}:base.query(sql,args);
 await server(query).notifyLadderChallenge({query},challengeId,['manager'],'received');
 assert.equal(base.calls.find(c=>c.sql.includes('insert into public.app_notification')).args[6],future);
});
test('manager reminder links include their specific team, club and role and schedule revision changes identity',async()=>{
 const base=handler();
 const query=async(sql,args=[])=>{
 if(sql.includes("where f.status='Scheduled'"))return {rows:[{id:fixtureId,fixture_date:future,kickoff:future,status:'Scheduled',home_team_id:'home',away_team_id:'away'}]};
 if(sql.includes("select event_key from public.app_notification"))return {rows:[{event_key:'schedule-revision-2'}]};
 if(sql.includes('select distinct person_id'))return {rows:[{person_id:'manager'}]};
 if(sql.startsWith('select t.name'))return {rows:[{name:'Team B',club_name:'Club B',role:'Manager'}]};
 return base.query(sql,args);
 };
 await server(query).processNotificationReminders();
 const saved=base.calls.filter(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(saved.length,2);
 for(const call of saved){const url=new URL(call.args[4],'https://app.test');assert.equal(url.searchParams.get('team'),'Team B');assert.equal(url.searchParams.get('club'),'Club B');assert.equal(url.searchParams.get('role'),'Manager');assert.ok(call.args[5].endsWith(':schedule-revision-2'));}
});
test('inbox reuses preloaded notification rows and caches identical source reads per request',async()=>{
 const base=handler();let fixtureReads=0,lineupReads=0,recipientReads=0,notificationReloads=0;
 const items=Array.from({length:20},(_,i)=>({id:`item-${i}`,type:'lineup_reminder',title:'Lineup',body:'Due',href:'/',event_key:`fixture:${fixtureId}:${future.toISOString()}:lineup_reminder:revision-${i}`,expires_at:future,createdAt:future,readAt:null}));
 const query=async(sql,args=[])=>{
 if(sql.startsWith('select id,type,title'))return {rows:items};
 if(sql.startsWith('select type,event_key'))notificationReloads++;
 if(sql.includes('select f.*')){fixtureReads++;return {rows:[{id:fixtureId,fixture_date:future,kickoff:future,status:'Scheduled',home_team_id:'home',away_team_id:'away'}]};}
 if(sql.startsWith('select team_id')){lineupReads++;return {rows:[]};}
 if(sql.includes('select distinct person_id')){recipientReads++;return {rows:[{person_id:'manager'}]};}
 if(sql.startsWith('select count(*)::integer'))return {rows:[{count:20}]};
 return base.query(sql,args);
 };
 const result=await server(query).loadNotificationInbox('manager');
 assert.equal(result.items.length,20);assert.equal(result.unreadCount,20);
 assert.equal(fixtureReads,1);assert.equal(lineupReads,1);assert.equal(recipientReads,1);assert.equal(notificationReloads,0);
 assert.ok(result.items.every(item=>!('event_key' in item)&&!('expires_at' in item)));
});
