import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/server/lesson-reminders.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function worker(accept=true){
 const events=[],calls=[];let dispatches=0;
 const query=async(sql,args)=>{calls.push({sql,args});
  if(sql.startsWith('select r.booking_id'))return {rows:[{booking_id:'booking',revision:'revision',player_person_id:'player',club_id:'club',player_name:'Junior Player',professional_name:'Colin Clancy',club_name:'Castle Golf Club',title:'Castle Cubs',starts_at:'2031-06-02T09:00:00Z',ends_at:'2031-06-02T10:00:00Z'}]};
  if(sql.startsWith('select distinct p.id'))return {rows:[{id:'guardian'}]};
  return {rows:[{id:'grant'}],rowCount:1};
 };
 const deps={'@/lib/server/db':{withTransaction:callback=>callback({query})},'@/lib/server/notifications':{createNotification:async(_client,id,event)=>{events.push({id,...event});return accept;}},'@/lib/server/notification-email':{notificationEmailReady:()=>false},'@/lib/server/notification-dispatch':{scheduleNotificationPush:()=>{dispatches++;}}};
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>deps[id],Date});
 return {run:exports.processLessonReminders,events,calls,get dispatches(){return dispatches;}};
}
test('group reminder publishes its actual duration, group and exact booking through shared notification framework without email configuration',async()=>{
 const w=worker();const stats=await w.run();assert.equal(stats.published,1);assert.equal(stats.emailReady,false);
 assert.match(w.events[0].body,/Castle Cubs, a 60-minute lesson/);assert.equal(w.events[0].id,'guardian');assert.equal(w.events[0].type,'lesson_reminder');
 assert.equal(w.events[0].href,'/lessons?booking=booking#booking-booking');assert.equal(w.events[0].eventKey,'lesson-reminder:booking:revision');assert.equal(w.dispatches,1);
});
test('fully opted-out recipients do not schedule delivery; reminder event is consumed once',async()=>{
 const w=worker(false);const stats=await w.run();assert.equal(stats.published,0);assert.equal(w.dispatches,0);assert.ok(w.calls.some(c=>c.sql.includes('set sent_at=now()')));
});
