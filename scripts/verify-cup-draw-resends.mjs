// Read-only/rollback verification against the configured database. No delivery occurs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const root=process.cwd();
for(const name of ['.env.local','.env']){
 const location=path.join(root,name);if(!fs.existsSync(location))continue;
 for(const line of fs.readFileSync(location,'utf8').split(/\r?\n/)){
  const match=line.trim().match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^["']|["']$/g,'');
 }
}
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
registerHooks({
 resolve(specifier,context,next){
  if(specifier.startsWith('@/')){let target=path.join(root,specifier.slice(2));if(!path.extname(target))target+='.ts';return {url:pathToFileURL(target).href,shortCircuit:true};}
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith(pathToFileURL(root+'/').href)&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(fs.readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
  return next(url,context);
 }
});
const {getPool}=await import(pathToFileURL(path.join(root,'lib/server/db.ts')).href);
const {previewCupDrawSend,sendCupDrawNotification,cupDrawSendOptions}=await import(pathToFileURL(path.join(root,'lib/server/cup-draw-resend.ts')).href);
const {notificationSourceIsCurrent}=await import(pathToFileURL(path.join(root,'lib/server/notifications.ts')).href);
const pool=getPool(),client=await pool.connect(),requestId=crypto.randomUUID();
let eventKey;
try {
 await client.query('begin');
 const security=await client.query("select c.relrowsecurity,has_table_privilege('anon','public.cup_draw_notification_send','SELECT') as anon,has_table_privilege('authenticated','public.cup_draw_notification_send','SELECT') as authenticated from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cup_draw_notification_send'");
 assert.equal(security.rows[0]?.relrowsecurity,true);assert.equal(security.rows[0]?.anon,false);assert.equal(security.rows[0]?.authenticated,false);
 const draw=(await client.query("select da.id,da.competition_id from public.cup_draw_attempt da join public.cup_competition cc on cc.id=da.competition_id where da.status='Confirmed' and cc.status in ('In Progress','Complete') order by da.created_at desc limit 1")).rows[0];
 assert.ok(draw,'Need one confirmed cup draw for rollback verification.');
 const actor=(await client.query('select person_id from public.app_operator where active limit 1')).rows[0];assert.ok(actor);
 const options=await cupDrawSendOptions(client,draw.competition_id,draw.id);assert.ok(options.people.length);assert.match(options.body,/witnessed by/);
 const available=await previewCupDrawSend(client,draw.competition_id,draw.id,{groups:['chairs','admins','managers','players']});
 assert.ok(available.recipients.length,'Need one eligible recipient for rollback verification.');
 const personId=available.recipients[0].personId,audience={personIds:[personId]};
 const preview=await previewCupDrawSend(client,draw.competition_id,draw.id,audience);assert.equal(preview.summary.notified,1);
 const input={audience,requestId,previewToken:preview.previewToken};
 const first=await sendCupDrawNotification(client,draw.competition_id,draw.id,actor.person_id,input);assert.equal(first.duplicate,false);
 const retry=await sendCupDrawNotification(client,draw.competition_id,draw.id,actor.person_id,input);assert.equal(retry.duplicate,true);
 eventKey=`cup-draw:${draw.competition_id}:${draw.id}:${requestId}`;
 const messages=await client.query('select id,person_id from public.app_notification where event_key=$1',[eventKey]);assert.equal(messages.rows.length,1);assert.equal(messages.rows[0].person_id,personId);
 assert.equal(await notificationSourceIsCurrent(messages.rows[0].id,personId,client),true);
 const history=await cupDrawSendOptions(client,draw.competition_id,draw.id);assert.ok(history.history.some(row=>row.id===requestId));
 await client.query('rollback');
 assert.equal((await client.query('select id from public.cup_draw_notification_send where id=$1',[requestId])).rows.length,0);
 assert.equal((await client.query('select id from public.app_notification where event_key=$1',[eventKey])).rows.length,0);
 console.log('Verified RLS, confirmed draw preview, named recipient, retry protection, source validation and history. All test messages and outbox entries rolled back; no push dispatch called.');
} finally {await client.query('rollback');client.release();await pool.end();}
