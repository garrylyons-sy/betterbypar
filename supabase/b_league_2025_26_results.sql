-- Generated from B League 25-26.xlsx.
-- Completed scored fixtures only. Blank postponed/byed rows are intentionally excluded.

insert into public.season (name, starts_on, ends_on, active)
values ('2025/26', '2025-09-01', '2026-03-31', false)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into public.league (name, playing_day)
values ('B League', 'Thursday')
on conflict (name) do update set playing_day = excluded.playing_day;

with requested_teams (team_name, club_name) as (
  values
    ('Castle B', 'Castle Golf Club'),
    ('Grange B', 'Grange Golf Club'),
    ('Milltown B', 'Milltown Golf Club'),
    ('Elm Park B', 'Elm Park Golf Club'),
    ('Stackstown B', 'Stackstown Golf Club'),
    ('Newlands B', 'Newlands Golf Club'),
    ('Fitzwilliam B', 'Fitzwilliam Lawn Tennis Club')
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, l.id, s.id, rt.team_name, true
from requested_teams rt
join public.club c on c.name = rt.club_name
join public.league l on l.name = 'B League'
join public.season s on s.name = '2025/26'
on conflict (league_id, season_id, name) do update
set club_id = excluded.club_id,
    active = excluded.active;

create temporary table source_fixtures (
  round_number integer not null,
  fixture_date date not null,
  home_team_name text not null,
  home_points integer not null,
  away_team_name text not null,
  away_points integer not null
) on commit drop;

insert into source_fixtures (round_number, fixture_date, home_team_name, home_points, away_team_name, away_points)
values
    (1, '2025-10-02', 'Fitzwilliam B', 5, 'Castle B', 2),
    (1, '2025-10-02', 'Newlands B', 4, 'Elm Park B', 3),
    (1, '2025-10-02', 'Stackstown B', 6, 'Grange B', 1),
    (2, '2025-10-09', 'Grange B', 5, 'Milltown B', 2),
    (2, '2025-10-09', 'Castle B', 3, 'Stackstown B', 4),
    (2, '2025-10-09', 'Fitzwilliam B', 4, 'Newlands B', 3),
    (3, '2025-10-16', 'Milltown B', 2, 'Elm Park B', 5),
    (3, '2025-10-16', 'Newlands B', 6, 'Stackstown B', 1),
    (4, '2025-10-23', 'Castle B', 7, 'Milltown B', 0),
    (4, '2025-10-23', 'Fitzwilliam B', 2, 'Elm Park B', 5),
    (4, '2025-10-23', 'Grange B', 3, 'Newlands B', 4),
    (5, '2025-11-06', 'Milltown B', 2, 'Newlands B', 5),
    (5, '2025-11-06', 'Elm Park B', 4, 'Grange B', 3),
    (6, '2025-11-13', 'Fitzwilliam B', 2, 'Grange B', 5),
    (6, '2025-11-13', 'Elm Park B', 3, 'Castle B', 4),
    (6, '2025-11-20', 'Stackstown B', 6, 'Fitzwilliam B', 1),
    (6, '2025-11-20', 'Castle B', 1, 'Grange B', 6),
    (7, '2025-11-27', 'Milltown B', 4, 'Fitzwilliam B', 3),
    (7, '2025-11-27', 'Newlands B', 4, 'Castle B', 3),
    (7, '2025-11-27', 'Stackstown B', 5, 'Elm Park B', 2),
    (8, '2025-12-04', 'Elm Park B', 3, 'Newlands B', 4),
    (8, '2025-12-04', 'Grange B', 2, 'Stackstown B', 5),
    (9, '2025-12-11', 'Elm Park B', 5, 'Milltown B', 2),
    (9, '2025-12-11', 'Grange B', 4, 'Castle B', 3),
    (9, '2025-12-11', 'Stackstown B', 3, 'Newlands B', 4),
    (10, '2026-01-08', 'Milltown B', 5, 'Grange B', 2),
    (10, '2026-01-08', 'Stackstown B', 4, 'Castle B', 3),
    (10, '2026-01-08', 'Newlands B', 6, 'Fitzwilliam B', 1),
    (11, '2026-01-15', 'Fitzwilliam B', 3, 'Milltown B', 4),
    (11, '2026-01-15', 'Castle B', 3, 'Newlands B', 4),
    (11, '2026-01-15', 'Elm Park B', 3, 'Stackstown B', 4),
    (11, '2026-01-15', 'Milltown B', 4, 'Stackstown B', 3),
    (11, '2026-01-22', 'Castle B', 7, 'Fitzwilliam B', 0),
    (12, '2026-01-29', 'Milltown B', 0, 'Castle B', 7),
    (12, '2026-01-29', 'Elm Park B', 7, 'Fitzwilliam B', 0),
    (12, '2026-01-29', 'Newlands B', 3, 'Grange B', 4),
    (13, '2026-02-05', 'Newlands B', 5, 'Milltown B', 2),
    (13, '2026-02-05', 'Fitzwilliam B', 2, 'Stackstown B', 5),
    (13, '2026-02-05', 'Grange B', 0, 'Elm Park B', 7),
    (14, '2026-02-19', 'Stackstown B', 7, 'Milltown B', 0),
    (14, '2026-02-19', 'Grange B', 3, 'Fitzwilliam B', 4),
    (14, '2026-02-19', 'Castle B', 2, 'Elm Park B', 5);

with resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'B League'
  join public.team ht on ht.name = sf.home_team_name and ht.season_id = s.id and ht.league_id = l.id
  join public.team at on at.name = sf.away_team_name and at.season_id = s.id and at.league_id = l.id
)
insert into public.fixture (season_id, league_id, fixture_date, home_team_id, away_team_id, status)
select season_id, league_id, fixture_date::timestamptz, home_team_id, away_team_id, 'Completed'::fixture_status
from resolved r
where not exists (
  select 1
  from public.fixture f
  where f.season_id = r.season_id
    and f.league_id = r.league_id
    and f.fixture_date = r.fixture_date::timestamptz
    and f.home_team_id = r.home_team_id
    and f.away_team_id = r.away_team_id
);

with resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'B League'
  join public.team ht on ht.name = sf.home_team_name and ht.season_id = s.id and ht.league_id = l.id
  join public.team at on at.name = sf.away_team_name and at.season_id = s.id and at.league_id = l.id
)
update public.fixture f
set status = 'Completed'::fixture_status
from resolved r
where f.season_id = r.season_id
  and f.league_id = r.league_id
  and f.fixture_date = r.fixture_date::timestamptz
  and f.home_team_id = r.home_team_id
  and f.away_team_id = r.away_team_id;

with resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'B League'
  join public.team ht on ht.name = sf.home_team_name and ht.season_id = s.id and ht.league_id = l.id
  join public.team at on at.name = sf.away_team_name and at.season_id = s.id and at.league_id = l.id
)
insert into public.match (fixture_id, home_team_score, away_team_score, entered_at)
select f.id, r.home_points, r.away_points, now()
from resolved r
join public.fixture f on f.season_id = r.season_id
  and f.league_id = r.league_id
  and f.fixture_date = r.fixture_date::timestamptz
  and f.home_team_id = r.home_team_id
  and f.away_team_id = r.away_team_id
on conflict (fixture_id) do update
set home_team_score = excluded.home_team_score,
    away_team_score = excluded.away_team_score,
    entered_at = excluded.entered_at;

with week_source as (
  select
    s.id as season_id,
    l.id as league_id,
    sf.round_number,
    min(sf.fixture_date) as starts_on
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'B League'
  group by s.id, l.id, sf.round_number
)
insert into public.fixture_week (season_id, league_id, week_number, week_label, starts_on)
select season_id, league_id, round_number, 'Week ' || round_number, starts_on
from week_source
on conflict (season_id, league_id, week_number) do update
set week_label = excluded.week_label,
    starts_on = excluded.starts_on;

with resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'B League'
  join public.team ht on ht.name = sf.home_team_name and ht.season_id = s.id and ht.league_id = l.id
  join public.team at on at.name = sf.away_team_name and at.season_id = s.id and at.league_id = l.id
)
insert into public.fixture_week_match (week_id, match_id)
select fw.id, m.id
from resolved r
join public.fixture f on f.season_id = r.season_id
  and f.league_id = r.league_id
  and f.fixture_date = r.fixture_date::timestamptz
  and f.home_team_id = r.home_team_id
  and f.away_team_id = r.away_team_id
join public.match m on m.fixture_id = f.id
join public.fixture_week fw on fw.season_id = r.season_id
  and fw.league_id = r.league_id
  and fw.week_number = r.round_number
on conflict (match_id) do update
set week_id = excluded.week_id;
