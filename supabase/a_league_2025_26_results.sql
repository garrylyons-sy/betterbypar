-- Generated from Snooker A League 25-26.xlsx.
-- Regular season only; the two semi-finals and final are intentionally excluded.

insert into public.season (name, starts_on, ends_on, active)
values ('2025/26', '2025-09-01', '2026-03-31', false)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into public.league (name, playing_day)
values ('A League', 'Thursday')
on conflict (name) do update set playing_day = excluded.playing_day;

insert into public.club (name, venue, logo_path, primary_color, accent_color, active)
values
  ('Castle Golf Club', 'Castle Golf Club', '/club-logos/castle.png', '#030E66', '#10233F', true),
  ('Grange Golf Club', 'Grange Golf Club', '/club-logos/grange.png', '#006B3F', '#003D2B', true),
  ('Milltown Golf Club', 'Milltown Golf Club', '/club-logos/milltown.png', '#1B5E3A', '#0F2F24', true),
  ('Elm Park Golf Club', 'Elm Park Golf Club', '/club-logos/elm-park.png', '#B43C2B', '#4A1114', true),
  ('Stackstown Golf Club', 'Stackstown Golf Club', '/club-logos/stackstown.png', '#1D7A43', '#0E3D25', true),
  ('Woodbrook Golf Club', 'Woodbrook Golf Club', '/club-logos/woodbrook.jpg', '#193C64', '#0B243B', true),
  ('Newlands Golf Club', 'Newlands Golf Club', '/club-logos/newlands.png', '#008E3A', '#005C2E', true),
  ('Dun Laoghaire Golf Club', 'Dun Laoghaire Golf Club', '/club-logos/dun-laoghaire.png', '#0E4D73', '#07233A', true),
  ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam Lawn Tennis Club', '/club-logos/fitzwilliam.png', '#9A7A18', '#111111', true)
on conflict (name) do update
set venue = excluded.venue,
    logo_path = excluded.logo_path,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    active = excluded.active;

with requested_teams (team_name, club_name) as (
  values
    ('Castle A', 'Castle Golf Club'),
    ('Grange A', 'Grange Golf Club'),
    ('Milltown A', 'Milltown Golf Club'),
    ('Elm Park A', 'Elm Park Golf Club'),
    ('Stackstown A', 'Stackstown Golf Club'),
    ('Woodbrook A', 'Woodbrook Golf Club'),
    ('Newlands A', 'Newlands Golf Club'),
    ('Dun Laoghaire A', 'Dun Laoghaire Golf Club'),
    ('Fitzwilliam A', 'Fitzwilliam Lawn Tennis Club')
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, l.id, s.id, rt.team_name, true
from requested_teams rt
join public.club c on c.name = rt.club_name
join public.league l on l.name = 'A League'
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
    (1, '2025-10-02', 'Castle A', 6, 'Fitzwilliam A', 1),
    (1, '2025-10-02', 'Elm Park A', 6, 'Woodbrook A', 1),
    (1, '2025-10-02', 'Dun Laoghaire A', 5, 'Newlands A', 2),
    (1, '2025-10-02', 'Milltown A', 3, 'Stackstown A', 4),
    (2, '2025-10-09', 'Newlands A', 2, 'Castle A', 5),
    (2, '2025-10-09', 'Stackstown A', 6, 'Woodbrook A', 1),
    (2, '2025-10-09', 'Elm Park A', 2, 'Grange A', 5),
    (2, '2025-10-09', 'Milltown A', 3, 'Dun Laoghaire A', 4),
    (3, '2025-10-16', 'Woodbrook A', 3, 'Castle A', 4),
    (3, '2025-10-16', 'Fitzwilliam A', 1, 'Newlands A', 6),
    (3, '2025-10-16', 'Stackstown A', 3, 'Elm Park A', 4),
    (3, '2025-10-16', 'Grange A', 4, 'Milltown A', 3),
    (4, '2025-10-23', 'Stackstown A', 4, 'Grange A', 3),
    (4, '2025-10-23', 'Milltown A', 3, 'Newlands A', 4),
    (4, '2025-10-23', 'Woodbrook A', 6, 'Dun Laoghaire A', 1),
    (4, '2025-10-23', 'Elm Park A', 5, 'Fitzwilliam A', 2),
    (5, '2025-10-30', 'Castle A', 4, 'Elm Park A', 3),
    (5, '2025-10-30', 'Dun Laoghaire A', 5, 'Fitzwilliam A', 2),
    (5, '2025-10-30', 'Woodbrook A', 4, 'Milltown A', 3),
    (5, '2025-10-30', 'Newlands A', 0, 'Grange A', 7),
    (6, '2025-11-06', 'Grange A', 6, 'Castle A', 1),
    (6, '2025-11-06', 'Dun Laoghaire A', 5, 'Stackstown A', 2),
    (6, '2025-11-06', 'Newlands A', 3, 'Elm Park A', 4),
    (6, '2025-11-06', 'Fitzwilliam A', 4, 'Woodbrook A', 3),
    (7, '2025-11-13', 'Castle A', 3, 'Milltown A', 4),
    (7, '2025-11-13', 'Grange A', 6, 'Dun Laoghaire A', 1),
    (7, '2025-11-13', 'Stackstown A', 7, 'Fitzwilliam A', 0),
    (7, '2025-11-13', 'Woodbrook A', 4, 'Newlands A', 3),
    (8, '2025-11-20', 'Castle A', 5, 'Woodbrook A', 2),
    (8, '2025-11-20', 'Newlands A', 7, 'Fitzwilliam A', 0),
    (8, '2025-11-20', 'Elm Park A', 1, 'Stackstown A', 6),
    (8, '2025-11-20', 'Milltown A', 2, 'Grange A', 5),
    (9, '2025-11-27', 'Castle A', 6, 'Stackstown A', 1),
    (9, '2025-11-27', 'Grange A', 7, 'Woodbrook A', 0),
    (9, '2025-11-27', 'Fitzwilliam A', 3, 'Milltown A', 4),
    (9, '2025-11-27', 'Elm Park A', 7, 'Dun Laoghaire A', 0),
    (10, '2025-12-04', 'Fitzwilliam A', 6, 'Castle A', 1),
    (10, '2025-12-04', 'Woodbrook A', 2, 'Elm Park A', 5),
    (10, '2025-12-04', 'Newlands A', 4, 'Dun Laoghaire A', 3),
    (10, '2025-12-04', 'Stackstown A', 4, 'Milltown A', 3),
    (11, '2025-12-11', 'Dun Laoghaire A', 4, 'Castle A', 3),
    (11, '2025-12-11', 'Milltown A', 5, 'Elm Park A', 2),
    (11, '2025-12-11', 'Fitzwilliam A', 2, 'Grange A', 5),
    (11, '2025-12-11', 'Newlands A', 1, 'Stackstown A', 6),
    (12, '2026-01-08', 'Castle A', 4, 'Newlands A', 3),
    (12, '2026-01-08', 'Woodbrook A', 2, 'Stackstown A', 5),
    (12, '2026-01-08', 'Grange A', 3, 'Elm Park A', 4),
    (12, '2026-01-08', 'Dun Laoghaire A', 4, 'Milltown A', 3),
    (13, '2026-01-15', 'Stackstown A', 7, 'Castle A', 0),
    (13, '2026-01-15', 'Woodbrook A', 1, 'Grange A', 6),
    (13, '2026-01-15', 'Milltown A', 3, 'Fitzwilliam A', 4),
    (13, '2026-01-15', 'Dun Laoghaire A', 3, 'Elm Park A', 4),
    (14, '2026-01-29', 'Grange A', 4, 'Stackstown A', 3),
    (14, '2026-01-29', 'Newlands A', 4, 'Milltown A', 3),
    (14, '2026-01-29', 'Dun Laoghaire A', 1, 'Woodbrook A', 6),
    (14, '2026-01-29', 'Fitzwilliam A', 3, 'Elm Park A', 4),
    (15, '2026-02-05', 'Castle A', 2, 'Grange A', 5),
    (15, '2026-02-05', 'Stackstown A', 3, 'Dun Laoghaire A', 4),
    (15, '2026-02-05', 'Elm Park A', 4, 'Newlands A', 3),
    (15, '2026-02-05', 'Woodbrook A', 6, 'Fitzwilliam A', 1),
    (16, '2026-02-19', 'Milltown A', 3, 'Castle A', 4),
    (16, '2026-02-19', 'Dun Laoghaire A', 1, 'Grange A', 6),
    (16, '2026-02-19', 'Fitzwilliam A', 3, 'Stackstown A', 4),
    (16, '2026-02-19', 'Newlands A', 6, 'Woodbrook A', 1),
    (17, '2026-02-26', 'Castle A', 4, 'Dun Laoghaire A', 3),
    (17, '2026-02-26', 'Elm Park A', 4, 'Milltown A', 3),
    (17, '2026-02-26', 'Grange A', 6, 'Fitzwilliam A', 1),
    (17, '2026-02-26', 'Stackstown A', 6, 'Newlands A', 1),
    (18, '2026-03-05', 'Elm Park A', 3, 'Castle A', 4),
    (18, '2026-03-05', 'Fitzwilliam A', 4, 'Dun Laoghaire A', 3),
    (18, '2026-03-05', 'Milltown A', 5, 'Woodbrook A', 2),
    (18, '2026-03-05', 'Grange A', 6, 'Newlands A', 1);

with
resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'A League'
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
  join public.league l on l.name = 'A League'
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

with source_players (first_name, last_name) as (
  values
    ('Andrew', 'Foley'),
    ('Conor', 'O''Boyle'),
    ('Garry', 'Lyons'),
    ('Paul', 'O''Donaghue'),
    ('Peadar', 'Hogan'),
    ('Michael', 'Byers'),
    ('Mick', 'McDermott'),
    ('Peter', 'Cosgrove'),
    ('Conor', 'O''Riordan'),
    ('John', 'Butler'),
    ('Rob', 'Buckley'),
    ('Pat', 'O''Hara'),
    ('Ger', 'Gormley'),
    ('Stephen', 'Hughes'),
    ('Conor', 'Faughnan')
)
insert into public.person (first_name, last_name, active)
select sp.first_name, sp.last_name, true
from source_players sp
where not exists (
  select 1
  from public.person p
  where p.first_name = sp.first_name
    and p.last_name = sp.last_name
);

with source_breaks (source_key, first_name, last_name, break_value) as (
  values
    ('a-league-2025-26-break-001', 'Andrew', 'Foley', 70),
    ('a-league-2025-26-break-002', 'Conor', 'O''Boyle', 69),
    ('a-league-2025-26-break-003', 'Garry', 'Lyons', 61),
    ('a-league-2025-26-break-004', 'Paul', 'O''Donaghue', 54),
    ('a-league-2025-26-break-005', 'Peadar', 'Hogan', 48),
    ('a-league-2025-26-break-006', 'Michael', 'Byers', 45),
    ('a-league-2025-26-break-007', 'Mick', 'McDermott', 43),
    ('a-league-2025-26-break-008', 'Peter', 'Cosgrove', 41),
    ('a-league-2025-26-break-009', 'Garry', 'Lyons', 40),
    ('a-league-2025-26-break-010', 'Conor', 'O''Riordan', 38),
    ('a-league-2025-26-break-011', 'Andrew', 'Foley', 38),
    ('a-league-2025-26-break-012', 'John', 'Butler', 35),
    ('a-league-2025-26-break-013', 'Rob', 'Buckley', 34),
    ('a-league-2025-26-break-014', 'Pat', 'O''Hara', 34),
    ('a-league-2025-26-break-015', 'Mick', 'McDermott', 32),
    ('a-league-2025-26-break-016', 'Ger', 'Gormley', 32),
    ('a-league-2025-26-break-017', 'Paul', 'O''Donaghue', 32),
    ('a-league-2025-26-break-018', 'Stephen', 'Hughes', 32),
    ('a-league-2025-26-break-019', 'Stephen', 'Hughes', 32),
    ('a-league-2025-26-break-020', 'Conor', 'Faughnan', 31),
    ('a-league-2025-26-break-021', 'Conor', 'O''Boyle', 30)
),
resolved as (
  select
    sb.source_key,
    p.id as player_id,
    s.id as season_id,
    l.id as league_id,
    sb.break_value
  from source_breaks sb
  join public.person p on p.first_name = sb.first_name and p.last_name = sb.last_name
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'A League'
)
insert into public.break (season_id, league_id, player_id, break_value, source_label, source_key, recorded_at)
select
  season_id,
  league_id,
  player_id,
  break_value,
  'Snooker A League 2025/26 break list',
  source_key,
  '2026-03-31 00:00:00+00'::timestamptz
from resolved
on conflict (source_key) do update
set season_id = excluded.season_id,
    league_id = excluded.league_id,
    player_id = excluded.player_id,
    break_value = excluded.break_value,
    source_label = excluded.source_label,
    recorded_at = excluded.recorded_at;
