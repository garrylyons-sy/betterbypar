-- Give Garry a Manager context for every active 2026/27 team.
-- Roles are season-independent in person_team_role, but this uses the
-- current 2026/27 team list as the source of clubs/leagues/team names.

with garry as (
  select id
  from public.person
  where lower(email) = lower('garlyons@gmail.com')
),
target_teams as (
  select distinct
    t.id as team_id,
    t.club_id,
    t.league_id,
    t.name as team_name
  from public.team t
  join public.season s on s.id = t.season_id
  where s.name = '2026/27'
    and t.active = true
),
club_memberships as (
  insert into public.club_membership (club_id, person_id, role, active)
  select distinct tt.club_id, g.id, 'Club Member', true
  from target_teams tt
  cross join garry g
  on conflict (club_id, person_id, role) do update
  set active = true
  returning id, club_id, person_id
),
team_roles as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select cm.id, cm.person_id, cm.club_id, tt.league_id, tt.team_name, 'Manager'::public.membership_role, true
  from target_teams tt
  join club_memberships cm on cm.club_id = tt.club_id
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set active = true
  returning person_id, club_id, league_id, team_name, role
)
insert into public.team_membership (team_id, person_id, role, active)
select tt.team_id, tr.person_id, tr.role, true
from target_teams tt
join team_roles tr
  on tr.club_id = tt.club_id
 and tr.league_id = tt.league_id
 and tr.team_name = tt.team_name
on conflict (team_id, person_id, role) do update
set active = true;
