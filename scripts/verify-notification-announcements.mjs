// Live-schema verification inside one rolled-back transaction. Provider dispatch is stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
import * as announcementPolicy from '../lib/announcement-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),{Pool}=require('pg');
for(const file of ['.env.local','.env']){
 if(!fs.existsSync(file))continue;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const match=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^["']|["']$/g,'');
 }
}
assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false}});
const client=await pool.connect();let dispatchCalls=0;
const database={dbQuery:(sql,args)=>client.query(sql,args),withTransaction:callback=>callback(client)};
function compile(file,imports){
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(name=>{
  const dependency=Object.keys(imports).find(key=>name.endsWith(key));
  if(!dependency)throw new Error(`Unexpected dependency ${name}`);
  return imports[dependency];
 },exports);
 return exports;
}
try{
 await client.query('begin');
 const core=compile('../lib/server/notifications.ts',{'/db':database,'/notification-policy.mjs':policy});
 const service=compile('../lib/server/notification-announcements.ts',{'/db':database,'/notifications':core,'/notification-dispatch':{scheduleNotificationPush:()=>{dispatchCalls++;}},'/announcement-policy.mjs':announcementPolicy});
 const initial=await core.loadNotificationConfig(client);
 await client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify({...initial,version:2,enabled:true,eligibleRoles:['League Chair'],enabledTypes:[...new Set([...initial.enabledTypes,'announcement'])]})]);
 const sender=await client.query('select person_id from public.app_operator where active order by person_id limit 1');assert.ok(sender.rows[0]);
 const chairs=await client.query(service.announcementAudienceSql,[null,null,['League Chair']]);assert.ok(chairs.rows[0],'Need an active League Chair.');
 const chair=chairs.rows[0].personId;
 await client.query('insert into public.notification_preference(person_id,preferences) values($1,$2::jsonb) on conflict(person_id) do update set preferences=excluded.preferences',[chair,JSON.stringify({...policy.defaultNotificationPreferences,inboxTypes:['announcement'],pushTypes:[],pushEnabled:false})]);
 const options=await service.loadAnnouncementOptions(client);assert.ok(options.clubs.length&&options.teams.length);
 const team=options.teams[0];
 const scoped=await client.query(service.announcementAudienceSql,[team.clubId,team.id,['Manager']]);
 for(const person of scoped.rows){
  const expected=await client.query(`select 1 from public.team_membership where person_id=$1 and team_id=$2 and active and role::text='Manager' union select 1 from public.person_team_role ptr join public.team t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name join public.club_membership cm on cm.id=ptr.club_membership_id and cm.active where ptr.person_id=$1 and t.id=$2 and ptr.active and ptr.role::text='Manager'`,[person.personId,team.id]);
  assert.ok(expected.rowCount,'Team-manager audience contains an unrelated manager.');
 }
 const draft={title:'Rollback verification only',body:'No announcement from this verification is committed or delivered.',audience:{roles:['League Chair'],clubId:null,teamId:null}};
 const preview=await service.previewAnnouncement(draft,client);assert.ok(preview.inbox>=1);assert.equal(preview.excluded,0);
 const requestId=crypto.randomUUID();
 const first=await service.sendAnnouncement(sender.rows[0].person_id,{...draft,requestId,previewToken:preview.previewToken});assert.equal(first.duplicate,false);assert.equal(dispatchCalls,1);
 const inserted=await client.query('select count(*)::int as count from public.app_notification where event_key=$1',[`announcement:${requestId}`]);assert.equal(inserted.rows[0].count,preview.eligible-preview.skipped);
 const duplicate=await service.sendAnnouncement(sender.rows[0].person_id,{...draft,requestId,previewToken:preview.previewToken});assert.equal(duplicate.duplicate,true);assert.equal(dispatchCalls,1);
 await assert.rejects(service.sendAnnouncement(sender.rows[0].person_id,{...draft,title:'Different draft',requestId,previewToken:preview.previewToken}),error=>error.status===409);
 const stalePreview=await service.previewAnnouncement(draft,client);
 await client.query('update public.notification_preference set preferences=$2::jsonb where person_id=$1',[chair,JSON.stringify({...policy.defaultNotificationPreferences,inboxTypes:[],pushTypes:[],pushEnabled:false})]);
 await assert.rejects(service.sendAnnouncement(sender.rows[0].person_id,{...draft,requestId:crypto.randomUUID(),previewToken:stalePreview.previewToken}),error=>error.status===409);
 await client.query('update public.notification_announcement set sender_person_id=null where id=$1',[requestId]);
 const former=(await service.loadAnnouncementOptions(client)).history.find(item=>item.id===requestId);assert.equal(former?.senderName,'Former administrator');
 const privileges=await client.query("select has_table_privilege('anon','public.notification_announcement','SELECT') as anon,has_table_privilege('authenticated','public.notification_announcement','SELECT') as authenticated");assert.equal(privileges.rows[0].anon,false);assert.equal(privileges.rows[0].authenticated,false);
 console.log('Verified live schema, audience scopes, preview/send SQL, preference-change rejection, idempotent retries, and history permissions. All writes rolled back; real push dispatch was disabled.');
}finally{await client.query('rollback');client.release();await pool.end();}
