-- Dedicated fake accounts for the multi-pane lineup test harness.
-- These accounts are for browser simulation only and use @notrealmail.com.

with source_managers (email, username, first_name, last_name, club_name, league_name, team_name) as (
  values
    ('castle.a.manager@notrealmail.com', 'castle_a_manager', 'Castle A', 'Manager', 'Castle Golf Club', 'A League', 'Castle A'),
    ('dun.laoghaire.a.manager@notrealmail.com', 'dun_laoghaire_a_manager', 'Dun Laoghaire A', 'Manager', 'Dun Laoghaire Golf Club', 'A League', 'Dun Laoghaire A'),
    ('milltown.a.manager@notrealmail.com', 'milltown_a_manager', 'Milltown A', 'Manager', 'Milltown Golf Club', 'A League', 'Milltown A')
),
people as (
  insert into public.person (first_name, last_name, email, active)
  select first_name, last_name, email, true
  from source_managers
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id, email
),
accounts as (
  insert into public.user_account (person_id, username, active)
  select p.id, sm.username, true
  from source_managers sm
  join people p on p.email = sm.email
  on conflict (username) do update
  set person_id = excluded.person_id,
      active = true
  returning id, person_id
),
club_memberships as (
  insert into public.club_membership (club_id, person_id, role, active)
  select c.id, p.id, 'Club Member', true
  from source_managers sm
  join people p on p.email = sm.email
  join public.club c on c.name = sm.club_name
  on conflict (club_id, person_id, role) do update
  set active = true
  returning id, club_id, person_id
),
role_grants as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select cm.id, cm.person_id, cm.club_id, l.id, sm.team_name, 'Manager'::public.membership_role, true
  from source_managers sm
  join people p on p.email = sm.email
  join public.league l on l.name = sm.league_name
  join public.club c on c.name = sm.club_name
  join club_memberships cm on cm.person_id = p.id and cm.club_id = c.id
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set active = true
  returning person_id, club_id, league_id, team_name, role
)
insert into public.team_membership (team_id, person_id, role, active)
select t.id, rg.person_id, rg.role, true
from role_grants rg
join public.season s on s.name = '2026/27'
join public.team t
  on t.season_id = s.id
 and t.club_id = rg.club_id
 and t.league_id = rg.league_id
 and t.name = rg.team_name
on conflict (team_id, person_id, role) do update
set active = true;
