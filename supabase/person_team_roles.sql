create table if not exists public.person_team_role (
  id uuid primary key default gen_random_uuid(),
  club_membership_id uuid references public.club_membership(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  team_name text not null,
  role membership_role not null,
  joined_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (person_id, club_id, league_id, team_name, role)
);

comment on table public.person_team_role is 'Season-independent team role assignments attached to a club membership. A person belongs to a club first, then has one or more player, manager or assistant manager roles in that club''s teams.';

insert into public.club_membership (club_id, person_id, role, joined_date, active)
select
  t.club_id,
  tm.person_id,
  'Club Member',
  min(tm.joined_date),
  bool_or(tm.active)
from public.team_membership tm
join public.team t on t.id = tm.team_id
group by t.club_id, tm.person_id
on conflict (club_id, person_id, role) do update
set joined_date = least(public.club_membership.joined_date, excluded.joined_date),
    active = public.club_membership.active or excluded.active;

insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, joined_date, active)
select
  cm.id,
  tm.person_id,
  t.club_id,
  t.league_id,
  t.name as team_name,
  tm.role,
  min(tm.joined_date) as joined_date,
  bool_or(tm.active) as active
from public.team_membership tm
join public.team t on t.id = tm.team_id
join public.club_membership cm on cm.club_id = t.club_id and cm.person_id = tm.person_id and cm.role = 'Club Member'
group by cm.id, tm.person_id, t.club_id, t.league_id, t.name, tm.role
on conflict (person_id, club_id, league_id, team_name, role) do update
set joined_date = least(public.person_team_role.joined_date, excluded.joined_date),
    active = excluded.active;

update public.person_team_role ptr
set club_membership_id = cm.id
from public.club_membership cm
where cm.club_id = ptr.club_id
  and cm.person_id = ptr.person_id
  and cm.role = 'Club Member'
  and ptr.club_membership_id is null;

alter table public.person_team_role
alter column club_membership_id set not null;

create unique index if not exists person_team_role_club_membership_team_role_key
on public.person_team_role (club_membership_id, league_id, team_name, role);

alter table public.person_team_role enable row level security;

drop policy if exists "members can read person team roles" on public.person_team_role;
create policy "members can read person team roles" on public.person_team_role for select to authenticated using (active = true);

drop policy if exists "operators can read all person team roles" on public.person_team_role;
create policy "operators can read all person team roles" on public.person_team_role for select to authenticated using (public.is_app_operator());

create or replace function public.is_manager_for_team(team_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team target_team
    join public.person_team_role ptr
      on ptr.league_id = target_team.league_id
     and ptr.team_name = target_team.name
    join public.club_membership cm
      on cm.id = ptr.club_membership_id
     and cm.club_id = target_team.club_id
     and cm.active = true
    where target_team.id = team_uuid
      and cm.person_id = public.current_person_id()
      and ptr.role in ('Manager', 'Assistant Manager')
      and ptr.active = true
  ) or exists (
    select 1
    from public.team_membership tm
    where tm.team_id = team_uuid
      and tm.person_id = public.current_person_id()
      and tm.role in ('Manager', 'Assistant Manager')
      and tm.active = true
  )
$$;

drop view if exists public.user_team_context_view;
drop view if exists public.membership_management_view;

create view public.user_team_context_view
with (security_invoker = true) as
select
  ua.id as auth_user_id,
  p.id as person_id,
  p.first_name,
  p.last_name,
  ua.username,
  ptr.id as membership_id,
  ptr.role,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  c.logo_path,
  c.primary_color,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name,
  c.accent_color
from public.user_account ua
join public.person p on p.id = ua.person_id
join public.club_membership cm on cm.person_id = p.id and cm.active = true
join public.person_team_role ptr on ptr.club_membership_id = cm.id and ptr.active = true
join public.team t
  on t.club_id = cm.club_id
 and t.league_id = ptr.league_id
 and t.name = ptr.team_name
 and t.active = true
join public.club c on c.id = cm.club_id and c.active = true
join public.league l on l.id = t.league_id
join public.season s on s.id = t.season_id
where ua.active = true;

create view public.membership_management_view as
select
  p.id as person_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.active as person_active,
  ptr.id as membership_id,
  ptr.role,
  ptr.joined_date,
  ptr.active as membership_active,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name
from public.person p
left join public.club_membership cm on cm.person_id = p.id
left join public.person_team_role ptr on ptr.club_membership_id = cm.id
left join public.team t
  on t.club_id = cm.club_id
 and t.league_id = ptr.league_id
 and t.name = ptr.team_name
left join public.club c on c.id = cm.club_id
left join public.league l on l.id = t.league_id
left join public.season s on s.id = t.season_id;

comment on view public.membership_management_view is 'Backend management view for people and their club-parented Player, Manager and Assistant Manager team roles, projected onto available season teams.';
