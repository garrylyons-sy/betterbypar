-- Apply after schema.sql to the NEW Supabase project, using its database owner.
begin;
create extension if not exists btree_gist;
alter table public.club_membership drop constraint if exists club_membership_role_check;
alter table public.club_membership add constraint club_membership_role_check check (role in ('Club Member','Club Admin','League Chair','Golf Professional','Assistant Professional'));
alter table public.invitation_club_membership drop constraint if exists invitation_club_membership_role_check;
alter table public.invitation_club_membership add constraint invitation_club_membership_role_check check (role in ('Club Member','Club Admin','League Chair','Golf Professional','Assistant Professional'));
alter table public.appearance drop constraint if exists appearance_role_type_check;
alter table public.appearance add constraint appearance_role_type_check check (role_type in ('Player','Manager','Club Member','Club Admin','League Chair','Golf Professional','Assistant Professional'));
insert into public.appearance(role_type,panel_config,menu_config)
values ('Golf Professional','["clubAccess"]','["Home","Bookings"]'),('Assistant Professional','["clubAccess"]','["Home","Bookings"]')
on conflict (role_type) do nothing;

create table public.dependants (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.club(id),
 guardian_person_id uuid not null references public.person(id),
 dependant_person_id uuid not null references public.person(id),
 relationship text not null check (relationship in ('Parent','Guardian','Carer')),
 active boolean not null default true,
 created_by uuid not null references public.person(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (guardian_person_id <> dependant_person_id),
 unique (club_id,guardian_person_id,dependant_person_id)
);
create index dependants_guardian_idx on public.dependants(guardian_person_id,club_id) where active;
create index dependants_player_idx on public.dependants(dependant_person_id,club_id) where active;
comment on table public.dependants is 'Explicit club-scoped delegation. A dependant is a person and does not need a login. Does not grant account impersonation or administrative access.';

create table public.lesson_slot (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.club(id),
 professional_person_id uuid not null references public.person(id),
 title text not null check (length(trim(title)) between 1 and 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 active boolean not null default true,
 created_by uuid not null references public.person(id),
 created_at timestamptz not null default now(),
 check (ends_at > starts_at and ends_at <= starts_at + interval '4 hours'),
 exclude using gist (professional_person_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (active)
);
create index lesson_slot_club_idx on public.lesson_slot(club_id,starts_at);
create table public.lesson_booking (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.lesson_slot(id),
 player_person_id uuid not null references public.person(id),
 booked_by uuid not null references public.person(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'Booked' check (status in ('Booked','Cancelled')),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 cancelled_by uuid references public.person(id),
 exclude using gist (player_person_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (status = 'Booked')
);
create unique index lesson_booking_slot_idx on public.lesson_booking(slot_id) where status='Booked';

create function public.golf_validate_booking() returns trigger language plpgsql set search_path=public as $$
declare slot public.lesson_slot;
begin
 if new.status='Cancelled' then return new; end if;
 select * into slot from public.lesson_slot where id=new.slot_id for update;
 if not found or not slot.active or slot.starts_at <= now() then raise exception 'This lesson is no longer available.'; end if;
 if not exists(select 1 from public.club c where c.id=slot.club_id and c.active) then raise exception 'Club is inactive.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=new.player_person_id and cm.active) then raise exception 'Player needs active club membership.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=slot.professional_person_id and cm.active and cm.role in ('Golf Professional','Assistant Professional')) then raise exception 'Professional is no longer active at this club.'; end if;
 new.starts_at=slot.starts_at; new.ends_at=slot.ends_at;
 return new;
end $$;
create trigger golf_booking_valid before insert or update on public.lesson_booking for each row execute function public.golf_validate_booking();

-- Check the final transaction state, allowing an officer to be replaced atomically.
create function public.golf_require_club_officers() returns trigger language plpgsql set search_path=public as $$
declare cid uuid; ids uuid[];
begin
 if tg_table_name='club' then ids=array[new.id];
 elsif tg_table_name='person' then
   select array_agg(club_id) into ids from (select club_id from public.club_admin where person_id=old.id union select club_id from public.club_membership where person_id=old.id) s;
 else
   if tg_op='INSERT' then ids=array[new.club_id];
   elsif tg_op='DELETE' then ids=array[old.club_id];
   else ids=array[old.club_id,new.club_id]; end if;
 end if;
 foreach cid in array coalesce(ids,array[]::uuid[]) loop
   -- Serialize competing changes to appointments at this club.
   perform 1 from public.club where id=cid for update;
   if exists(select 1 from public.club where id=cid and active) then
     if not exists(select 1 from public.club_admin ca join public.person p on p.id=ca.person_id and p.active where ca.club_id=cid and ca.active)
       and not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=cid and cm.active and cm.is_club_admin)
     then raise exception 'Appoint at least one club administrator.'; end if;
     if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=cid and cm.active and cm.role='Golf Professional') then raise exception 'Appoint at least one Golf Professional.'; end if;
   end if;
 end loop;
 return null;
end $$;
create constraint trigger golf_club_officers after insert or update on public.club deferrable initially deferred for each row execute function public.golf_require_club_officers();
create constraint trigger golf_admin_officers after insert or update or delete on public.club_admin deferrable initially deferred for each row execute function public.golf_require_club_officers();
create constraint trigger golf_member_officers after insert or update or delete on public.club_membership deferrable initially deferred for each row execute function public.golf_require_club_officers();
create constraint trigger golf_person_officers after update or delete on public.person deferrable initially deferred for each row execute function public.golf_require_club_officers();

-- App-owned authentication is enforced by server APIs; browser Supabase clients have no access.
alter table public.dependants enable row level security;
alter table public.lesson_slot enable row level security;
alter table public.lesson_booking enable row level security;
revoke all on public.dependants,public.lesson_slot,public.lesson_booking from public,anon,authenticated;
revoke all on function public.golf_validate_booking(),public.golf_require_club_officers() from public,anon,authenticated;
commit;
