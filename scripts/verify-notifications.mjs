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
const {notificationAccess,createNotification,notifyFixtureChanged,notificationSourceIsCurrent}=await import(pathToFileURL(path.join(root,'lib/server/notifications.ts')).href);
const pool=getPool();const client=await pool.connect();
try{
 await client.query('begin');
 const config=await client.query('select config from public.notification_config where singleton=true');
 assert.deepEqual(config.rows[0].config.eligibleRoles,['League Chair'],'Pilot must initially be League Chair only.');
 const tables=['notification_config','notification_preference','app_notification','notification_push_subscription','notification_push_delivery'];
 for(const name of tables){const result=await client.query("select has_table_privilege('anon',$1,'SELECT') as anon,has_table_privilege('authenticated',$1,'SELECT') as authenticated",[`public.${name}`]);assert.equal(result.rows[0].anon,false);assert.equal(result.rows[0].authenticated,false);}
 const people=await client.query(`select distinct p.id from public.person p join public.user_account ua on ua.person_id=p.id and ua.active where p.active`);
 let chair=null,ordinary=null;
 for(const row of people.rows){const access=await notificationAccess(row.id,client);if(access.eligible)chair??=row.id;else ordinary??=row.id;if(chair&&ordinary)break;}
 assert.ok(chair,'Need one active League Chair to verify pilot access.');
 const event={type:'fixture_change',title:'Rollback verification',body:'No persistent notification is created.',href:'/?page=Fixtures',eventKey:`verification:${crypto.randomUUID()}`};
 await client.query(`insert into public.notification_preference(person_id,preferences) values($1,'{"inboxTypes":["fixture_change"],"pushTypes":[],"pushEnabled":false}') on conflict(person_id) do update set preferences=excluded.preferences`,[chair]);
 assert.equal(await createNotification(client,chair,event),true);
 assert.equal(await createNotification(client,chair,event),false,'Duplicate event should not insert twice.');
 if(ordinary)assert.equal(await createNotification(client,ordinary,event),false,'Nonpilot account must not receive inbox.');
 const saved=await client.query('select id,href from public.app_notification where person_id=$1 and event_key=$2',[chair,event.eventKey]);assert.equal(saved.rowCount,1);
 const outbox=await client.query('select count(*)::int as count from public.notification_push_delivery where notification_id=$1',[saved.rows[0].id]);assert.equal(outbox.rows[0].count,0,'Push remains opt-in.');
 await client.query(`update public.notification_config set config=jsonb_set(config,'{enabled}','false') where singleton=true`);
 assert.equal((await notificationAccess(chair,client)).eligible,false);
 assert.equal(await createNotification(client,chair,{...event,eventKey:event.eventKey+':disabled'}),false);
 await client.query('update public.notification_config set config=$1::jsonb where singleton=true',[JSON.stringify(config.rows[0].config)]);
 const fixture=await client.query("select id from public.fixture where status='Scheduled' and fixture_date>now() order by fixture_date limit 1");
 if(fixture.rows[0]){
  await notifyFixtureChanged(client,fixture.rows[0].id);
  const source=await client.query("select id,person_id from public.app_notification where event_key like $1 limit 1",[`fixture:${fixture.rows[0].id}:%`]);
  if(source.rows[0])assert.equal(await notificationSourceIsCurrent(source.rows[0].id,source.rows[0].person_id,client),true,'Fixture source should be current.');
 }
 const {pushReadiness}=await import(pathToFileURL(path.join(root,'lib/server/notification-push.ts')).href);
 console.log(`Optional phone push configured: ${pushReadiness().ready}.`);
 console.log('Verified real database schema, League Chair pilot, opt-in, deduplication, disabled access, and fixture event SQL. All test writes rolled back; no push sent.');
}finally{await client.query('rollback');client.release();await pool.end();}
