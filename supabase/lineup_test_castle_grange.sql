with garry as (
  select id
  from public.person
  where lower(email) = 'garlyons@gmail.com'
  limit 1
),
season as (
  select id
  from public.season
  where name = '2025/26'
  limit 1
),
league as (
  select id
  from public.league
  where name = 'A League'
  limit 1
),
teams as (
  select
    castle.id as castle_team_id,
    grange.id as grange_team_id
  from public.team castle
  join public.team grange
    on grange.name = 'Grange A'
   and grange.season_id = castle.season_id
   and grange.league_id = castle.league_id
  join season s on s.id = castle.season_id
  join league l on l.id = castle.league_id
  where castle.name = 'Castle A'
  limit 1
),
manager_roles as (
  select castle_team_id as team_id, id as person_id
  from teams
  cross join garry
  union all
  select grange_team_id as team_id, id as person_id
  from teams
  cross join garry
)
insert into public.team_membership (team_id, person_id, role, active)
select team_id, person_id, 'Manager'::public.membership_role, true
from manager_roles
on conflict (team_id, person_id, role) do update
set active = true;

with season as (
  select id
  from public.season
  where name = '2025/26'
  limit 1
),
league as (
  select id
  from public.league
  where name = 'A League'
  limit 1
),
teams as (
  select
    castle.id as castle_team_id,
    grange.id as grange_team_id
  from public.team castle
  join public.team grange
    on grange.name = 'Grange A'
   and grange.season_id = castle.season_id
   and grange.league_id = castle.league_id
  join season s on s.id = castle.season_id
  join league l on l.id = castle.league_id
  where castle.name = 'Castle A'
  limit 1
)
insert into public.fixture (season_id, league_id, fixture_date, home_team_id, away_team_id, status)
select
  season.id,
  league.id,
  '2026-03-26 19:30:00+00'::timestamptz,
  teams.castle_team_id,
  teams.grange_team_id,
  'Scheduled'::public.fixture_status
from season
cross join league
cross join teams
where not exists (
  select 1
  from public.fixture f
  where f.season_id = season.id
    and f.league_id = league.id
    and f.home_team_id = teams.castle_team_id
    and f.away_team_id = teams.grange_team_id
    and f.status = 'Scheduled'
);
