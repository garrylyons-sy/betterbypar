-- Reset Castle club competitions and seed the standard competition set.
-- Draws, entries and matches are removed through cascading deletes.

begin;

with castle as (
  select id
  from public.club
  where name = 'Castle Golf Club'
  limit 1
)
delete from public.competition
where club_id in (select id from castle)
  and managed_by_platform = false;

with castle as (
  select id
  from public.club
  where name = 'Castle Golf Club'
  limit 1
),
source_competitions(name, competition_type, rules) as (
  values
    ('Club Championship', 'Scratch', 'Castle Golf Club scratch singles championship.'),
    ('Club Handicap', 'Handicap', 'Castle Golf Club handicap singles competition.'),
    ('Intermediate', 'Scratch', 'Castle Golf Club intermediate scratch singles competition.'),
    ('Martin Connor', 'Handicap', 'Castle Golf Club Martin Connor handicap singles competition.')
)
insert into public.competition (
  club_id,
  managed_by_platform,
  name,
  competition_type,
  entry_closes_at,
  rules,
  status,
  round_settings_confirmed
)
select
  castle.id,
  false,
  source_competitions.name,
  source_competitions.competition_type,
  '2026-06-30'::date,
  source_competitions.rules,
  'Open',
  false
from castle
cross join source_competitions;

commit;
