alter type public.user_activity_type
  add value if not exists 'Match Action';

create table if not exists public.live_frame_session (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixture(id) on delete cascade,
  game_id uuid not null references public.game(id) on delete cascade,
  status text not null default 'Live' check (status in ('Live', 'Paused', 'Completed', 'Abandoned')),
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  active_team_id uuid references public.team(id) on delete set null,
  active_player_id uuid references public.person(id) on delete set null,
  current_break integer not null default 0 check (current_break >= 0),
  reds_remaining integer not null default 15 check (reds_remaining between 0 and 15),
  phase text not null default 'reds' check (phase in ('reds', 'colours', 'respotted-black')),
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  scorer_person_id uuid references public.person(id) on delete set null,
  lease_expires_at timestamptz,
  started_by uuid references public.person(id) on delete set null,
  updated_by uuid references public.person(id) on delete set null,
  completed_by uuid references public.person(id) on delete set null,
  abandoned_by uuid references public.person(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz
);

create unique index if not exists live_frame_session_one_active_game_idx
  on public.live_frame_session (game_id)
  where status in ('Live', 'Paused');

create index if not exists live_frame_session_fixture_idx
  on public.live_frame_session (fixture_id, updated_at desc);

create table if not exists public.live_frame_event (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_frame_session(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (event_type in ('Start', 'Pot', 'Foul', 'EndVisit', 'SelectPlayer', 'CorrectBalls', 'Undo', 'Takeover', 'Pause', 'Resume', 'Complete', 'Abandon')),
  team_id uuid references public.team(id) on delete set null,
  player_id uuid references public.person(id) on delete set null,
  ball_value integer check (ball_value between 1 and 7),
  points integer check (points >= 0),
  state_before jsonb,
  state_after jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create index if not exists live_frame_event_session_idx
  on public.live_frame_event (session_id, sequence_number);

create or replace function public.reject_live_frame_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Live frame events are immutable';
end;
$$;

drop trigger if exists live_frame_event_immutable on public.live_frame_event;
create trigger live_frame_event_immutable
before update or delete on public.live_frame_event
for each row execute function public.reject_live_frame_event_mutation();

alter table public.live_frame_session replica identity full;
alter table public.live_frame_event replica identity full;

comment on table public.live_frame_session is 'League Chair live-scoring snapshot. Provisional totals become official only when the frame is completed.';
comment on table public.live_frame_event is 'Immutable ordered audit stream for a League Chair live-scoring session.';
