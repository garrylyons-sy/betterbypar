alter table public.fixture
  add column if not exists original_fixture_date timestamptz;

comment on column public.fixture.original_fixture_date is
  'The first scheduled date, retained when fixture_date changes after a postponement.';

update public.fixture f
set original_fixture_date = (fw.starts_on::text || ' 00:00:00+00')::timestamptz
from public.match m
join public.fixture_week_match fwm on fwm.match_id = m.id
join public.fixture_week fw on fw.id = fwm.week_id
where m.fixture_id = f.id
  and f.original_fixture_date is null
  and f.fixture_date::date <> fw.starts_on;
