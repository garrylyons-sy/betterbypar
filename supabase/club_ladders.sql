-- Club-scoped challenge ladders. Application APIs enforce membership,
-- challenge-range, rejection and result-confirmation rules.

create table if not exists public.club_ladder (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null unique references public.club(id) on delete cascade,
  name text not null default 'Club Ladder',
  match_format text not null default 'Best of 3'
    check (match_format in ('1 Frame', 'Best of 3', 'Best of 5')),
  challenge_range integer not null default 3 check (challenge_range between 1 and 10),
  response_hours integer not null default 48 check (response_hours between 12 and 168),
  play_within_days integer not null default 14 check (play_within_days between 1 and 60),
  active boolean not null default true,
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_ladder_entry (
  id uuid primary key default gen_random_uuid(),
  ladder_id uuid not null references public.club_ladder(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  position integer not null check (position > 0),
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Withdrawn')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ladder_id, person_id),
  unique (ladder_id, position) deferrable initially immediate
);

create table if not exists public.club_ladder_challenge (
  id uuid primary key default gen_random_uuid(),
  ladder_id uuid not null references public.club_ladder(id) on delete cascade,
  challenger_entry_id uuid not null references public.club_ladder_entry(id) on delete cascade,
  challenged_entry_id uuid not null references public.club_ladder_entry(id) on delete cascade,
  status text not null default 'Pending'
    check (status in ('Pending', 'Accepted', 'Scheduled', 'Rejected', 'Result Pending', 'Completed', 'Disputed', 'Expired', 'Cancelled', 'Walkover')),
  response_due_at timestamptz not null,
  accepted_at timestamptz,
  scheduled_at timestamptz,
  play_by timestamptz,
  result_submitted_by uuid references public.person(id) on delete set null,
  challenger_score integer check (challenger_score between 0 and 3),
  challenged_score integer check (challenged_score between 0 and 3),
  winner_entry_id uuid references public.club_ladder_entry(id) on delete set null,
  result_submitted_at timestamptz,
  completed_at timestamptz,
  rejection_number integer check (rejection_number in (1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_entry_id <> challenged_entry_id)
);

create index if not exists club_ladder_entry_position_idx
  on public.club_ladder_entry(ladder_id, status, position);
create index if not exists club_ladder_challenge_status_idx
  on public.club_ladder_challenge(ladder_id, status, created_at desc);
create index if not exists club_ladder_challenge_players_idx
  on public.club_ladder_challenge(challenger_entry_id, challenged_entry_id, status);

alter table public.club_ladder enable row level security;
alter table public.club_ladder_entry enable row level security;
alter table public.club_ladder_challenge enable row level security;

drop policy if exists "authenticated users can read club ladders" on public.club_ladder;
create policy "authenticated users can read club ladders"
  on public.club_ladder for select to authenticated using (true);
drop policy if exists "authenticated users can read club ladder entries" on public.club_ladder_entry;
create policy "authenticated users can read club ladder entries"
  on public.club_ladder_entry for select to authenticated using (true);
drop policy if exists "authenticated users can read club ladder challenges" on public.club_ladder_challenge;
create policy "authenticated users can read club ladder challenges"
  on public.club_ladder_challenge for select to authenticated using (true);

comment on table public.club_ladder is 'One configurable challenge ladder per club.';
comment on table public.club_ladder_entry is 'A club member position in a club ladder.';
comment on table public.club_ladder_challenge is 'Challenge, schedule and confirmed result history for a club ladder.';
