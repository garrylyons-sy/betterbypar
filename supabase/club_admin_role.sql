alter table public.club_membership
add column if not exists is_club_admin boolean not null default false;

comment on column public.club_membership.is_club_admin is 'Whether this person can administer this club''s members, invites, competitions and table bookings.';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.invitation_club_membership'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.invitation_club_membership drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.invitation_club_membership
add constraint invitation_club_membership_role_check
check (role in ('Club Member', 'Club Admin'));

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.appearance'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role_type%'
  loop
    execute format('alter table public.appearance drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.appearance
add constraint appearance_role_type_check
check (role_type in ('Player', 'Manager', 'Club Member', 'Club Admin'));

insert into public.appearance (role_type, panel_config, menu_config)
values (
  'Club Admin',
  '["clubAccess","clubCompetitionAdmin","openCompetitions","myCompetitionMatches","memberActions","interclubLeagues","messages"]'::jsonb,
  '["Home","Bookings","Competitions","Messages","Interclub Leagues"]'::jsonb
)
on conflict (role_type) do update
set panel_config = excluded.panel_config,
    menu_config = excluded.menu_config,
    active = true,
    updated_at = now();

update public.appearance
set panel_config = '["clubAccess","openCompetitions","myCompetitionMatches","memberActions","messages"]'::jsonb,
    menu_config = '["Home","Bookings","Competitions","Messages"]'::jsonb,
    active = true,
    updated_at = now()
where role_type = 'Club Member';

insert into public.club_membership (club_id, person_id, role, active, is_club_admin)
select c.id, p.id, 'Club Member', true, true
from public.club c
join public.person p on lower(p.email) = 'garlyons@gmail.com'
where c.name = 'Castle Golf Club'
on conflict (club_id, person_id, role) do update
set active = true,
    is_club_admin = true;

insert into public.club_admin (club_id, person_id, active)
select c.id, p.id, true
from public.club c
join public.person p on lower(p.email) = 'garlyons@gmail.com'
where c.name = 'Castle Golf Club'
on conflict (club_id, person_id) do update
set active = true;
