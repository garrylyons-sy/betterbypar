import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../lib/notification-policy.mjs';
import * as cup from '../lib/cup-draw-notification-policy.mjs';
function setup({confirmed=true,audience=['managers','admins'],people=[]}={}){
 const calls=[];
 const query=async(sql,args)=>{calls.push({sql,args});if(sql.includes('select da.snapshot'))return {rows:confirmed?[{name:'Cup',notification_audience:audience,snapshot:{entries:[{team_id:'a',team_name:'Alpha'},{team_id:'b',team_name:'Beta'}],rounds:[{round_number:1,name:'Final',fixture_date:'2027-01-01'}],bracket:[{roundNumber:1,matchNumber:1,homeTeamId:'a',awayTeamId:'b',status:'Scheduled'}]}}]:[]};if(sql.startsWith('with competition_teams'))return {rows:people};return {rows:[]};};
 const deps={'@/lib/cup-draw-notification-policy.mjs':cup,'@/lib/server/notifications':{roleRowsSql:'select person_id,role from assignments',loadNotificationConfig:async()=>({...policy.defaultNotificationConfig,eligibleRoles:['Manager','Administrator']})}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/server/cup-draw-notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};new Function('require','exports',source)(name=>deps[name],api);return {api,client:{query},calls};
}
test('cup notices reject provisional source and no audience creates no inbox or outbox entries',async()=>{
 const no=setup({confirmed:false});await assert.rejects(no.api.notifyCupDrawConfirmed(no.client,'cup','attempt'),/confirmed/);assert.equal(no.calls.length,1);
 const empty=setup({audience:[]});const result=await empty.api.notifyCupDrawConfirmed(empty.client,'cup','attempt');assert.equal(result.notified,0);assert.equal(empty.calls.length,1);
});
test('confirmed cup notification saves full draw once per eligible account and queues only opted-in phones',async()=>{
 const r=setup({people:[{personId:'manager',roles:['Manager'],preferences:{...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['cup_draw']},hasPush:true},{personId:'admin',roles:['Administrator']}]});
 const result=await r.api.notifyCupDrawConfirmed(r.client,'cup','attempt');assert.equal(result.notified,2);assert.equal(result.push,1);
 const read=r.calls.find(c=>c.sql.startsWith('with competition_teams'));assert.deepEqual(read.args,['cup',['managers','admins']]);
 const write=r.calls.find(c=>c.sql.includes('insert into public.app_notification'));assert.equal(JSON.parse(write.args[0]).length,2);assert.match(write.args[1],/Alpha v Beta/);assert.equal(write.args[2],'cup-draw:cup:attempt');assert.match(write.sql,/on conflict\(person_id,event_key\) do nothing/);
});
