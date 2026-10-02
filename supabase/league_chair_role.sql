do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.club_membership'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.club_membership drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.club_membership
add constraint club_membership_role_check
check (role in ('Club Member', 'Club Admin', 'League Chair'));

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
check (role in ('Club Member', 'Club Admin', 'League Chair'));

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
check (role_type in ('Player', 'Manager', 'Club Member', 'Club Admin', 'League Chair'));

insert into public.appearance (role_type, panel_config, menu_config, active)
values (
  'League Chair',
  '["interclubLeagues"]'::jsonb,
  '["Home","Contacts","Interclub Leagues"]'::jsonb,
  true
)
on conflict (role_type) do update
set panel_config = excluded.panel_config,
    menu_config = excluded.menu_config,
    active = true,
    updated_at = now();
