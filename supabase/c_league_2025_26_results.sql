-- Generated from C League 25-26.xlsx.
-- Completed scored fixtures only.

insert into public.season (name, starts_on, ends_on, active)
values ('2025/26', '2025-09-01', '2026-03-31', false)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into public.league (name, playing_day)
values ('C League', 'Monday')
on conflict (name) do update set playing_day = excluded.playing_day;

with requested_teams (team_name, club_name) as (
  values
    ('Castle C', 'Castle Golf Club'),
    ('Grange C', 'Grange Golf Club'),
    ('Elm Park C', 'Elm Park Golf Club'),
    ('Stackstown C', 'Stackstown Golf Club'),
    ('Newlands C', 'Newlands Golf Club')
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, l.id, s.id, rt.team_name, true
from requested_teams rt
join public.club c on c.name = rt.club_name
join public.league l on l.name = 'C League'
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
    (1, '2025-10-06', 'Newlands C', 3, 'Stackstown C', 4),
    (1, '2025-10-06', 'Elm Park C', 4, 'Grange C', 3),
    (2, '2025-10-13', 'Grange C', 4, 'Newlands C', 3),
    (2, '2025-10-13', 'Castle C', 2, 'Elm Park C', 5),
    (3, '2025-10-20', 'Grange C', 4, 'Castle C', 3),
    (3, '2025-10-20', 'Stackstown C', 4, 'Elm Park C', 3),
    (4, '2025-11-03', 'Newlands C', 5, 'Castle C', 2),
    (4, '2025-11-03', 'Stackstown C', 3, 'Grange C', 4),
    (5, '2025-11-10', 'Elm Park C', 3, 'Newlands C', 4),
    (5, '2025-11-10', 'Castle C', 3, 'Stackstown C', 4),
    (6, '2025-11-24', 'Stackstown C', 3, 'Newlands C', 4),
    (6, '2025-11-24', 'Grange C', 5, 'Elm Park C', 2),
    (7, '2025-12-01', 'Newlands C', 3, 'Grange C', 4),
    (7, '2025-12-01', 'Elm Park C', 3, 'Castle C', 4),
    (8, '2025-12-08', 'Castle C', 4, 'Grange C', 3),
    (8, '2025-12-08', 'Elm Park C', 1, 'Stackstown C', 6),
    (9, '2025-12-15', 'Castle C', 4, 'Newlands C', 3),
    (9, '2025-12-15', 'Grange C', 3, 'Stackstown C', 4),
    (10, '2026-01-05', 'Newlands C', 4, 'Elm Park C', 3),
    (10, '2026-01-05', 'Stackstown C', 6, 'Castle C', 1),
    (11, '2026-01-12', 'Newlands C', 1, 'Stackstown C', 6),
    (11, '2026-01-12', 'Elm Park C', 3, 'Grange C', 4),
    (12, '2026-01-19', 'Grange C', 5, 'Newlands C', 2),
    (12, '2026-01-19', 'Castle C', 5, 'Elm Park C', 2),
    (13, '2026-01-26', 'Grange C', 4, 'Castle C', 3),
    (13, '2026-01-26', 'Stackstown C', 4, 'Elm Park C', 3),
    (14, '2026-02-02', 'Newlands C', 5, 'Castle C', 2),
    (14, '2026-02-02', 'Stackstown C', 6, 'Grange C', 1),
    (15, '2026-02-16', 'Elm Park C', 4, 'Newlands C', 3),
    (15, '2026-02-16', 'Castle C', 2, 'Stackstown C', 5);

with resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'C League'
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
  join public.league l on l.name = 'C League'
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
  join public.league l on l.name = 'C League'
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
  join public.league l on l.name = 'C League'
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
  join public.league l on l.name = 'C League'
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
