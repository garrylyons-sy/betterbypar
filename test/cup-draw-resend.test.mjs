import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as cup from '../lib/cup-draw-notification-policy.mjs';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const comp='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222',person='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
function setup({confirmed=true}={}){
 const calls=[],batches=new Map();
 const query=async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('select da.snapshot'))return {rows:confirmed?[{name:'Cup',drawn_at:new Date('2026-10-21T15:22:00Z'),witness_name:'Pat',snapshot:{entries:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'}],rounds:[{round_number:1,name:'Final',fixture_date:'2027-01-01'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:'b',status:'Scheduled'}]}}]:[]};
  if(sql.includes('from public.cup_draw_notification_send where id='))return {rows:batches.has(args[0])?[batches.get(args[0])]:[]};
  if(sql.includes('insert into public.cup_draw_notification_send'))batches.set(args[0],{request_fingerprint:args[4],summary:JSON.parse(args[6])});
  if(sql.startsWith('with competition_teams')||sql.includes('as "hasPush"'))return {rows:[{personId:person,roles:['Manager'],preferences:{...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['announcement']},hasPush:true},{personId:'55555555-5555-4555-8555-555555555555',roles:['Manager']}]};
  return {rows:[],rowCount:1};
 };
 const deps={'@/lib/server/notifications':{roleRowsSql:'select person_id,role from assignments',loadNotificationConfig:async()=>({...policy.defaultNotificationConfig,eligibleRoles:['Manager']})},'@/lib/server/cup-draw-notifications':{cupDrawAudienceSql:'with competition_teams as (select 1) select 1'},'@/lib/cup-draw-notification-policy.mjs':cup};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/server/cup-draw-resend.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,api={};
 new Function('require','exports',source)(name=>deps[name]??require(name),api);
 return {api,client:{query},calls};
}
test('later draw notifications remain unavailable for provisional draws',async()=>{
 const r=setup({confirmed:false});await assert.rejects(r.api.previewCupDrawSend(r.client,comp,attempt,{personIds:[person]}),/confirmed/);
 assert.equal(r.calls.some(c=>c.sql.includes('insert into')),false);
});
test('specific-person preview excludes unselected people and keeps the full witnessed draw',async()=>{
 const r=setup(),preview=await r.api.previewCupDrawSend(r.client,comp,attempt,{personIds:[person]});
 assert.equal(preview.summary.notified,1);assert.equal(preview.summary.inbox,1);assert.equal(preview.summary.push,1);
 assert.match(preview.body,/Alpha v Beta/);assert.match(preview.body,/witnessed by Pat/);assert.ok(preview.previewToken);
 assert.equal(r.calls.some(c=>c.sql.includes('insert into')),false);
});
test('send retries are idempotent while a new request deliberately resends with source-linked events',async()=>{
 const r=setup(),audience={personIds:[person]},preview=await r.api.previewCupDrawSend(r.client,comp,attempt,audience);
 const input={audience,requestId,previewToken:preview.previewToken};
 await r.api.sendCupDrawNotification(r.client,comp,attempt,person,input);
 const duplicate=await r.api.sendCupDrawNotification(r.client,comp,attempt,person,input);assert.equal(duplicate.duplicate,true);
 await r.api.sendCupDrawNotification(r.client,comp,attempt,person,{...input,requestId:'66666666-6666-4666-8666-666666666666'});
 const writes=r.calls.filter(c=>c.sql.includes('insert into public.app_notification'));assert.equal(writes.length,2);
 assert.equal(writes[0].args[2],`cup-draw:${comp}:${attempt}:${requestId}`);assert.equal(JSON.parse(writes[0].args[0]).length,1);
 assert.equal(r.calls.filter(c=>c.sql.includes('insert into public.cup_draw_notification_send')).length,2);
 await assert.rejects(r.api.sendCupDrawNotification(r.client,comp,attempt,person,{...input,audience:{groups:['chairs']}}),/different/);
});
test('empty, mixed or invalid audiences and stale previews cannot send',async()=>{
 const r=setup();
 for(const audience of [{},{groups:[]},{personIds:['bad']},{groups:['bogus']},{personIds:[person],groups:['chairs']}])await assert.rejects(r.api.previewCupDrawSend(r.client,comp,attempt,audience));
 await assert.rejects(r.api.sendCupDrawNotification(r.client,comp,attempt,person,{audience:{groups:['managers']},requestId,previewToken:'stale'}),/changed|Preview/);
 assert.equal(r.calls.some(c=>c.sql.includes('insert into public.app_notification')),false);
});
