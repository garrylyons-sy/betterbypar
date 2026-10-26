import {readFile} from 'node:fs/promises';
import {scryptSync,randomBytes} from 'node:crypto';
import {localDemoAccounts,localDemoPassword} from '../lib/local-demo.mjs';

export async function initializeLocalDemo(db){
  const exists=(await db.query("select to_regclass('public.person') is not null as ready")).rows[0].ready;
  if(!exists){
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';create function auth.jwt() returns jsonb language sql as 'select null::jsonb';`);
    for(const file of ['schema.sql','system_settings.sql','club_ladders.sql','golf_foundation.sql']){
      await db.exec(await readFile(new URL(`../supabase/${file}`,import.meta.url),'utf8'));
    }
  }
  const diaryReady=(await db.query("select to_regclass('public.lesson_default_week') as ready")).rows[0].ready;
  if(!diaryReady){
    await db.exec(await readFile(new URL('../supabase/lesson_diary.sql',import.meta.url),'utf8'));
    // Existing demo-only, unbooked sample slots become half-hour lessons.
    await db.exec("update lesson_slot s set ends_at=starts_at+interval '30 minutes' where not exists(select 1 from lesson_booking where slot_id=s.id)");
  }
  if(!(await db.query("select to_regclass('public.notification_config') as ready")).rows[0].ready){
    await db.exec(await readFile(new URL('../supabase/notifications.sql',import.meta.url),'utf8'));
  }
  const bookingNotificationsReady=(await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='lesson_booking' and column_name='reminder_person_id'")).rows.length;
  if(!bookingNotificationsReady)await db.exec(await readFile(new URL('../supabase/lesson_booking_notifications.sql',import.meta.url),'utf8'));
  if(!(await db.query("select to_regclass('public.lesson_group') as ready")).rows[0].ready)await db.exec(await readFile(new URL('../supabase/lesson_groups.sql',import.meta.url),'utf8'));
  if(!(await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='club' and column_name='show_lesson_attendee_names'")).rows.length)await db.exec(await readFile(new URL('../supabase/lesson_booking_privacy.sql',import.meta.url),'utf8'));
  const playerRegistrationReady=(await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='person' and column_name='is_golf_player'")).rows.length;
  if(!playerRegistrationReady)await db.exec(await readFile(new URL('../supabase/golf_players.sql',import.meta.url),'utf8'));
  if(!(await db.query("select to_regclass('public.notification_email_delivery') as ready")).rows[0].ready)await db.exec(await readFile(new URL('../supabase/notification_email.sql',import.meta.url),'utf8'));
  if(!(await db.query("select to_regclass('public.golf_round') as ready")).rows[0].ready)await db.exec(await readFile(new URL('../supabase/golf_rounds.sql',import.meta.url),'utf8'));
  if(!(await db.query("select to_regclass('public.golf_practice_assignment') as ready")).rows[0].ready)await db.exec(await readFile(new URL('../supabase/coaching_practice.sql',import.meta.url),'utf8'));
  if(!(await db.query("select to_regclass('public.golf_round_comment') as ready")).rows[0].ready)await db.exec(await readFile(new URL('../supabase/round_coaching.sql',import.meta.url),'utf8'));
  await updateDemoClubNames(db);
  if((await db.query("select 1 from public.person where email='admin@example.test'")).rows.length){
    if(!playerRegistrationReady)await seedDemoPlayerRegistration(db);
    await refreshDemoLessons(db);
    await seedDemoDiaryDefaults(db);
    await seedDemoGroups(db);
    await db.query("update lesson_slot s set diary_managed=true where ends_at=starts_at+interval '30 minutes' and title in ('Short game coaching','Swing fundamentals','Junior golf lesson') and not exists(select 1 from lesson_booking where slot_id=s.id and status='Booked')");
    return;
  }
  await db.transaction(async tx=>{
    const people={};
    const salt=randomBytes(16).toString('base64url');
    const passwordHash=`scrypt$${salt}$${scryptSync(localDemoPassword,salt,64).toString('base64url')}`;
    for(const account of localDemoAccounts){
      const [firstName,...rest]=account.name.split(' ');
      people[account.key]=(await tx.query(`insert into public.person(first_name,last_name,email) values($1,$2,$3) returning id`,[firstName,rest.join(' '),account.email])).rows[0].id;
      await tx.query('insert into public.user_account(person_id,username,password_hash) values($1,$2,$3)',[people[account.key],account.email,passwordHash]);
    }
    people.junior=(await tx.query("insert into public.person(first_name,last_name) values('Casey','Parker') returning id")).rows[0].id;
    const primary=(await tx.query(`insert into public.club(name,venue,logo_path,primary_color,accent_color) values('Castle Golf Club','Castle clubhouse','/demo-club.svg','#061F3E','#D7A84B') returning id`)).rows[0].id;
    const secondary=(await tx.query(`insert into public.club(name,venue,logo_path,primary_color,accent_color) values('Woodland Golf Club','Woodland clubhouse','/demo-club.svg','#173A59','#72A8B7') returning id`)).rows[0].id;
    for(const personId of Object.values(people)){
      await tx.query("insert into public.club_membership(club_id,person_id,role,is_club_admin) values($1,$2,'Club Member',$3)",[primary,personId,personId===people.clubadmin]);
    }
    await tx.query('insert into public.club_admin(club_id,person_id) values($1,$2)',[primary,people.clubadmin]);
    await tx.query("insert into public.club_membership(club_id,person_id,role) values($1,$2,'Golf Professional'),($1,$3,'Assistant Professional')",[primary,people.professional,people.assistant]);
    await tx.query("insert into public.club_membership(club_id,person_id,role,is_club_admin) values($1,$2,'Club Member',true),($1,$3,'Golf Professional',false)",[secondary,people.admin,people.professional]);
    await tx.query('insert into public.club_admin(club_id,person_id) values($1,$2)',[secondary,people.admin]);
    await tx.query('insert into public.app_operator(person_id) values($1)',[people.admin]);
    await seedDemoPlayerRegistration(tx);
    await tx.query("insert into public.dependants(club_id,guardian_person_id,dependant_person_id,relationship,created_by) values($1,$2,$3,'Parent',$4)",[primary,people.parent,people.junior,people.admin]);
    await tx.query("insert into public.season(name,starts_on,ends_on,active) values('2026/27','2026-09-01','2027-08-31',true)");
    await tx.query("insert into public.league(name,playing_day) values('A League','Thursday'),('B League','Thursday'),('C League','Monday') on conflict(name) do nothing");
  });
  await refreshDemoLessons(db);
    await seedDemoDiaryDefaults(db);
    await seedDemoGroups(db);
    await db.query("update lesson_slot s set diary_managed=true where ends_at=starts_at+interval '30 minutes' and title in ('Short game coaching','Swing fundamentals','Junior golf lesson') and not exists(select 1 from lesson_booking where slot_id=s.id and status='Booked')");
}

async function refreshDemoLessons(db){
  const club=(await db.query("select id from public.club where name='Castle Golf Club'")).rows[0];
  const people=Object.fromEntries((await db.query("select email,id from public.person where email in ('admin@example.test','professional@example.test','assistant@example.test')")).rows.map(p=>[p.email,p.id]));
  if(!club || !people['admin@example.test'] || !people['professional@example.test'] || !people['assistant@example.test'])return;
  for(let day=1;day<=3;day++){
    for(const [email,title,hour] of [['professional@example.test','Short game coaching',10],['professional@example.test','Swing fundamentals',11],['assistant@example.test','Junior golf lesson',14]]){
      const starts=new Date();starts.setUTCDate(starts.getUTCDate()+day);starts.setUTCHours(hour,0,0,0);
      const ends=new Date(starts.getTime()+30*60*1000);
      await db.query(`insert into public.lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by)
        select $1,$2,$3,$4,$5,$6 where not exists(
          select 1 from public.lesson_slot where professional_person_id=$2 and starts_at<$5 and ends_at>$4
        )`,[club.id,people[email],title,starts.toISOString(),ends.toISOString(),people['admin@example.test']]);
    }
  }
}

async function seedDemoDiaryDefaults(db){
 const club=(await db.query("select id from club where name='Castle Golf Club'")).rows[0];
 if(!club)return;
 for(const [email,ranges] of [['professional@example.test',[0,1,2,3,4].map(day=>({day,start:'09:00',end:'12:00'}))],['assistant@example.test',[2,5].map(day=>({day,start:'14:00',end:'16:00'}))]]){
   await db.query(`insert into lesson_default_week(club_id,professional_person_id,ranges) select $1,id,$2::jsonb from person where email=$3 on conflict(club_id,professional_person_id) do nothing`,[club.id,JSON.stringify(ranges),email]);
 }
}

// Upgrade persisted sample identities without replacing their IDs, bookings or appointments.
export async function updateDemoClubNames(db){
 await db.query(`with renamed_club as (
   update public.club set name='Castle Golf Club',venue=case when venue='Harbour clubhouse' then 'Castle clubhouse' else venue end
   where name='Harbour Golf Club' returning id
 ), renamed_professional as (
   update public.person set first_name='Colin',last_name='Clancy'
   where email='professional@example.test' and first_name='Rory' and last_name='Evans' returning id
 ) update public.person set first_name='Shane',last_name='Comer'
   where email='assistant@example.test' and first_name='Sam' and last_name='Casey'`);
}

async function seedDemoGroups(db){
 await db.query(`insert into lesson_group(club_id,professional_person_id,name,mode,capacity,created_by)
  select c.id,p.id,'Castle Cubs','Open',8,p.id from club c cross join person p where c.name='Castle Golf Club' and p.email='professional@example.test'
  on conflict(club_id,professional_person_id,name) do nothing`);
}

// Fictional local-demo identifiers only; never backfill real people with invented numbers.
async function seedDemoPlayerRegistration(db){
 const demoPlayers=[['member@example.test','9990000001'],['parent@example.test','9990000002'],['clubadmin@example.test','9990000003'],['admin@example.test','9990000004']];
 for(const [email,number] of demoPlayers)await db.query('update public.person set is_golf_player=true,golf_ireland_number=$2 where email=$1 and not public.is_golf_coach(id)',[email,number]);
 await db.query("update public.person set is_golf_player=true,golf_ireland_number='9990000005' where first_name='Casey' and last_name='Parker' and email is null and not public.is_golf_coach(id)");
}
