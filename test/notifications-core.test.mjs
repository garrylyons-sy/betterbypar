import * as cupInbox from '../lib/cup-draw-inbox.mjs';
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
 new Function('require','exports',compiled)(name=>name.endsWith('cup-draw-inbox.mjs')?cupInbox:name.includes('notification-policy')?policy:db,exports);
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
test('inbox downloads and unread counts both exclude notifications ten days old without deleting records',async()=>{
 const base=handler();
 const query=async(sql,args)=>{
 if(sql.includes('count(*)::integer')){base.calls.push({sql,args});return {rows:[{count:0}]};}
 return base.query(sql,args);
 };
 await server(query).loadNotificationInbox('person-a');
 const reads=base.calls.filter(c=>c.sql.includes('from public.app_notification'));
 assert.equal(reads.length,2);
 for(const read of reads){assert.match(read.sql,/created_at>now\(\)-\(\$2::int\*interval '24 hours'\)/);assert.equal(read.args[1],10);};
 assert.equal(base.calls.some(c=>/delete from/i.test(c.sql)),false);
});
test('old announcements cannot be delivered by the push worker even with a later expiry',async()=>{
 const api=server(async()=>({rows:[{type:'announcement',event_key:'announcement:any',createdAt:new Date(Date.now()-11*86400000),expires_at:new Date(Date.now()+86400000)}]}));
 assert.equal(await api.notificationSourceIsCurrent('old','person-a'),false);
});
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
 assert.match(update.sql,/where person_id=\$1/);assert.deepEqual(update.args,['person-a','other-item',10]);
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
 assert.equal(ladders,undefined);
});
test('ladder creation hooks target actual challenged person and response targets challenger',()=>{
 const source=fs.readFileSync(new URL('../app/api/club/ladder/route.ts',import.meta.url),'utf8');
 assert.match(source,/notifyLadderChallenge\(client, created.rows\[0\].id, \[target.rows\[0\].person_id\], "received"\)/);
 assert.match(source,/notifyLadderChallenge\(client, row.id, \[row.challenger_person_id\], "accepted"\)/);
});
test('reminders reach managers of unpublished teams only and never broadcast ladder deadlines',async()=>{
 const base=handler();const calls=base.calls;const kickoff=new Date(Date.now()+2.5*3600000);
 const query=async(sql,args=[])=>{
 if(sql.includes("where f.status='Scheduled'")) {calls.push({sql,args});return {rows:[{id:'fixture',home_team_id:'home',away_team_id:'away',home_name:'Home',away_name:'Away',fixture_date:kickoff,kickoff}]};}
 if(sql.includes('select team_id from public.fixture_lineup')){calls.push({sql,args});return {rows:[{team_id:'home'}]};}
 if(sql.includes('select distinct person_id from (')){calls.push({sql,args});return {rows:[{person_id:'chair'}]};}
 return base.query(sql,args);
 };
 await server(query).processNotificationReminders();
 const recipients=calls.filter(c=>c.sql.includes('select distinct person_id from ('));
 assert.deepEqual(recipients.map(c=>c.args),[[['away'],['Manager']]]);
 assert.ok(recipients.every(c=>!c.sql.includes("where role='League Chair'")));
 const inserted=calls.filter(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(inserted.length,1);assert.ok(inserted.every(c=>c.args[0]==='chair'));
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
test('source freshness rejects rescheduled/completed fixtures, published teams and changed deadlines',async()=>{
 const kickoff=new Date(Date.now()+2.5*3600000),team='33333333-3333-4333-8333-333333333333',deadline=new Date(kickoff.getTime()-2*3600000);
 for(const variant of ['changed-date','completed','published','deadline-changed','current']){
 const query=async(sql)=>{
 if(sql.startsWith('select type,event_key'))return {rows:[{type:'lineup_reminder',event_key:`fixture:${fixtureId}:${kickoff.toISOString()}:lineup_reminder:schedule:0:team:${team}:deadline:${deadline.toISOString()}`,expires_at:deadline}]};
 if(sql.includes('select f.*'))return {rows:[{id:fixtureId,fixture_date:variant==='changed-date'?new Date(kickoff.getTime()+3600000):kickoff,kickoff,status:variant==='completed'?'Completed':'Scheduled',home_team_id:team,away_team_id:'away'}]};
 if(sql==='select config from public.notification_config where singleton = true')return {rows:[{config:{...policy.defaultNotificationConfig,lineupDeadlineHours:variant==='deadline-changed'?3:2}}]};
 if(sql.startsWith('select team_id'))return {rows:variant==='published'?[{team_id:team}]:[]};
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
 const base=handler();const kickoff=new Date(Date.now()+2.5*3600000);
 const query=async(sql,args=[])=>{
 if(sql.includes("where f.status='Scheduled'"))return {rows:[{id:fixtureId,fixture_date:kickoff,kickoff,status:'Scheduled',notification_schedule_revision:2,home_team_id:'home',away_team_id:'away'}]};
 if(sql.includes("select event_key from public.app_notification"))return {rows:[{event_key:'schedule-revision-2'}]};
 if(sql.includes('select distinct person_id'))return {rows:[{person_id:'manager'}]};
 if(sql.startsWith('select t.name'))return {rows:[{name:'Team B',club_name:'Club B',role:'Manager'}]};
 return base.query(sql,args);
 };
 await server(query).processNotificationReminders();
 const saved=base.calls.filter(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(saved.length,2);
 for(const call of saved){const url=new URL(call.args[4],'https://app.test');assert.equal(url.searchParams.get('team'),'Team B');assert.equal(url.searchParams.get('club'),'Club B');assert.equal(url.searchParams.get('role'),'Manager');assert.ok(call.args[5].includes(':schedule:2:team:'));}
});
test('inbox reuses preloaded notification rows and caches identical source reads per request',async()=>{
 const kickoff=new Date(Date.now()+2.5*3600000),team='33333333-3333-4333-8333-333333333333',deadline=new Date(kickoff.getTime()-2*3600000);
 const base=handler();let fixtureReads=0,lineupReads=0,recipientReads=0,notificationReloads=0;
 const items=Array.from({length:20},(_,i)=>({id:`item-${i}`,type:'lineup_reminder',title:'Lineup',body:'Due',href:'/',event_key:`fixture:${fixtureId}:${kickoff.toISOString()}:lineup_reminder:schedule:${i}:team:${team}:deadline:${deadline.toISOString()}`,expires_at:deadline,createdAt:new Date(),readAt:null}));
 const query=async(sql,args=[])=>{
 if(sql.startsWith('select id,type,title'))return {rows:items};
 if(sql.startsWith('select type,event_key'))notificationReloads++;
 if(sql.includes('select f.*')){fixtureReads++;return {rows:[{id:fixtureId,fixture_date:kickoff,kickoff,status:'Scheduled',notification_schedule_revision:19,home_team_id:team,away_team_id:'away'}]};}
 if(sql.startsWith('select team_id')){lineupReads++;return {rows:[]};}
 if(sql.includes('select distinct person_id')){recipientReads++;return {rows:[{person_id:'manager'}]};}
 if(sql.startsWith('select count(*)::integer'))return {rows:[{count:1}]};
 return base.query(sql,args);
 };
 const result=await server(query).loadNotificationInbox('manager');
 assert.equal(result.items.length,1);assert.equal(result.unreadCount,1);
 assert.equal(fixtureReads,1);assert.equal(lineupReads,1);assert.equal(recipientReads,1);assert.equal(notificationReloads,0);
 assert.ok(result.items.every(item=>!('event_key' in item)&&!('expires_at' in item)));
});

test('inbox SQL uses the configured retention for both downloads and unread counts',async()=>{
 const base=handler({config:{...policy.defaultNotificationConfig,retentionDays:30}});
 const query=async(sql,args)=>{if(sql.includes('count(*)::integer')){base.calls.push({sql,args});return {rows:[{count:0}]};}return base.query(sql,args);};
 await server(query).loadNotificationInbox('person-a');
 const reads=base.calls.filter(c=>c.sql.includes('from public.app_notification'));
 assert.equal(reads.length,2);for(const read of reads)assert.equal(read.args[1],30);
});

test('opponent publication alerts target only opposing managers with a fixture link',async()=>{
 const base=handler({config:{...policy.defaultNotificationConfig,eligibleRoles:['Manager']},roles:['Manager'],preferences:{...policy.defaultNotificationPreferences,pushEnabled:true}});
 const query=async(sql,args=[])=>{
  if(sql.includes('select f.*'))return {rows:[{id:fixtureId,home_team_id:'home',away_team_id:'away',home_name:'Castle A',away_name:'Elm Park A',fixture_date:future,kickoff:future,status:'Scheduled',published_at:future}]};
  if(sql.includes('select distinct person_id from (')){base.calls.push({sql,args});return {rows:[{person_id:'opposing-manager'}]};}
  return base.query(sql,args);
 };
 await server(query).notifyOpponentLineupPublished({query},fixtureId,'home');
 const audience=base.calls.find(c=>c.sql.includes('select distinct person_id'));
 assert.deepEqual(audience.args.slice(0,2),[['away'],['Manager']]);assert.doesNotMatch(audience.sql,/where role='League Chair'/);
 const saved=base.calls.find(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(saved.args[0],'opposing-manager');assert.equal(saved.args[2],'Opponents published');
 assert.equal(saved.args[3],'Castle A have published their line up.');
 assert.match(saved.args[4],/page=Fixtures/);assert.match(saved.args[5],/lineup-published:/);
 assert.equal(saved.args[7],false);
 assert.ok(base.calls.some(c=>c.sql.includes('insert into public.notification_push_delivery')));
});
test('completed match notifications include the score, target League Chairs and open Results',async()=>{
 const base=handler({preferences:{...policy.defaultNotificationPreferences,pushEnabled:true}});
 const query=async(sql,args=[])=>{
  if(sql.includes('select f.*'))return {rows:[{id:fixtureId,status:'Completed',home_name:'Castle A',away_name:'Elm Park A',home_team_score:4,away_team_score:3,league_name:'A League',season_name:'2026/27',fixture_date:future}]};
  if(sql.includes('as competition_id'))return {rows:[{league_id:'league',season_id:'season',competition_id:null}]};
  if(sql.includes('select id from public.team'))return {rows:[{id:'team'}]};
  if(sql.includes("where role='League Chair'")){base.calls.push({sql,args});return {rows:[{person_id:'chair'}]};}
  return base.query(sql,args);
 };
 await server(query).notifyMatchCompleted({query},fixtureId);
 const saved=base.calls.find(c=>c.sql.includes('insert into public.app_notification'));
 assert.equal(saved.args[0],'chair');assert.equal(saved.args[2],'Match completed');assert.match(saved.args[3],/Castle A 4–3 Elm Park A/);assert.match(saved.args[4],/page=Results/);
 assert.equal(saved.args[7],false);
 assert.ok(base.calls.some(c=>c.sql.includes('insert into public.notification_push_delivery')));
});

test('the inbox query excludes transient lineup and result alerts, including legacy rows',async()=>{
 const base=handler();
 const query=async(sql,args)=>{
  if(sql.includes('count(*)::integer')){base.calls.push({sql,args});return {rows:[{count:0}]};}
  return base.query(sql,args);
 };
 await server(query).loadNotificationInbox('person-a');
 const reads=base.calls.filter(c=>c.sql.includes('from public.app_notification'));
 assert.equal(reads.length,2);
 for(const read of reads)assert.match(read.sql,/type not in \('lineup_published','match_result'\)/);
});
test('ladder deadline messages are no longer generated or considered current',async()=>{
 const base=handler();await server(base.query).processNotificationReminders();
 assert.equal(base.calls.some(c=>c.sql.includes("where ch.status in ('Pending','Accepted','Scheduled')")),false);
 const api=server(async()=>({rows:[{type:'ladder_challenge',event_key:`ladder:${challengeId}:deadline:play:future`,expires_at:future}]}));
 assert.equal(await api.notificationSourceIsCurrent('old-deadline','chair'),false);
});

test('reschedules, cancellations and ladder challenges use descriptive messages',async()=>{
 for(const [status,kind,title,body] of [['Scheduled','rescheduled','Match rescheduled',/Castle A v Elm Park A has been rescheduled to/],['Cancelled','updated','Match cancelled',/has been cancelled/]]){
  const base=handler();const query=async(sql,args)=>sql.includes('pg_current_xact_id')||sql.includes('txid_current')?{rows:[{revision:'revision'}]}:sql.includes('select f.*')?{rows:[{id:fixtureId,status,home_name:'Castle A',away_name:'Elm Park A',home_team_id:'home',away_team_id:'away',fixture_date:future,kickoff:future}]}:sql.includes('select distinct person_id from (')?{rows:[{person_id:'chair'}]}:base.query(sql,args);
  await server(query).notifyFixtureChanged({query},fixtureId,[],undefined,kind);
  const saved=base.calls.find(c=>c.sql.includes('insert into public.app_notification'));assert.equal(saved.args[2],title);assert.match(saved.args[3],body);
 }
 const base=handler();const query=async(sql,args)=>sql.includes('select l.name')?{rows:[{name:'Castle ladder',club_name:'Castle',challenger_name:'Alex Murphy',challenged_name:'Chris Byrne',response_due_at:future,play_by:future}]}:base.query(sql,args);
 await server(query).notifyLadderChallenge({query},challengeId,['chair'],'received');
 assert.equal(base.calls.find(c=>c.sql.includes('insert into public.app_notification')).args[3],'You have been challenged by Alex Murphy on Castle ladder. Open the ladder to respond.');
});
test('lineup routes notify first publication and completion within transactions and dispatch after commit',()=>{
 const source=fs.readFileSync(new URL('../app/api/manager/lineup/route.ts',import.meta.url),'utf8');
 assert.match(source,/if \(existingStatus !== "Published"\) await notifyOpponentLineupPublished/);
 assert.match(source,/await completeMatch\(client, fixtureId\);[\s\S]*?await notifyMatchCompleted\(client, fixtureId\)/);
 assert.match(source,/if \(notificationCreated\) scheduleNotificationPush\(\)/);
});
test('cup draw notices remain current only while their confirmed source exists',async()=>{
 for(const current of [false,true]){
  const api=server(async sql=>sql.includes('from public.cup_draw_attempt')?{rows:current?[{exists:1}]:[]}:{rows:[{type:'cup_draw',event_key:`cup-draw:${fixtureId}:${challengeId}`,expires_at:null}]});
  assert.equal(await api.notificationSourceIsCurrent('notice','chair'),current);
 }
});
test('only unpublished-team managers are reminded in the hour before the configured deadline',async()=>{
 for(const enabled of [true,false]){
  const config={...policy.defaultNotificationConfig,lineupDeadlineHours:2,eligibleRoles:['Manager'],enabledTypes:enabled?['lineup_reminder']:[]};
  const base=handler({config,roles:['Manager']});const kickoff=new Date(Date.now()+2.5*3600000);
  const query=async(sql,args=[])=>{
   if(sql.includes("where f.status='Scheduled'")){base.calls.push({sql,args});return {rows:[{id:fixtureId,home_team_id:'home',away_team_id:'away',home_name:'Home',away_name:'Away',fixture_date:kickoff,kickoff}]};}
   if(sql.includes('select team_id from public.fixture_lineup'))return {rows:[{team_id:'home'}]};
   if(sql.includes('select distinct person_id from (')){base.calls.push({sql,args});return {rows:[{person_id:'manager'}]};}
   return base.query(sql,args);
  };
  await server(query).processNotificationReminders();
  const writes=base.calls.filter(c=>c.sql.includes('insert into public.app_notification'));assert.equal(writes.length,enabled?1:0);
  if(enabled){const saved=writes[0];assert.equal(saved.args[1],'lineup_reminder');assert.match(saved.args[3],/You need to publish your team by/);assert.match(saved.args[3],/Away/);assert.equal(new Date(saved.args[6]).getTime(),kickoff.getTime()-2*3600000);
   const audience=base.calls.find(c=>c.sql.includes('select distinct person_id from ('));assert.deepEqual(audience.args,[['away'],['Manager']]);assert.doesNotMatch(audience.sql,/where role='League Chair'/);
  }
 }
});

test('old match and obsolete lineup reminders cannot return to the inbox or phone queue',async()=>{
 for(const type of ['match_reminder','lineup_reminder']){
 const api=server(async()=>({rows:[{type,event_key:`fixture:${fixtureId}:${future.toISOString()}:${type}:initial`,expires_at:future}]}));
 assert.equal(await api.notificationSourceIsCurrent('old','manager'),false);
 }
});
test('schedule revision changes reminder identity even when fixture-change notifications are disabled',async()=>{
 const base=handler({config:{...policy.defaultNotificationConfig,enabledTypes:['lineup_reminder']}});let revision=0;const kickoff=new Date(Date.now()+2.5*3600000);
 const query=async(sql,args=[])=>{
 if(sql.includes("where f.status='Scheduled'"))return {rows:[{id:fixtureId,fixture_date:kickoff,kickoff,home_team_id:'home',away_team_id:'away',home_name:'Home',away_name:'Away',notification_schedule_revision:revision}]};
 if(sql.startsWith('select team_id'))return {rows:[{team_id:'home'}]};
 if(sql.includes('select distinct person_id'))return {rows:[{person_id:'manager'}]};
 return base.query(sql,args);
 };
 await server(query).processNotificationReminders();revision=2;await server(query).processNotificationReminders();
 const keys=base.calls.filter(c=>c.sql.includes('insert into public.app_notification')).map(c=>c.args[5]);assert.equal(keys.length,2);assert.equal(new Set(keys).size,2);
});
test('deleting an inbox message scopes to its owner, hides it and suppresses pending phone delivery',async()=>{
 const {query,calls}=handler();await server(query).dismissNotification('person-a','notice-a');
 const write=calls.find(c=>c.sql.includes('set inbox_visible=false'));assert.deepEqual(write.args,['person-a','notice-a']);assert.match(write.sql,/person_id=\$1/);assert.doesNotMatch(write.sql,/read_at=coalesce/);assert.match(write.sql,/expires_at=/);assert.doesNotMatch(write.sql,/delete from/i);
});
test('existing cup inbox messages receive saved draw time and witness with no extra source read or database rewrite',async()=>{
 const base=handler();let sourceReads=0;
 const query=async(sql,args)=>{
 if(sql.startsWith('select id,type,title'))return {rows:[{id:'cup-notice',type:'cup_draw',title:'Draw',body:'Cup confirmed.',href:'/?notifications=1',event_key:`cup-draw:${fixtureId}:${challengeId}`,createdAt:new Date(),readAt:null,expires_at:null}]};
 if(sql.includes('from public.cup_draw_attempt')){sourceReads++;return {rows:[{drawnAt:new Date('2026-10-21T15:22:00Z'),witnessName:'Pat Witness'}]};}
 if(sql.includes('count(*)::integer'))return {rows:[{count:1}]};
 return base.query(sql,args);
 };
 const inbox=await server(query).loadNotificationInbox('chair');assert.match(inbox.items[0].body,/Draw made at .*16:22.*witnessed by Pat Witness/);assert.equal(sourceReads,1);
 assert.equal(base.calls.some(c=>c.sql.includes('update public.app_notification')),false);
});

test('bulk inbox deletion only selects the owner read messages and retains records and unread messages',async()=>{
 const {query,calls}=handler();await server(query).dismissNotification('person-a');
 const write=calls.find(c=>c.sql.includes('set inbox_visible=false'));
 assert.deepEqual(write.args,['person-a',null]);assert.match(write.sql,/person_id=\$1/);assert.match(write.sql,/\$2::uuid is null and read_at is not null/);assert.match(write.sql,/status='Pending'/);assert.doesNotMatch(write.sql,/delete from/i);
});

test('league results address managers across the matching league and season, with chairs once',async()=>{
 const calls=[];
 const query=async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('as competition_id'))return {rows:[{league_id:'league-a',season_id:'season-now',competition_id:null}]};
  if(sql.includes('select id from public.team'))return {rows:[{id:'home'},{id:'away'},{id:'other-league-team'}]};
  if(sql.includes('select distinct person_id from ('))return {rows:[{person_id:'home-manager'},{person_id:'other-manager'},{person_id:'chair-manager'},{person_id:'chair-manager'}]};
  throw new Error('Unexpected query: '+sql);
 };
 assert.deepEqual(await server(query).matchResultRecipients(fixtureId,{query}),['home-manager','other-manager','chair-manager']);
 const teams=calls.find(c=>c.sql.includes('select id from public.team'));
 assert.deepEqual(teams.args,['league-a','season-now']);assert.match(teams.sql,/league_id=\$1 and season_id=\$2/);
 const managers=calls.find(c=>c.sql.includes('select distinct person_id from ('));
 assert.deepEqual(managers.args,[['home','away','other-league-team'],['Manager']]);
 assert.match(managers.sql,/team_membership/);assert.match(managers.sql,/person_team_role/);assert.match(managers.sql,/where role='League Chair'/);
});
test('cup results use all completed ties in the same cup, including eliminated teams, rather than league or future entrants',async()=>{
 const calls=[];
 const query=async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('as competition_id'))return {rows:[{league_id:'league-a',season_id:'season-now',competition_id:'cup-a'}]};
  if(sql.includes('select distinct unnest'))return {rows:[{id:'finalist'},{id:'eliminated'}]};
  if(sql.includes('select distinct person_id from ('))return {rows:[{person_id:'final-manager'},{person_id:'eliminated-manager'},{person_id:'chair'}]};
  throw new Error('Unexpected query: '+sql);
 };
 assert.deepEqual(await server(query).matchResultRecipients(fixtureId,{query}),['final-manager','eliminated-manager','chair']);
 const teams=calls.find(c=>c.sql.includes('select distinct unnest'));
 assert.deepEqual(teams.args,['cup-a']);assert.match(teams.sql,/cr\.competition_id=\$1/);assert.match(teams.sql,/f\.status='Completed'/);assert.match(teams.sql,/home_team_id,f\.away_team_id/);
 assert.equal(calls.some(c=>c.sql.includes('select id from public.team')),false);
});
test('result push source rechecks manager audience and score before delivery',async()=>{
 for(const [recipient,score,want] of [['manager',4,true],['unrelated',4,false],['manager',5,false]]){
 const query=async(sql)=>{
  if(sql.includes('select f.status,m.home_team_score'))return {rows:[{status:'Completed',home_team_score:score,away_team_score:3}]};
  if(sql.includes('as competition_id'))return {rows:[{league_id:'league-a',season_id:'season-now',competition_id:null}]};
  if(sql.includes('select id from public.team'))return {rows:[{id:'home'}]};
  if(sql.includes('select distinct person_id from ('))return {rows:[{person_id:'manager'}]};
  return {rows:[]};
 };
 assert.equal(await server(query).notificationSourceIsCurrent('n',recipient,{query},{type:'match_result',event_key:`result:${fixtureId}:4:3`}),want);
 }
});

test('completion queues one result push per manager or chair and labels cup results with the cup name',async()=>{
 const base=handler({roles:['Manager'],config:{...policy.defaultNotificationConfig,eligibleRoles:['Manager','League Chair']},preferences:{...policy.defaultNotificationPreferences,pushEnabled:true}});
 const query=async(sql,args)=>{
  if(sql.includes('select f.*'))return {rows:[{status:'Completed',home_name:'Castle A',away_name:'Elm Park A',home_team_score:4,away_team_score:3,league_name:'A League',season_name:'2026/27',cup_name:'Interclub Cup'}]};
  if(sql.includes('as competition_id'))return {rows:[{competition_id:'cup-a'}]};
  if(sql.includes('select distinct unnest'))return {rows:[{id:'team-a'},{id:'knocked-out'}]};
  if(sql.includes('select distinct person_id from ('))return {rows:[{person_id:'manager'},{person_id:'chair-manager'},{person_id:'chair-manager'}]};
  return base.query(sql,args);
 };
 await server(query).notifyMatchCompleted({query},fixtureId);
 const saved=base.calls.filter(c=>c.sql.includes('insert into public.app_notification'));
 assert.deepEqual(saved.map(c=>c.args[0]),['manager','chair-manager']);
 for(const item of saved){assert.match(item.args[3],/Interclub Cup result/);assert.doesNotMatch(item.args[3],/A League result/);assert.match(item.args[4],new RegExp(`fixtureId=${fixtureId}`));assert.equal(item.args[7],false);}
 assert.equal(base.calls.filter(c=>c.sql.includes('insert into public.notification_push_delivery')).length,2);
});
