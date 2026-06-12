-- Test fixtures for the manager lineup workflow.
-- Creates A League Week 1 fixtures for the 2026/27 season.
-- Stackstown A has no match in this week. Fixtures are scheduled only; league tables update when generated games are completed.

insert into public.season (name, starts_on, ends_on, active)
values ('2026/27', '2026-09-01', '2027-03-31', true)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    active = excluded.active;

with season as (
  select id
  from public.season
  where name = '2026/27'
),
league as (
  select id
  from public.league
  where name = 'A League'
),
source_teams as (
  select *
  from (
    values
      ('Castle Golf Club', 'Castle A'),
      ('Grange Golf Club', 'Grange A'),
      ('Newlands Golf Club', 'Newlands A'),
      ('Elm Park Golf Club', 'Elm Park A'),
      ('Woodbrook Golf Club', 'Woodbrook A'),
      ('Dun Laoghaire Golf Club', 'Dun Laoghaire A'),
      ('Milltown Golf Club', 'Milltown A'),
      ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam A'),
      ('Stackstown Golf Club', 'Stackstown A')
  ) as team_source(club_name, team_name)
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, league.id, season.id, source_teams.team_name, true
from source_teams
join public.club c on c.name = source_teams.club_name
cross join league
cross join season
on conflict (league_id, season_id, name) do update
set club_id = excluded.club_id,
    active = excluded.active;

-- Carry the 2025/26 A-team player lists forward for this temporary test fixture.
with old_season as (
  select id
  from public.season
  where name = '2025/26'
),
new_season as (
  select id
  from public.season
  where name = '2026/27'
),
league as (
  select id
  from public.league
  where name = 'A League'
),
team_pairs as (
  select old_team.id as old_team_id, new_team.id as new_team_id
  from public.team old_team
  join old_season os on os.id = old_team.season_id
  join league l on l.id = old_team.league_id
  join public.team new_team
    on new_team.name = old_team.name
   and new_team.league_id = l.id
  join new_season ns on ns.id = new_team.season_id
  where old_team.name in (
    'Castle A',
    'Grange A',
    'Newlands A',
    'Elm Park A',
    'Woodbrook A',
    'Dun Laoghaire A',
    'Milltown A',
    'Fitzwilliam A',
    'Stackstown A'
  )
)
insert into public.team_membership (team_id, person_id, role, active)
select distinct team_pairs.new_team_id, tm.person_id, tm.role, true
from team_pairs
join public.team_membership tm on tm.team_id = team_pairs.old_team_id
where tm.role = 'Player'
  and tm.active = true
on conflict (team_id, person_id, role) do update
set active = excluded.active;

with garry as (
  select id
  from public.person
  where lower(email) = 'garlyons@gmail.com'
  limit 1
),
season as (
  select id
  from public.season
  where name = '2026/27'
  limit 1
),
league as (
  select id
  from public.league
  where name = 'A League'
  limit 1
),
manager_teams as (
  select t.id as team_id, garry.id as person_id
  from public.team t
  cross join garry
  join season s on s.id = t.season_id
  join league l on l.id = t.league_id
  where t.name in ('Castle A', 'Grange A', 'Milltown A')
)
insert into public.team_membership (team_id, person_id, role, active)
select team_id, person_id, 'Manager'::public.membership_role, true
from manager_teams
on conflict (team_id, person_id, role) do update
set active = true;

-- Remove the old 2025/26 scheduled test fixture if it exists.
with old_fixture as (
  select f.id
  from public.fixture f
  join public.season s on s.id = f.season_id
  join public.league l on l.id = f.league_id
  join public.team ht on ht.id = f.home_team_id
  join public.team at on at.id = f.away_team_id
  where s.name = '2025/26'
    and l.name = 'A League'
    and ht.name = 'Castle A'
    and at.name = 'Grange A'
    and f.status = 'Scheduled'
)
delete from public.fixture
where id in (select id from old_fixture);

with season as (
  select id
  from public.season
  where name = '2026/27'
  limit 1
),
league as (
  select id
  from public.league
  where name = 'A League'
  limit 1
),
fixture_source as (
  select *
  from (
    values
      ('Castle A', 'Grange A'),
      ('Newlands A', 'Elm Park A'),
      ('Woodbrook A', 'Dun Laoghaire A'),
      ('Milltown A', 'Fitzwilliam A')
  ) as fixture_source(home_team_name, away_team_name)
),
teams as (
  select
    fixture_source.home_team_name,
    fixture_source.away_team_name,
    home_team.id as home_team_id,
    away_team.id as away_team_id
  from fixture_source
  join public.team home_team
    on home_team.name = fixture_source.home_team_name
  join public.team away_team
    on away_team.name = fixture_source.away_team_name
   and away_team.season_id = home_team.season_id
   and away_team.league_id = home_team.league_id
  join season s on s.id = home_team.season_id
  join league l on l.id = home_team.league_id
)
insert into public.fixture (season_id, league_id, fixture_date, home_team_id, away_team_id, status)
select
  season.id,
  league.id,
  '2026-09-03 19:30:00+00'::timestamptz,
  teams.home_team_id,
  teams.away_team_id,
  'Scheduled'::public.fixture_status
from season
cross join league
join teams on true
where not exists (
  select 1
  from public.fixture f
  where f.season_id = season.id
    and f.league_id = league.id
    and f.fixture_date = '2026-09-03 19:30:00+00'::timestamptz
    and f.home_team_id = teams.home_team_id
    and f.away_team_id = teams.away_team_id
);

insert into public.fixture_week (season_id, league_id, week_number, week_label, starts_on)
select s.id, l.id, 1, 'Week 1', '2026-09-03'::date
from public.season s
cross join public.league l
where s.name = '2026/27'
  and l.name = 'A League'
on conflict (season_id, league_id, week_number) do update
set week_label = excluded.week_label,
    starts_on = excluded.starts_on;
