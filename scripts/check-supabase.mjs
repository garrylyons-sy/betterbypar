import {existsSync} from 'node:fs';
import {Client} from 'pg';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function supabaseConnectionTarget(value){
 if(!value)throw new Error('Set DATABASE_URL in .env.local using the new project’s PostgreSQL connection string.');
 let url;try{url=new URL(value);}catch{throw new Error('DATABASE_URL must be a PostgreSQL URL.');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Use the PostgreSQL connection string, rather than a Supabase project/API URL.');
 const direct=/^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
 const user=decodeURIComponent(url.username),pooler=url.hostname.endsWith('.pooler.supabase.com');
 const reference=direct?.[1]??(pooler?/^postgres\.([a-z0-9]+)$/.exec(user)?.[1]:null);
 if(!reference)throw new Error('Use the separate Supabase project’s direct or session-pooler connection string.');
 if(url.port&&url.port!=='5432')throw new Error('Choose the session pooler on port 5432 for this persistent Node server.');
 if(!url.password||decodeURIComponent(url.password).includes('[YOUR-PASSWORD]'))throw new Error('Enter the database password locally in DATABASE_URL.');
 return {host:url.hostname,reference};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 for(const file of ['.env.local','.env'])if(existsSync(file))process.loadEnvFile(file);
 let db;
 try{
  if(process.env.LOCAL_DEMO==='1')throw new Error('Disable LOCAL_DEMO before checking live configuration.');
  const target=supabaseConnectionTarget(process.env.DATABASE_URL);
  console.log(`Checking Supabase project ${target.reference} (${target.host}); no credentials will be printed.`);
  db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,query_timeout:15000,ssl:{rejectUnauthorized:false}});await db.connect();
  await db.query('begin read only');
  const required=['person','user_account','app_session','app_operator','club','club_membership','dependants','lesson_default_week','lesson_slot','lesson_booking','lesson_group','notification_config','notification_email_delivery','golf_round','golf_practice_assignment','golf_round_comment','mobile_session','golf_course','golf_course_tee','golf_course_hole'];
  const result=await db.query('select name,to_regclass(\'public.\'||name)::text as relation from unnest($1::text[]) name',[required]);
  const missing=result.rows.filter(r=>!r.relation).map(r=>r.name);if(missing.length)throw new Error(`Missing tables: ${missing.join(', ')}. Apply the clean installation script to the new empty project.`);
  const counts=(await db.query('select (select count(*)::int from golf_course) as courses,(select count(*)::int from golf_course_tee) as tees,(select count(*)::int from app_operator where active) as administrators')).rows[0];
  await db.query('rollback');
  console.log(`Database ready: ${counts.courses} course layouts, ${counts.tees} tee sets, ${counts.administrators} active administrators.`);
  if(!counts.administrators)console.log('Create the first administrator invitation using docs/deployment/supabase.md.');
 }catch(error){
  // Driver errors may contain connection details; only expose our own validation failures.
  console.error(error?.code?'Database check failed. Check the connection, password, project status and installed schema.':error.message);
  process.exitCode=1;
 }finally{if(db)await db.end();}
}
