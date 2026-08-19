-- Test coverage accounts and placeholder rosters for all 2026/27 teams.
-- These rows are deliberately @notrealmail.com so they can be used by
-- /home.html test impersonation without creating real user access.

with source_teams as (
  select
    t.id as team_id,
    t.name as team_name,
    c.id as club_id,
    c.name as club_name,
    l.id as league_id,
    l.name as league_name
  from public.team t
  join public.season s on s.id = t.season_id
  join public.club c on c.id = t.club_id
  join public.league l on l.id = t.league_id
  where s.name = '2026/27'
    and t.active = true
),
manager_source as (
  select
    lower(regexp_replace(team_name, '[^a-zA-Z0-9]+', '.', 'g')) || '.manager@notrealmail.com' as email,
    lower(regexp_replace(team_name, '[^a-zA-Z0-9]+', '_', 'g')) || '_manager' as username,
    team_name as first_name,
    'Manager' as last_name,
    club_id,
    league_id,
    team_name
  from source_teams
),
manager_people as (
  insert into public.person (first_name, last_name, email, active)
  select first_name, last_name, email, true
  from manager_source
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id, email
),
manager_accounts as (
  insert into public.user_account (person_id, username, active)
  select mp.id, ms.username, true
  from manager_source ms
  join manager_people mp on mp.email = ms.email
  on conflict (username) do update
  set person_id = excluded.person_id,
      active = true
  returning id, person_id
),
manager_club_memberships as (
  insert into public.club_membership (club_id, person_id, role, active)
  select ms.club_id, mp.id, 'Club Member', true
  from manager_source ms
  join manager_people mp on mp.email = ms.email
  on conflict (club_id, person_id, role) do update
  set active = true
  returning id, club_id, person_id
),
manager_role_grants as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select mcm.id, mcm.person_id, mcm.club_id, ms.league_id, ms.team_name, 'Manager'::public.membership_role, true
  from manager_source ms
  join manager_people mp on mp.email = ms.email
  join manager_club_memberships mcm on mcm.person_id = mp.id and mcm.club_id = ms.club_id
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set active = true
  returning person_id, club_id, league_id, team_name, role
),
manager_season_memberships as (
  insert into public.team_membership (team_id, person_id, role, active)
  select st.team_id, mrg.person_id, mrg.role, true
  from manager_role_grants mrg
  join source_teams st
    on st.club_id = mrg.club_id
   and st.league_id = mrg.league_id
   and st.team_name = mrg.team_name
  on conflict (team_id, person_id, role) do update
  set active = true
  returning person_id
),
team_player_counts as (
  select
    st.*,
    count(distinct p.id) filter (where p.email not like '%lineup.player.%@notrealmail.com') as real_or_existing_players
  from source_teams st
  left join public.person_team_role ptr
    on ptr.club_id = st.club_id
   and ptr.league_id = st.league_id
   and ptr.team_name = st.team_name
   and ptr.role = 'Player'
   and ptr.active = true
  left join public.person p on p.id = ptr.person_id and p.active = true
  group by st.team_id, st.team_name, st.club_id, st.club_name, st.league_id, st.league_name
),
placeholder_source as (
  select
    tpc.team_id,
    tpc.team_name,
    tpc.club_id,
    tpc.league_id,
    n.player_number,
    lower(regexp_replace(tpc.team_name, '[^a-zA-Z0-9]+', '.', 'g')) || '.lineup.player.' || n.player_number::text || '@notrealmail.com' as email,
    tpc.team_name || ' Player ' || n.player_number::text as first_name,
    'Test' as last_name
  from team_player_counts tpc
  cross join generate_series(1, 7) as n(player_number)
  where tpc.real_or_existing_players < 7
),
placeholder_people as (
  insert into public.person (first_name, last_name, email, active)
  select first_name, last_name, email, true
  from placeholder_source
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id, email
),
placeholder_club_memberships as (
  insert into public.club_membership (club_id, person_id, role, active)
  select ps.club_id, pp.id, 'Club Member', true
  from placeholder_source ps
  join placeholder_people pp on pp.email = ps.email
  on conflict (club_id, person_id, role) do update
  set active = true
  returning id, club_id, person_id
),
placeholder_role_grants as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select pcm.id, pcm.person_id, pcm.club_id, ps.league_id, ps.team_name, 'Player'::public.membership_role, true
  from placeholder_source ps
  join placeholder_people pp on pp.email = ps.email
  join placeholder_club_memberships pcm on pcm.person_id = pp.id and pcm.club_id = ps.club_id
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set active = true
  returning person_id, club_id, league_id, team_name, role
)
insert into public.team_membership (team_id, person_id, role, active)
select st.team_id, prg.person_id, prg.role, true
from placeholder_role_grants prg
join source_teams st
  on st.club_id = prg.club_id
 and st.league_id = prg.league_id
 and st.team_name = prg.team_name
on conflict (team_id, person_id, role) do update
set active = true;
