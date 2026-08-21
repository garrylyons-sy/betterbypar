do $$
begin
  alter table public.game drop constraint if exists game_check;
  alter table public.game add constraint game_live_order_check
    check (
      (game_type = 'Singles' and game_number between 1 and 6 and points_awarded = 1)
      or
      (game_type = 'Doubles' and game_number in (2, 3, 4) and points_awarded = 2)
    );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.fixture_lineup (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixture(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  submitted_by uuid references public.person(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (fixture_id, team_id)
);

create table if not exists public.fixture_lineup_slot (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.fixture_lineup(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 6),
  game_type public.game_type not null,
  player_1_id uuid references public.person(id) on delete restrict,
  player_2_id uuid references public.person(id) on delete restrict,
  unique (lineup_id, slot_number),
  check (game_type = 'Doubles' or player_2_id is null),
  check (player_1_id is null or player_1_id <> player_2_id),
  check (
    (slot_number in (2, 3, 4) and game_type = 'Doubles')
    or
    (slot_number between 1 and 6 and game_type = 'Singles')
  )
);

create index if not exists fixture_lineup_fixture_idx on public.fixture_lineup(fixture_id);
create index if not exists fixture_lineup_team_idx on public.fixture_lineup(team_id);

comment on table public.fixture_lineup is 'Manager lineup for a fixture. Draft lineups are private; Published lineups can be paired into generated games.';
comment on table public.fixture_lineup_slot is 'Ordered lineup slots. A/B use singles 1,2,4,5,6 plus doubles 3; C uses singles 1,3,5 plus doubles 2,4.';
