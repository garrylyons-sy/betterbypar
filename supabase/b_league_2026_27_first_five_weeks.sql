-- Populate the 2026/27 B League opening five weeks.
-- B League has seven teams, so each week has three matches and one bye.
-- Dates are Thursdays starting 18 June 2026, matching the A League opening block.

insert into public.season (name, starts_on, ends_on, active)
values ('2026/27', '2026-06-18', '2027-03-31', true)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    active = excluded.active;

insert into public.league (name, playing_day)
values ('B League', 'Thursday')
on conflict (name) do update
set playing_day = excluded.playing_day;

with season as (
  select id from public.season where name = '2026/27'
),
league as (
  select id from public.league where name = 'B League'
),
source_teams as (
  select *
  from (
    values
      ('Castle Golf Club', 'Castle B'),
      ('Grange Golf Club', 'Grange B'),
      ('Milltown Golf Club', 'Milltown B'),
      ('Elm Park Golf Club', 'Elm Park B'),
      ('Stackstown Golf Club', 'Stackstown B'),
      ('Newlands Golf Club', 'Newlands B'),
      ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam B')
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
    active = true;

with old_season as (
  select id from public.season where name = '2025/26'
),
new_season as (
  select id from public.season where name = '2026/27'
),
league as (
  select id from public.league where name = 'B League'
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
)
insert into public.team_membership (team_id, person_id, role, active)
select distinct team_pairs.new_team_id, tm.person_id, tm.role, true
from team_pairs
join public.team_membership tm on tm.team_id = team_pairs.old_team_id
where tm.active = true
on conflict (team_id, person_id, role) do update
set active = true;

with target_fixtures as (
  select f.id
  from public.fixture f
  join public.season s on s.id = f.season_id
  join public.league l on l.id = f.league_id
  where s.name = '2026/27'
    and l.name = 'B League'
)
delete from public.fixture
where id in (select id from target_fixtures);

with target_weeks as (
  select fw.id
  from public.fixture_week fw
  join public.season s on s.id = fw.season_id
  join public.league l on l.id = fw.league_id
  where s.name = '2026/27'
    and l.name = 'B League'
)
delete from public.fixture_week
where id in (select id from target_weeks);

with season as (
  select id from public.season where name = '2026/27'
),
league as (
  select id from public.league where name = 'B League'
),
source_fixtures (week_number, fixture_date, home_team_name, away_team_name) as (
  values
    (1, '2026-06-18'::date, 'Fitzwilliam B', 'Castle B'),
    (1, '2026-06-18'::date, 'Newlands B', 'Elm Park B'),
    (1, '2026-06-18'::date, 'Stackstown B', 'Grange B'),
    (2, '2026-06-25'::date, 'Grange B', 'Milltown B'),
    (2, '2026-06-25'::date, 'Castle B', 'Stackstown B'),
    (2, '2026-06-25'::date, 'Fitzwilliam B', 'Newlands B'),
    (3, '2026-07-02'::date, 'Milltown B', 'Elm Park B'),
    (3, '2026-07-02'::date, 'Newlands B', 'Stackstown B'),
    (3, '2026-07-02'::date, 'Castle B', 'Grange B'),
    (4, '2026-07-09'::date, 'Castle B', 'Milltown B'),
    (4, '2026-07-09'::date, 'Fitzwilliam B', 'Elm Park B'),
    (4, '2026-07-09'::date, 'Grange B', 'Newlands B'),
    (5, '2026-07-16'::date, 'Milltown B', 'Newlands B'),
    (5, '2026-07-16'::date, 'Elm Park B', 'Grange B'),
    (5, '2026-07-16'::date, 'Stackstown B', 'Fitzwilliam B')
),
resolved as (
  select
    season.id as season_id,
    league.id as league_id,
    sf.week_number,
    sf.fixture_date,
    ht.id as home_team_id,
    at.id as away_team_id
  from source_fixtures sf
  cross join season
  cross join league
  join public.team ht on ht.name = sf.home_team_name
    and ht.season_id = season.id
    and ht.league_id = league.id
  join public.team at on at.name = sf.away_team_name
    and at.season_id = season.id
    and at.league_id = league.id
)
insert into public.fixture (season_id, league_id, fixture_date, home_team_id, away_team_id, status)
select
  season_id,
  league_id,
  (fixture_date::text || ' 19:30:00+00')::timestamptz,
  home_team_id,
  away_team_id,
  'Scheduled'::public.fixture_status
from resolved;

with season as (
  select id from public.season where name = '2026/27'
),
league as (
  select id from public.league where name = 'B League'
),
weeks (week_number, starts_on) as (
  values
    (1, '2026-06-18'::date),
    (2, '2026-06-25'::date),
    (3, '2026-07-02'::date),
    (4, '2026-07-09'::date),
    (5, '2026-07-16'::date)
)
insert into public.fixture_week (season_id, league_id, week_number, week_label, starts_on)
select season.id, league.id, weeks.week_number, 'Week ' || weeks.week_number, weeks.starts_on
from season
cross join league
join weeks on true
on conflict (season_id, league_id, week_number) do update
set week_label = excluded.week_label,
    starts_on = excluded.starts_on;
