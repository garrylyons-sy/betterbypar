-- Remove Assistant Manager as an application role.
-- Existing databases may still have the enum value, so block it with checks.

delete from public.person_team_role where role::text = 'Assistant Manager';
delete from public.team_membership where role::text = 'Assistant Manager';
delete from public.invitation_membership where role::text = 'Assistant Manager';
delete from public.invitation where invited_role::text = 'Assistant Manager';
delete from public.appearance where role_type = 'Assistant Manager';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'person_team_role_no_assistant_manager') then
    alter table public.person_team_role
      add constraint person_team_role_no_assistant_manager check (role::text <> 'Assistant Manager');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'team_membership_no_assistant_manager') then
    alter table public.team_membership
      add constraint team_membership_no_assistant_manager check (role::text <> 'Assistant Manager');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invitation_membership_no_assistant_manager') then
    alter table public.invitation_membership
      add constraint invitation_membership_no_assistant_manager check (role::text <> 'Assistant Manager');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invitation_no_assistant_manager') then
    alter table public.invitation
      add constraint invitation_no_assistant_manager check (invited_role::text <> 'Assistant Manager');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appearance_no_assistant_manager') then
    alter table public.appearance
      add constraint appearance_no_assistant_manager check (role_type <> 'Assistant Manager');
  end if;
end $$;
