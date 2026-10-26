-- Apply after golf_foundation.sql. App-owned APIs enforce scoped access.
begin;
create table public.lesson_default_week (
 club_id uuid not null references public.club(id), professional_person_id uuid not null references public.person(id),
 ranges jsonb not null default '[]' check(jsonb_typeof(ranges)='array'), updated_at timestamptz not null default now(),
 primary key(club_id,professional_person_id)
);
create table public.lesson_week_override (
 club_id uuid not null references public.club(id), professional_person_id uuid not null references public.person(id),
 week_start date not null check(extract(isodow from week_start)=1), ranges jsonb not null check(jsonb_typeof(ranges)='array'),
 updated_at timestamptz not null default now(), primary key(club_id,professional_person_id,week_start)
);
alter table public.lesson_slot add column diary_managed boolean not null default false;
alter table public.lesson_slot add constraint lesson_diary_half_hour check(not diary_managed or ends_at=starts_at+interval '30 minutes');
alter table public.lesson_booking add column goals text not null default '' check(length(goals)<=2000),
 add column reminder_minutes integer not null default 1440 check(reminder_minutes in (0,30,60,120,1440,2880)),
 add column feedback text not null default '' check(length(feedback)<=4000),
 add column drills text not null default '' check(length(drills)<=4000),
 add column feedback_by uuid references public.person(id), add column feedback_at timestamptz;
create table public.lesson_reminder (
 booking_id uuid primary key references public.lesson_booking(id),
 available_at timestamptz not null, sent_at timestamptz, attempts integer not null default 0,
 last_error text, locked_until timestamptz, revision uuid not null default gen_random_uuid()
);
insert into public.lesson_reminder(booking_id,available_at)
 select id,greatest(now(),starts_at-reminder_minutes*interval '1 minute') from public.lesson_booking where status='Booked' and starts_at>now() and reminder_minutes>0;
-- Feedback and reminder changes on an unchanged booking must remain possible after a lesson.
create or replace function public.golf_validate_booking() returns trigger language plpgsql set search_path=public as $$
declare slot public.lesson_slot;
begin
 if new.status='Cancelled' then return new; end if;
 if tg_op='UPDATE' and new.slot_id=old.slot_id and new.player_person_id=old.player_person_id and new.booked_by=old.booked_by and new.starts_at=old.starts_at and new.ends_at=old.ends_at and old.status='Booked' then return new; end if;
 select * into slot from public.lesson_slot where id=new.slot_id for update;
 if not found or not slot.active or slot.starts_at<=now() then raise exception 'This lesson is no longer available.'; end if;
 if not exists(select 1 from public.club c where c.id=slot.club_id and c.active) then raise exception 'Club is inactive.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=new.player_person_id and cm.active) then raise exception 'Player needs active club membership.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=slot.professional_person_id and cm.active and cm.role in ('Golf Professional','Assistant Professional')) then raise exception 'Professional is no longer active at this club.'; end if;
 new.starts_at=slot.starts_at;new.ends_at=slot.ends_at;return new;
end $$;

create function public.lesson_sync(cid uuid,pid uuid,first_date date,last_date date,actor uuid,protect_bookings boolean default false) returns void language plpgsql set search_path=public as $$
declare desired timestamptz[]; t timestamptz;
begin
 -- Same lock used across clubs so one coach cannot be published twice at the same time.
 perform pg_advisory_xact_lock(hashtext('lesson-diary:'||pid::text));
 if last_date-first_date>62 or last_date<first_date then raise exception 'Choose an availability window of up to nine weeks.'; end if;
 if not exists(select 1 from club_membership cm join person p on p.id=cm.person_id and p.active join club c on c.id=cm.club_id and c.active where cm.club_id=cid and cm.person_id=pid and cm.active and cm.role in ('Golf Professional','Assistant Professional')) then return; end if;
 select coalesce(array_agg(distinct moment order by moment),array[]::timestamptz[]) into desired from (
   select (d::date+make_interval(mins=>minute)) at time zone 'Europe/Dublin' as moment, d::date+make_interval(mins=>minute) as local_start
   from generate_series(first_date::timestamp,last_date::timestamp,interval '1 day') d
   left join lesson_default_week def on def.club_id=cid and def.professional_person_id=pid
   left join lesson_week_override ov on ov.club_id=cid and ov.professional_person_id=pid and ov.week_start=date_trunc('week',d)::date
   cross join lateral jsonb_array_elements(coalesce(ov.ranges,def.ranges,'[]')) r
   cross join lateral generate_series((split_part(r->>'start',':',1)::int*60+split_part(r->>'start',':',2)::int),
     (split_part(r->>'end',':',1)::int*60+split_part(r->>'end',':',2)::int)-30,30) minute
   where (r->>'day')::int=extract(isodow from d)::int-1
 ) times where moment>now()
   and moment at time zone 'Europe/Dublin'=local_start
   and (moment+interval '30 minutes') at time zone 'Europe/Dublin'=local_start+interval '30 minutes';
 -- Lock slots in the same order as booking/cancellation. A concurrent booking cannot disappear.
 perform id from lesson_slot where club_id=cid and professional_person_id=pid and diary_managed and active
   and (starts_at at time zone 'Europe/Dublin')::date between first_date and last_date order by starts_at for update;
 if protect_bookings and exists(select 1 from lesson_slot s join lesson_booking b on b.slot_id=s.id and b.status='Booked'
   where s.club_id=cid and s.professional_person_id=pid and s.diary_managed and s.active and s.starts_at>now()
   and (s.starts_at at time zone 'Europe/Dublin')::date between first_date and last_date and not(s.starts_at=any(desired)))
 then raise exception 'These hours remove a booked lesson. Keep that time available or cancel the booking first.'; end if;
 update lesson_slot s set active=false where s.club_id=cid and s.professional_person_id=pid and s.diary_managed and s.active and s.starts_at>now()
   and (s.starts_at at time zone 'Europe/Dublin')::date between first_date and last_date and not(s.starts_at=any(desired))
   and not exists(select 1 from lesson_booking b where b.slot_id=s.id and b.status='Booked');
 foreach t in array desired loop
   if protect_bookings and exists(select 1 from lesson_slot s where s.professional_person_id=pid and s.active
     and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(t,t+interval '30 minutes','[)') and s.club_id<>cid)
   then raise exception 'These hours overlap this professional’s lessons at another club.'; end if;
   if not exists(select 1 from lesson_slot s where s.professional_person_id=pid and s.active and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(t,t+interval '30 minutes','[)')) then
     insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by,diary_managed)
       values(cid,pid,'Golf lesson',t,t+interval '30 minutes',actor,true);
   end if;
 end loop;
end $$;
alter table public.lesson_default_week enable row level security;
alter table public.lesson_week_override enable row level security;
alter table public.lesson_reminder enable row level security;
revoke all on public.lesson_default_week,public.lesson_week_override,public.lesson_reminder from public,anon,authenticated;
revoke all on function public.lesson_sync(uuid,uuid,date,date,uuid,boolean) from public,anon,authenticated;
commit;
