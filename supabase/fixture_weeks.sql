create table if not exists public.fixture_week (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  week_label text not null,
  starts_on date,
  unique (season_id, league_id, week_number)
);

create table if not exists public.fixture_week_match (
  week_id uuid not null references public.fixture_week(id) on delete cascade,
  match_id uuid not null references public.match(id) on delete cascade,
  primary key (week_id, match_id),
  unique (match_id)
);

comment on table public.fixture_week is 'League fixture round/week grouping. One week can contain multiple matches for the same league and season.';
comment on table public.fixture_week_match is 'Join table linking a fixture week to the matches played in that week.';

with week_dates as (
  select
    f.season_id,
    f.league_id,
    f.fixture_date::date as starts_on,
    dense_rank() over (
      partition by f.season_id, f.league_id
      order by f.fixture_date::date
    ) as week_number
  from public.fixture f
  group by f.season_id, f.league_id, f.fixture_date::date
)
insert into public.fixture_week (season_id, league_id, week_number, week_label, starts_on)
select
  season_id,
  league_id,
  week_number,
  'Week ' || week_number,
  starts_on
from week_dates
on conflict (season_id, league_id, week_number) do update
  set week_label = excluded.week_label,
      starts_on = excluded.starts_on;

with week_dates as (
  select
    f.season_id,
    f.league_id,
    f.fixture_date::date as starts_on,
    dense_rank() over (
      partition by f.season_id, f.league_id
      order by f.fixture_date::date
    ) as week_number
  from public.fixture f
  group by f.season_id, f.league_id, f.fixture_date::date
)
insert into public.fixture_week_match (week_id, match_id)
select fw.id, m.id
from public.match m
join public.fixture f on f.id = m.fixture_id
join week_dates wd on wd.season_id = f.season_id
  and wd.league_id = f.league_id
  and wd.starts_on = f.fixture_date::date
join public.fixture_week fw on fw.season_id = f.season_id
  and fw.league_id = f.league_id
  and fw.week_number = wd.week_number
on conflict (match_id) do update
  set week_id = excluded.week_id;
