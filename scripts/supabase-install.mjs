import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Explicit clean-install order: never glob the inherited historical import scripts.
export const supabaseInstallFiles=Object.freeze([
 'schema.sql','system_settings.sql','club_ladders.sql','golf_foundation.sql',
 'lesson_diary.sql','notifications.sql','lesson_booking_notifications.sql',
 'lesson_groups.sql','lesson_booking_privacy.sql','golf_players.sql','notification_email.sql',
 'golf_rounds.sql','coaching_practice.sql','round_coaching.sql','mobile_sessions.sql',
 'golf_course_catalogue.sql','golf_course_catalogue_seed.sql','mobile_google.sql'
]);
export function buildSupabaseInstall(){
 return '-- Better By Par: NEW, EMPTY Supabase project only.\n'+
 '-- Generated with npm run db:prepare. Contains no accounts, club memberships or historical results.\n'+
 '-- These migrations contain transaction boundaries. If interrupted, restore a fresh empty project before retrying.\n'+
 `do $$ begin\n if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')) then\n raise exception 'Installation requires an empty Better By Par database. Existing app data was found.';\n end if;\nend $$;\n\n`+
 supabaseInstallFiles.map(file=>`-- BEGIN ${file}\n${readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8')}\n-- END ${file}\n`).join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const destination=resolve(process.argv[2]??'supabase/install.generated.sql');
 writeFileSync(destination,buildSupabaseInstall(),{mode:0o600});
 console.log(`Prepared ${supabaseInstallFiles.length} migrations: ${destination}`);
 console.log('Review and run this file only in the empty, separate Better By Par Supabase project.');
}
