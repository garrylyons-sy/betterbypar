-- Replace all 2026/27 league fixtures with the schedule from
-- Interclub Snooker League Schedule 2026-2027.xlsx.
-- Concrete league fixtures are loaded for weeks 1-18. Break rows, byes,
-- Paddy O'Brien dates and playoff placeholder rows are intentionally not
-- inserted as fixture rows because fixtures require two real teams.

insert into public.season (name, starts_on, ends_on, active)
values ('2026/27', '2026-09-28', '2027-03-31', true)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    active = excluded.active;

insert into public.league (name, playing_day)
values
  ('A League', 'Thursday'),
  ('B League', 'Thursday'),
  ('C League', 'Monday')
on conflict (name) do update
set playing_day = excluded.playing_day;

with source_clubs (club_name) as (
  values
    ('Castle Golf Club'),
    ('Dun Laoghaire Golf Club'),
    ('Elm Park Golf Club'),
    ('Fitzwilliam Lawn Tennis Club'),
    ('Grange Golf Club'),
    ('Milltown Golf Club'),
    ('Newlands Golf Club'),
    ('Stackstown Golf Club'),
    ('Woodbrook Golf Club')
)
insert into public.club (name, active)
select club_name, true
from source_clubs
on conflict (name) do update
set active = true;

create temporary table tmp_2026_27_source_teams (
  club_name text not null,
  league_name text not null,
  team_name text not null
) on commit drop;

insert into tmp_2026_27_source_teams (club_name, league_name, team_name)
values
    ('Castle Golf Club', 'A League', 'Castle A'),
    ('Dun Laoghaire Golf Club', 'A League', 'Dun Laoghaire A'),
    ('Elm Park Golf Club', 'A League', 'Elm Park A'),
    ('Fitzwilliam Lawn Tennis Club', 'A League', 'Fitzwilliam A'),
    ('Grange Golf Club', 'A League', 'Grange A'),
    ('Milltown Golf Club', 'A League', 'Milltown A'),
    ('Newlands Golf Club', 'A League', 'Newlands A'),
    ('Stackstown Golf Club', 'A League', 'Stackstown A'),
    ('Woodbrook Golf Club', 'A League', 'Woodbrook A'),
    ('Castle Golf Club', 'B League', 'Castle B'),
    ('Dun Laoghaire Golf Club', 'B League', 'Dun Laoghaire B'),
    ('Elm Park Golf Club', 'B League', 'Elm Park B'),
    ('Fitzwilliam Lawn Tennis Club', 'B League', 'Fitzwilliam B'),
    ('Grange Golf Club', 'B League', 'Grange B'),
    ('Milltown Golf Club', 'B League', 'Milltown B'),
    ('Newlands Golf Club', 'B League', 'Newlands B'),
    ('Stackstown Golf Club', 'B League', 'Stackstown B'),
    ('Castle Golf Club', 'C League', 'Castle C'),
    ('Castle Golf Club', 'C League', 'Castle D'),
    ('Elm Park Golf Club', 'C League', 'Elm Park C'),
    ('Grange Golf Club', 'C League', 'Grange C'),
    ('Grange Golf Club', 'C League', 'Grange D'),
    ('Milltown Golf Club', 'C League', 'Milltown C'),
    ('Newlands Golf Club', 'C League', 'Newlands C'),
    ('Stackstown Golf Club', 'C League', 'Stackstown C'),
    ('Stackstown Golf Club', 'C League', 'Stackstown D');

create temporary table tmp_2026_27_source_weeks (
  league_name text not null,
  week_number integer not null,
  week_label text not null,
  starts_on date not null
) on commit drop;

insert into tmp_2026_27_source_weeks (league_name, week_number, week_label, starts_on)
values
    ('A League', '1', 'Week 1', '2026-10-01'::date),
    ('A League', '2', 'Week 2', '2026-10-08'::date),
    ('A League', '3', 'Week 3', '2026-10-15'::date),
    ('A League', '4', 'Week 4', '2026-10-22'::date),
    ('A League', '5', 'Week 5', '2026-10-29'::date),
    ('A League', '6', 'Week 6', '2026-11-05'::date),
    ('A League', '7', 'Week 7', '2026-11-12'::date),
    ('A League', '8', 'Week 8', '2026-11-19'::date),
    ('A League', '9', 'Week 9', '2026-11-26'::date),
    ('A League', '10', 'Week 10', '2026-12-03'::date),
    ('A League', '11', 'Week 11', '2026-12-17'::date),
    ('A League', '12', 'Week 12', '2027-01-07'::date),
    ('A League', '13', 'Week 13', '2027-01-14'::date),
    ('A League', '14', 'Week 14', '2027-01-21'::date),
    ('A League', '15', 'Week 15', '2027-02-04'::date),
    ('A League', '16', 'Week 16', '2027-02-11'::date),
    ('A League', '17', 'Week 17', '2027-02-25'::date),
    ('A League', '18', 'Week 18', '2027-03-04'::date),
    ('B League', '1', 'Week 1', '2026-10-01'::date),
    ('B League', '2', 'Week 2', '2026-10-08'::date),
    ('B League', '3', 'Week 3', '2026-10-15'::date),
    ('B League', '4', 'Week 4', '2026-10-22'::date),
    ('B League', '5', 'Week 5', '2026-10-29'::date),
    ('B League', '6', 'Week 6', '2026-11-05'::date),
    ('B League', '7', 'Week 7', '2026-11-12'::date),
    ('B League', '8', 'Week 8', '2026-11-19'::date),
    ('B League', '9', 'Week 9', '2026-11-26'::date),
    ('B League', '10', 'Week 10', '2026-12-03'::date),
    ('B League', '11', 'Week 11', '2026-12-17'::date),
    ('B League', '12', 'Week 12', '2027-01-07'::date),
    ('B League', '13', 'Week 13', '2027-01-14'::date),
    ('B League', '14', 'Week 14', '2027-01-21'::date),
    ('B League', '15', 'Week 15', '2027-02-04'::date),
    ('B League', '16', 'Week 16', '2027-02-11'::date),
    ('B League', '17', 'Week 17', '2027-02-25'::date),
    ('B League', '18', 'Week 18', '2027-03-04'::date),
    ('C League', '1', 'Week 1', '2026-09-28'::date),
    ('C League', '2', 'Week 2', '2026-10-05'::date),
    ('C League', '3', 'Week 3', '2026-10-12'::date),
    ('C League', '4', 'Week 4', '2026-10-19'::date),
    ('C League', '5', 'Week 5', '2026-10-26'::date),
    ('C League', '6', 'Week 6', '2026-11-02'::date),
    ('C League', '7', 'Week 7', '2026-11-09'::date),
    ('C League', '8', 'Week 8', '2026-11-16'::date),
    ('C League', '9', 'Week 9', '2026-11-23'::date),
    ('C League', '10', 'Week 10', '2026-11-30'::date),
    ('C League', '11', 'Week 11', '2026-12-14'::date),
    ('C League', '12', 'Week 12', '2027-01-04'::date),
    ('C League', '13', 'Week 13', '2027-01-11'::date),
    ('C League', '14', 'Week 14', '2027-01-18'::date),
    ('C League', '15', 'Week 15', '2027-02-01'::date),
    ('C League', '16', 'Week 16', '2027-02-08'::date),
    ('C League', '17', 'Week 17', '2027-02-22'::date),
    ('C League', '18', 'Week 18', '2027-03-01'::date);

create temporary table tmp_2026_27_source_fixtures (
  league_name text not null,
  week_number integer not null,
  fixture_date date not null,
  home_team_name text not null,
  away_team_name text not null
) on commit drop;

insert into tmp_2026_27_source_fixtures (league_name, week_number, fixture_date, home_team_name, away_team_name)
values
    ('A League', '1', '2026-10-01'::date, 'Dun Laoghaire A', 'Elm Park A'),
    ('A League', '1', '2026-10-01'::date, 'Grange A', 'Newlands A'),
    ('A League', '1', '2026-10-01'::date, 'Milltown A', 'Fitzwilliam A'),
    ('A League', '1', '2026-10-01'::date, 'Woodbrook A', 'Stackstown A'),
    ('A League', '2', '2026-10-08'::date, 'Castle A', 'Milltown A'),
    ('A League', '2', '2026-10-08'::date, 'Dun Laoghaire A', 'Stackstown A'),
    ('A League', '2', '2026-10-08'::date, 'Elm Park A', 'Grange A'),
    ('A League', '2', '2026-10-08'::date, 'Fitzwilliam A', 'Newlands A'),
    ('A League', '3', '2026-10-15'::date, 'Elm Park A', 'Castle A'),
    ('A League', '3', '2026-10-15'::date, 'Grange A', 'Dun Laoghaire A'),
    ('A League', '3', '2026-10-15'::date, 'Stackstown A', 'Newlands A'),
    ('A League', '3', '2026-10-15'::date, 'Woodbrook A', 'Fitzwilliam A'),
    ('A League', '4', '2026-10-22'::date, 'Castle A', 'Grange A'),
    ('A League', '4', '2026-10-22'::date, 'Dun Laoghaire A', 'Fitzwilliam A'),
    ('A League', '4', '2026-10-22'::date, 'Stackstown A', 'Elm Park A'),
    ('A League', '4', '2026-10-22'::date, 'Woodbrook A', 'Milltown A'),
    ('A League', '5', '2026-10-29'::date, 'Dun Laoghaire A', 'Castle A'),
    ('A League', '5', '2026-10-29'::date, 'Grange A', 'Woodbrook A'),
    ('A League', '5', '2026-10-29'::date, 'Milltown A', 'Stackstown A'),
    ('A League', '5', '2026-10-29'::date, 'Newlands A', 'Elm Park A'),
    ('A League', '6', '2026-11-05'::date, 'Elm Park A', 'Woodbrook A'),
    ('A League', '6', '2026-11-05'::date, 'Fitzwilliam A', 'Castle A'),
    ('A League', '6', '2026-11-05'::date, 'Grange A', 'Milltown A'),
    ('A League', '6', '2026-11-05'::date, 'Newlands A', 'Dun Laoghaire A'),
    ('A League', '7', '2026-11-12'::date, 'Castle A', 'Newlands A'),
    ('A League', '7', '2026-11-12'::date, 'Fitzwilliam A', 'Stackstown A'),
    ('A League', '7', '2026-11-12'::date, 'Milltown A', 'Elm Park A'),
    ('A League', '7', '2026-11-12'::date, 'Woodbrook A', 'Dun Laoghaire A'),
    ('A League', '8', '2026-11-19'::date, 'Elm Park A', 'Fitzwilliam A'),
    ('A League', '8', '2026-11-19'::date, 'Newlands A', 'Milltown A'),
    ('A League', '8', '2026-11-19'::date, 'Stackstown A', 'Grange A'),
    ('A League', '8', '2026-11-19'::date, 'Woodbrook A', 'Castle A'),
    ('A League', '9', '2026-11-26'::date, 'Castle A', 'Stackstown A'),
    ('A League', '9', '2026-11-26'::date, 'Dun Laoghaire A', 'Milltown A'),
    ('A League', '9', '2026-11-26'::date, 'Fitzwilliam A', 'Grange A'),
    ('A League', '9', '2026-11-26'::date, 'Newlands A', 'Woodbrook A'),
    ('A League', '10', '2026-12-03'::date, 'Elm Park A', 'Dun Laoghaire A'),
    ('A League', '10', '2026-12-03'::date, 'Fitzwilliam A', 'Milltown A'),
    ('A League', '10', '2026-12-03'::date, 'Newlands A', 'Grange A'),
    ('A League', '10', '2026-12-03'::date, 'Stackstown A', 'Woodbrook A'),
    ('A League', '11', '2026-12-17'::date, 'Grange A', 'Elm Park A'),
    ('A League', '11', '2026-12-17'::date, 'Milltown A', 'Castle A'),
    ('A League', '11', '2026-12-17'::date, 'Newlands A', 'Fitzwilliam A'),
    ('A League', '11', '2026-12-17'::date, 'Stackstown A', 'Dun Laoghaire A'),
    ('A League', '12', '2027-01-07'::date, 'Castle A', 'Elm Park A'),
    ('A League', '12', '2027-01-07'::date, 'Dun Laoghaire A', 'Grange A'),
    ('A League', '12', '2027-01-07'::date, 'Fitzwilliam A', 'Woodbrook A'),
    ('A League', '12', '2027-01-07'::date, 'Newlands A', 'Stackstown A'),
    ('A League', '13', '2027-01-14'::date, 'Elm Park A', 'Stackstown A'),
    ('A League', '13', '2027-01-14'::date, 'Fitzwilliam A', 'Dun Laoghaire A'),
    ('A League', '13', '2027-01-14'::date, 'Grange A', 'Castle A'),
    ('A League', '13', '2027-01-14'::date, 'Milltown A', 'Woodbrook A'),
    ('A League', '14', '2027-01-21'::date, 'Castle A', 'Dun Laoghaire A'),
    ('A League', '14', '2027-01-21'::date, 'Elm Park A', 'Newlands A'),
    ('A League', '14', '2027-01-21'::date, 'Stackstown A', 'Milltown A'),
    ('A League', '14', '2027-01-21'::date, 'Woodbrook A', 'Grange A'),
    ('A League', '15', '2027-02-04'::date, 'Castle A', 'Fitzwilliam A'),
    ('A League', '15', '2027-02-04'::date, 'Dun Laoghaire A', 'Newlands A'),
    ('A League', '15', '2027-02-04'::date, 'Milltown A', 'Grange A'),
    ('A League', '15', '2027-02-04'::date, 'Woodbrook A', 'Elm Park A'),
    ('A League', '16', '2027-02-11'::date, 'Dun Laoghaire A', 'Woodbrook A'),
    ('A League', '16', '2027-02-11'::date, 'Elm Park A', 'Milltown A'),
    ('A League', '16', '2027-02-11'::date, 'Newlands A', 'Castle A'),
    ('A League', '16', '2027-02-11'::date, 'Stackstown A', 'Fitzwilliam A'),
    ('A League', '17', '2027-02-25'::date, 'Castle A', 'Woodbrook A'),
    ('A League', '17', '2027-02-25'::date, 'Fitzwilliam A', 'Elm Park A'),
    ('A League', '17', '2027-02-25'::date, 'Grange A', 'Stackstown A'),
    ('A League', '17', '2027-02-25'::date, 'Milltown A', 'Newlands A'),
    ('A League', '18', '2027-03-04'::date, 'Grange A', 'Fitzwilliam A'),
    ('A League', '18', '2027-03-04'::date, 'Milltown A', 'Dun Laoghaire A'),
    ('A League', '18', '2027-03-04'::date, 'Stackstown A', 'Castle A'),
    ('A League', '18', '2027-03-04'::date, 'Woodbrook A', 'Newlands A'),
    ('B League', '1', '2026-10-01'::date, 'Elm Park B', 'Dun Laoghaire B'),
    ('B League', '1', '2026-10-01'::date, 'Fitzwilliam B', 'Milltown B'),
    ('B League', '1', '2026-10-01'::date, 'Newlands B', 'Grange B'),
    ('B League', '1', '2026-10-01'::date, 'Stackstown B', 'Castle B'),
    ('B League', '2', '2026-10-08'::date, 'Grange B', 'Elm Park B'),
    ('B League', '2', '2026-10-08'::date, 'Milltown B', 'Castle B'),
    ('B League', '2', '2026-10-08'::date, 'Newlands B', 'Fitzwilliam B'),
    ('B League', '2', '2026-10-08'::date, 'Stackstown B', 'Dun Laoghaire B'),
    ('B League', '3', '2026-10-15'::date, 'Castle B', 'Elm Park B'),
    ('B League', '3', '2026-10-15'::date, 'Dun Laoghaire B', 'Milltown B'),
    ('B League', '3', '2026-10-15'::date, 'Fitzwilliam B', 'Grange B'),
    ('B League', '3', '2026-10-15'::date, 'Newlands B', 'Stackstown B'),
    ('B League', '4', '2026-10-22'::date, 'Elm Park B', 'Newlands B'),
    ('B League', '4', '2026-10-22'::date, 'Fitzwilliam B', 'Dun Laoghaire B'),
    ('B League', '4', '2026-10-22'::date, 'Grange B', 'Castle B'),
    ('B League', '4', '2026-10-22'::date, 'Milltown B', 'Stackstown B'),
    ('B League', '6', '2026-11-05'::date, 'Castle B', 'Fitzwilliam B'),
    ('B League', '6', '2026-11-05'::date, 'Dun Laoghaire B', 'Newlands B'),
    ('B League', '6', '2026-11-05'::date, 'Milltown B', 'Grange B'),
    ('B League', '6', '2026-11-05'::date, 'Stackstown B', 'Elm Park B'),
    ('B League', '7', '2026-11-12'::date, 'Dun Laoghaire B', 'Castle B'),
    ('B League', '7', '2026-11-12'::date, 'Elm Park B', 'Fitzwilliam B'),
    ('B League', '7', '2026-11-12'::date, 'Newlands B', 'Milltown B'),
    ('B League', '7', '2026-11-12'::date, 'Stackstown B', 'Grange B'),
    ('B League', '8', '2026-11-19'::date, 'Castle B', 'Newlands B'),
    ('B League', '8', '2026-11-19'::date, 'Fitzwilliam B', 'Stackstown B'),
    ('B League', '8', '2026-11-19'::date, 'Grange B', 'Dun Laoghaire B'),
    ('B League', '8', '2026-11-19'::date, 'Milltown B', 'Elm Park B'),
    ('B League', '10', '2026-12-03'::date, 'Castle B', 'Stackstown B'),
    ('B League', '10', '2026-12-03'::date, 'Dun Laoghaire B', 'Elm Park B'),
    ('B League', '10', '2026-12-03'::date, 'Grange B', 'Newlands B'),
    ('B League', '10', '2026-12-03'::date, 'Milltown B', 'Fitzwilliam B'),
    ('B League', '11', '2026-12-17'::date, 'Castle B', 'Milltown B'),
    ('B League', '11', '2026-12-17'::date, 'Dun Laoghaire B', 'Stackstown B'),
    ('B League', '11', '2026-12-17'::date, 'Elm Park B', 'Grange B'),
    ('B League', '11', '2026-12-17'::date, 'Fitzwilliam B', 'Newlands B'),
    ('B League', '12', '2027-01-07'::date, 'Elm Park B', 'Castle B'),
    ('B League', '12', '2027-01-07'::date, 'Grange B', 'Fitzwilliam B'),
    ('B League', '12', '2027-01-07'::date, 'Milltown B', 'Dun Laoghaire B'),
    ('B League', '12', '2027-01-07'::date, 'Stackstown B', 'Newlands B'),
    ('B League', '13', '2027-01-14'::date, 'Castle B', 'Grange B'),
    ('B League', '13', '2027-01-14'::date, 'Dun Laoghaire B', 'Fitzwilliam B'),
    ('B League', '13', '2027-01-14'::date, 'Newlands B', 'Elm Park B'),
    ('B League', '13', '2027-01-14'::date, 'Stackstown B', 'Milltown B'),
    ('B League', '15', '2027-02-04'::date, 'Elm Park B', 'Stackstown B'),
    ('B League', '15', '2027-02-04'::date, 'Fitzwilliam B', 'Castle B'),
    ('B League', '15', '2027-02-04'::date, 'Grange B', 'Milltown B'),
    ('B League', '15', '2027-02-04'::date, 'Newlands B', 'Dun Laoghaire B'),
    ('B League', '16', '2027-02-11'::date, 'Castle B', 'Dun Laoghaire B'),
    ('B League', '16', '2027-02-11'::date, 'Fitzwilliam B', 'Elm Park B'),
    ('B League', '16', '2027-02-11'::date, 'Grange B', 'Stackstown B'),
    ('B League', '16', '2027-02-11'::date, 'Milltown B', 'Newlands B'),
    ('B League', '17', '2027-02-25'::date, 'Dun Laoghaire B', 'Grange B'),
    ('B League', '17', '2027-02-25'::date, 'Elm Park B', 'Milltown B'),
    ('B League', '17', '2027-02-25'::date, 'Newlands B', 'Castle B'),
    ('B League', '17', '2027-02-25'::date, 'Stackstown B', 'Fitzwilliam B'),
    ('C League', '1', '2026-09-28'::date, 'Castle C', 'Stackstown C'),
    ('C League', '1', '2026-09-28'::date, 'Elm Park C', 'Grange C'),
    ('C League', '1', '2026-09-28'::date, 'Grange D', 'Newlands C'),
    ('C League', '1', '2026-09-28'::date, 'Stackstown D', 'Castle D'),
    ('C League', '2', '2026-10-05'::date, 'Castle D', 'Elm Park C'),
    ('C League', '2', '2026-10-05'::date, 'Grange C', 'Milltown C'),
    ('C League', '2', '2026-10-05'::date, 'Newlands C', 'Castle C'),
    ('C League', '2', '2026-10-05'::date, 'Stackstown C', 'Grange D'),
    ('C League', '3', '2026-10-12'::date, 'Elm Park C', 'Newlands C'),
    ('C League', '3', '2026-10-12'::date, 'Grange D', 'Castle D'),
    ('C League', '3', '2026-10-12'::date, 'Milltown C', 'Stackstown D'),
    ('C League', '3', '2026-10-12'::date, 'Stackstown C', 'Grange C'),
    ('C League', '4', '2026-10-19'::date, 'Castle D', 'Grange C'),
    ('C League', '4', '2026-10-19'::date, 'Grange D', 'Elm Park C'),
    ('C League', '4', '2026-10-19'::date, 'Milltown C', 'Castle C'),
    ('C League', '4', '2026-10-19'::date, 'Stackstown D', 'Stackstown C'),
    ('C League', '5', '2026-10-26'::date, 'Castle C', 'Castle D'),
    ('C League', '5', '2026-10-26'::date, 'Elm Park C', 'Stackstown D'),
    ('C League', '5', '2026-10-26'::date, 'Grange C', 'Grange D'),
    ('C League', '5', '2026-10-26'::date, 'Newlands C', 'Milltown C'),
    ('C League', '6', '2026-11-02'::date, 'Castle D', 'Milltown C'),
    ('C League', '6', '2026-11-02'::date, 'Grange D', 'Castle C'),
    ('C League', '6', '2026-11-02'::date, 'Newlands C', 'Stackstown C'),
    ('C League', '6', '2026-11-02'::date, 'Stackstown D', 'Grange C'),
    ('C League', '7', '2026-11-09'::date, 'Castle D', 'Stackstown C'),
    ('C League', '7', '2026-11-09'::date, 'Grange C', 'Castle C'),
    ('C League', '7', '2026-11-09'::date, 'Milltown C', 'Elm Park C'),
    ('C League', '7', '2026-11-09'::date, 'Stackstown D', 'Newlands C'),
    ('C League', '8', '2026-11-16'::date, 'Castle C', 'Elm Park C'),
    ('C League', '8', '2026-11-16'::date, 'Grange D', 'Stackstown D'),
    ('C League', '8', '2026-11-16'::date, 'Newlands C', 'Grange C'),
    ('C League', '8', '2026-11-16'::date, 'Stackstown C', 'Milltown C'),
    ('C League', '9', '2026-11-23'::date, 'Castle D', 'Newlands C'),
    ('C League', '9', '2026-11-23'::date, 'Elm Park C', 'Stackstown C'),
    ('C League', '9', '2026-11-23'::date, 'Milltown C', 'Grange D'),
    ('C League', '9', '2026-11-23'::date, 'Stackstown D', 'Castle C'),
    ('C League', '10', '2026-11-30'::date, 'Castle D', 'Stackstown D'),
    ('C League', '10', '2026-11-30'::date, 'Grange C', 'Elm Park C'),
    ('C League', '10', '2026-11-30'::date, 'Newlands C', 'Grange D'),
    ('C League', '10', '2026-11-30'::date, 'Stackstown C', 'Castle C'),
    ('C League', '11', '2026-12-14'::date, 'Castle C', 'Newlands C'),
    ('C League', '11', '2026-12-14'::date, 'Elm Park C', 'Castle D'),
    ('C League', '11', '2026-12-14'::date, 'Grange D', 'Stackstown C'),
    ('C League', '11', '2026-12-14'::date, 'Milltown C', 'Grange C'),
    ('C League', '12', '2027-01-04'::date, 'Castle D', 'Grange D'),
    ('C League', '12', '2027-01-04'::date, 'Grange C', 'Stackstown C'),
    ('C League', '12', '2027-01-04'::date, 'Newlands C', 'Elm Park C'),
    ('C League', '12', '2027-01-04'::date, 'Stackstown D', 'Milltown C'),
    ('C League', '13', '2027-01-11'::date, 'Castle C', 'Milltown C'),
    ('C League', '13', '2027-01-11'::date, 'Elm Park C', 'Grange D'),
    ('C League', '13', '2027-01-11'::date, 'Grange C', 'Castle D'),
    ('C League', '13', '2027-01-11'::date, 'Stackstown C', 'Stackstown D'),
    ('C League', '14', '2027-01-18'::date, 'Castle D', 'Castle C'),
    ('C League', '14', '2027-01-18'::date, 'Grange D', 'Grange C'),
    ('C League', '14', '2027-01-18'::date, 'Milltown C', 'Newlands C'),
    ('C League', '14', '2027-01-18'::date, 'Stackstown D', 'Elm Park C'),
    ('C League', '15', '2027-02-01'::date, 'Castle C', 'Grange D'),
    ('C League', '15', '2027-02-01'::date, 'Grange C', 'Stackstown D'),
    ('C League', '15', '2027-02-01'::date, 'Milltown C', 'Castle D'),
    ('C League', '15', '2027-02-01'::date, 'Stackstown C', 'Newlands C'),
    ('C League', '16', '2027-02-08'::date, 'Castle C', 'Grange C'),
    ('C League', '16', '2027-02-08'::date, 'Elm Park C', 'Milltown C'),
    ('C League', '16', '2027-02-08'::date, 'Newlands C', 'Stackstown D'),
    ('C League', '16', '2027-02-08'::date, 'Stackstown C', 'Castle D'),
    ('C League', '17', '2027-02-22'::date, 'Elm Park C', 'Castle C'),
    ('C League', '17', '2027-02-22'::date, 'Grange C', 'Newlands C'),
    ('C League', '17', '2027-02-22'::date, 'Milltown C', 'Stackstown C'),
    ('C League', '17', '2027-02-22'::date, 'Stackstown D', 'Grange D'),
    ('C League', '18', '2027-03-01'::date, 'Castle C', 'Stackstown D'),
    ('C League', '18', '2027-03-01'::date, 'Grange D', 'Milltown C'),
    ('C League', '18', '2027-03-01'::date, 'Newlands C', 'Castle D'),
    ('C League', '18', '2027-03-01'::date, 'Stackstown C', 'Elm Park C');

create temporary table tmp_2026_27_source_byes (
  league_name text not null,
  week_number integer not null,
  fixture_date date not null,
  team_name text not null
) on commit drop;

insert into tmp_2026_27_source_byes (league_name, week_number, fixture_date, team_name)
values
    ('A League', '1', '2026-10-01'::date, 'Castle A'),
    ('A League', '2', '2026-10-08'::date, 'Woodbrook A'),
    ('A League', '3', '2026-10-15'::date, 'Milltown A'),
    ('A League', '4', '2026-10-22'::date, 'Newlands A'),
    ('A League', '5', '2026-10-29'::date, 'Fitzwilliam A'),
    ('A League', '6', '2026-11-05'::date, 'Stackstown A'),
    ('A League', '7', '2026-11-12'::date, 'Grange A'),
    ('A League', '8', '2026-11-19'::date, 'Dun Laoghaire A'),
    ('A League', '9', '2026-11-26'::date, 'Elm Park A'),
    ('A League', '10', '2026-12-03'::date, 'Castle A'),
    ('A League', '11', '2026-12-17'::date, 'Woodbrook A'),
    ('A League', '12', '2027-01-07'::date, 'Milltown A'),
    ('A League', '13', '2027-01-14'::date, 'Newlands A'),
    ('A League', '14', '2027-01-21'::date, 'Fitzwilliam A'),
    ('A League', '15', '2027-02-04'::date, 'Stackstown A'),
    ('A League', '16', '2027-02-11'::date, 'Grange A'),
    ('A League', '17', '2027-02-25'::date, 'Dun Laoghaire A'),
    ('A League', '18', '2027-03-04'::date, 'Elm Park A'),
    ('C League', '1', '2026-09-28'::date, 'Milltown C'),
    ('C League', '2', '2026-10-05'::date, 'Stackstown D'),
    ('C League', '3', '2026-10-12'::date, 'Castle C'),
    ('C League', '4', '2026-10-19'::date, 'Newlands C'),
    ('C League', '5', '2026-10-26'::date, 'Stackstown C'),
    ('C League', '6', '2026-11-02'::date, 'Elm Park C'),
    ('C League', '7', '2026-11-09'::date, 'Grange D'),
    ('C League', '8', '2026-11-16'::date, 'Castle D'),
    ('C League', '9', '2026-11-23'::date, 'Grange C'),
    ('C League', '10', '2026-11-30'::date, 'Milltown C'),
    ('C League', '11', '2026-12-14'::date, 'Stackstown D'),
    ('C League', '12', '2027-01-04'::date, 'Castle C'),
    ('C League', '13', '2027-01-11'::date, 'Newlands C'),
    ('C League', '14', '2027-01-18'::date, 'Stackstown C'),
    ('C League', '15', '2027-02-01'::date, 'Elm Park C'),
    ('C League', '16', '2027-02-08'::date, 'Grange D'),
    ('C League', '17', '2027-02-22'::date, 'Castle D'),
    ('C League', '18', '2027-03-01'::date, 'Grange C');

with target_season as (
  select id from public.season where name = '2026/27'
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, l.id, target_season.id, st.team_name, true
from tmp_2026_27_source_teams st
join public.club c on c.name = st.club_name
join public.league l on l.name = st.league_name
cross join target_season
on conflict (league_id, season_id, name) do update
set club_id = excluded.club_id,
    active = true;

do $$
declare
  season_uuid uuid;
begin
  select id into season_uuid
  from public.season
  where name = '2026/27';

  delete from public.player_game_result
  where season_id = season_uuid;

  delete from public.fixture
  where season_id = season_uuid;

  delete from public.fixture_week
  where season_id = season_uuid;
end $$;

with target_season as (
  select id from public.season where name = '2026/27'
)
delete from public.team t
using target_season
where t.season_id = target_season.id
  and not exists (
    select 1
    from tmp_2026_27_source_teams st
    join public.league l on l.name = st.league_name
    join public.club c on c.name = st.club_name
    where t.league_id = l.id
      and t.club_id = c.id
      and t.name = st.team_name
  );

with target_season as (
  select id from public.season where name = '2026/27'
)
insert into public.fixture_week (season_id, league_id, week_number, week_label, starts_on)
select target_season.id, l.id, sw.week_number, sw.week_label, sw.starts_on
from tmp_2026_27_source_weeks sw
join public.league l on l.name = sw.league_name
cross join target_season
on conflict (season_id, league_id, week_number) do update
set week_label = excluded.week_label,
    starts_on = excluded.starts_on;

with target_season as (
  select id from public.season where name = '2026/27'
), resolved as (
  select
    target_season.id as season_id,
    l.id as league_id,
    sf.week_number,
    sf.fixture_date,
    ht.id as home_team_id,
    at.id as away_team_id
  from tmp_2026_27_source_fixtures sf
  join public.league l on l.name = sf.league_name
  cross join target_season
  join public.team ht
    on ht.name = sf.home_team_name
   and ht.league_id = l.id
   and ht.season_id = target_season.id
  join public.team at
    on at.name = sf.away_team_name
   and at.league_id = l.id
   and at.season_id = target_season.id
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

insert into public.match (fixture_id, home_team_score, away_team_score)
select f.id, 0, 0
from public.fixture f
join public.season s on s.id = f.season_id
where s.name = '2026/27'
on conflict (fixture_id) do nothing;

insert into public.fixture_week_match (week_id, match_id)
select fw.id, m.id
from public.fixture f
join public.match m on m.fixture_id = f.id
join public.fixture_week fw
  on fw.season_id = f.season_id
 and fw.league_id = f.league_id
 and fw.starts_on = f.fixture_date::date
join public.season s on s.id = f.season_id
where s.name = '2026/27'
on conflict (match_id) do update
set week_id = excluded.week_id;

with target_season as (
  select id from public.season where name = '2026/27'
)
insert into public.team_membership (team_id, person_id, role, joined_date, active)
select t.id, ptr.person_id, ptr.role, least(coalesce(ptr.joined_date, current_date), current_date), true
from public.person_team_role ptr
join target_season on true
join public.team t
  on t.season_id = target_season.id
 and t.club_id = ptr.club_id
 and t.league_id = ptr.league_id
 and t.name = ptr.team_name
where ptr.active = true
on conflict (team_id, person_id, role) do update
set active = true;

-- Summary expected from the source workbook:
-- Teams: 26
-- Fixture weeks: 54
-- Concrete fixtures: 200
-- No-match rows skipped: 36
