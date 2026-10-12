create table if not exists public.last_man_standing_competition (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete restrict,
  name text not null,
  audience text not null default 'League Chair' check (audience in ('League Chair', 'Everyone')),
  entry_opens_at timestamptz not null,
  entry_closes_at timestamptz not null,
  processing_time time not null default '19:30',
  status text not null default 'Draft' check (status in ('Draft', 'Open', 'In Progress', 'Complete', 'No Winner', 'Archived')),
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_closes_at > entry_opens_at),
  unique (season_id, name)
);

create table if not exists public.last_man_standing_round (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  cycle_number integer not null default 1 check (cycle_number > 0),
  round_number integer not null check (round_number > 0),
  name text not null,
  status text not null default 'Planned' check (status in ('Planned', 'Open', 'Locked', 'Needs Review', 'Settled')),
  deciding_round boolean not null default false,
  opened_at timestamptz,
  locked_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, cycle_number, round_number)
);

create table if not exists public.last_man_standing_round_schedule (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.last_man_standing_round(id) on delete cascade,
  tier text not null check (tier in ('A', 'B', 'C')),
  league_id uuid not null references public.league(id) on delete restrict,
  fixture_week_id uuid not null references public.fixture_week(id) on delete restrict,
  default_match_date date not null,
  deadline_time time not null default '12:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, tier)
);

create table if not exists public.last_man_standing_entry (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete restrict,
  source_role text not null check (source_role in ('Player', 'Manager', 'Club Member')),
  tier text not null check (tier in ('A', 'B', 'C')),
  source_team_id uuid not null references public.team(id) on delete restrict,
  status text not null default 'Entered' check (status in ('Entered', 'Standing', 'Eliminated', 'Withdrawn', 'Winner')),
  entered_at timestamptz not null default now(),
  eliminated_round_id uuid references public.last_man_standing_round(id) on delete set null,
  winner boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (competition_id, person_id)
);

create table if not exists public.last_man_standing_team_order_snapshot (
  id uuid primary key default gen_random_uuid(),
  round_schedule_id uuid not null references public.last_man_standing_round_schedule(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete restrict,
  position integer not null check (position > 0),
  captured_at timestamptz not null default now(),
  unique (round_schedule_id, team_id),
  unique (round_schedule_id, position)
);

create table if not exists public.last_man_standing_pick (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.last_man_standing_entry(id) on delete cascade,
  round_id uuid not null references public.last_man_standing_round(id) on delete cascade,
  slot_number integer not null check (slot_number in (1, 2)),
  selected_player_id uuid references public.person(id) on delete restrict,
  effective_player_id uuid references public.person(id) on delete restrict,
  source_fixture_id uuid references public.fixture(id) on delete restrict,
  source_game_id uuid references public.game(id) on delete restrict,
  source_lineup_slot_id uuid references public.fixture_lineup_slot(id) on delete restrict,
  state text not null default 'Draft' check (state in ('Draft', 'Locked', 'Automatic', 'Needs Review', 'Settled')),
  automatic_reason text,
  outcome text not null default 'Pending' check (outcome in ('Pending', 'Won', 'Lost', 'No Eligible Pick')),
  table_order_snapshot jsonb not null default '[]'::jsonb,
  deadline_at timestamptz,
  locked_at timestamptz,
  settled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, round_id, slot_number),
  check (
    selected_player_id is null
    or effective_player_id is null
    or selected_player_id = effective_player_id
    or automatic_reason is not null
  )
);

create table if not exists public.last_man_standing_event (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  entry_id uuid references public.last_man_standing_entry(id) on delete cascade,
  round_id uuid references public.last_man_standing_round(id) on delete cascade,
  pick_id uuid references public.last_man_standing_pick(id) on delete cascade,
  actor_person_id uuid references public.person(id) on delete set null,
  event_type text not null check (event_type in ('Entry Created', 'Entry Withdrawn', 'Pick Saved', 'Pick Locked', 'Automatic Pick', 'Needs Review', 'Pick Settled', 'Entry Eliminated', 'Winner Declared', 'Round Reopened', 'Entrants Reinstated', 'Admin Override')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists last_man_standing_competition_status_idx
  on public.last_man_standing_competition (status, season_id);
create index if not exists last_man_standing_round_status_idx
  on public.last_man_standing_round (competition_id, status, cycle_number, round_number);
create index if not exists last_man_standing_entry_active_idx
  on public.last_man_standing_entry (competition_id, status)
  where status in ('Entered', 'Standing');
create index if not exists last_man_standing_pick_effective_player_idx
  on public.last_man_standing_pick (effective_player_id, round_id)
  where effective_player_id is not null;
create index if not exists last_man_standing_pick_state_idx
  on public.last_man_standing_pick (round_id, state, outcome);
create index if not exists last_man_standing_event_competition_idx
  on public.last_man_standing_event (competition_id, created_at desc);

create or replace function public.prevent_last_man_standing_event_change()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Last Man Standing events are immutable';
end;
$$;

drop trigger if exists last_man_standing_event_immutable on public.last_man_standing_event;
create trigger last_man_standing_event_immutable
before update or delete on public.last_man_standing_event
for each row execute function public.prevent_last_man_standing_event_change();

alter table public.last_man_standing_competition enable row level security;
alter table public.last_man_standing_round enable row level security;
alter table public.last_man_standing_round_schedule enable row level security;
alter table public.last_man_standing_entry enable row level security;
alter table public.last_man_standing_pick enable row level security;
alter table public.last_man_standing_team_order_snapshot enable row level security;
alter table public.last_man_standing_event enable row level security;

comment on table public.last_man_standing_competition is 'Independent Last Man Standing competitions with audience-gated entry.';
comment on table public.last_man_standing_pick is 'Two current pick slots per entrant and round, preserving manual and effective automatic selections.';
comment on table public.last_man_standing_event is 'Immutable audit history for Last Man Standing entry, pick, processing, and administration actions.';
