create table if not exists public.club_admin (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, person_id)
);

comment on table public.club_admin is 'Club-scoped administration permission for club competitions and club-level operations.';

create table if not exists public.competition (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.club(id) on delete cascade,
  managed_by_platform boolean not null default false,
  name text not null,
  competition_type text not null check (competition_type in ('Handicap', 'Scratch')),
  entry_closes_at date not null,
  rules text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Open', 'Drawn', 'In Progress', 'Complete')),
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (managed_by_platform = true or club_id is not null)
);

create table if not exists public.competition_round (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competition(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  name text not null,
  frames_to_play integer not null default 1 check (frames_to_play > 0 and frames_to_play <= 35),
  play_by_date date not null,
  unique (competition_id, round_number)
);

create table if not exists public.competition_entry (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competition(id) on delete cascade,
  club_membership_id uuid not null references public.club_membership(id) on delete cascade,
  entered_by uuid references public.person(id) on delete set null,
  entered_at timestamptz not null default now(),
  status text not null default 'Entered' check (status in ('Entered', 'Withdrawn')),
  unique (competition_id, club_membership_id)
);

create table if not exists public.competition_match (
  id uuid primary key default gen_random_uuid(),
  competition_round_id uuid not null references public.competition_round(id) on delete cascade,
  match_number integer not null check (match_number > 0),
  player_1_entry_id uuid references public.competition_entry(id) on delete set null,
  player_2_entry_id uuid references public.competition_entry(id) on delete set null,
  player_1_score integer check (player_1_score is null or player_1_score >= 0),
  player_2_score integer check (player_2_score is null or player_2_score >= 0),
  winner_entry_id uuid references public.competition_entry(id) on delete set null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Bye', 'Completed')),
  reported_by uuid references public.person(id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competition_round_id, match_number)
);

alter table public.club_admin enable row level security;
alter table public.competition enable row level security;
alter table public.competition_round enable row level security;
alter table public.competition_entry enable row level security;
alter table public.competition_match enable row level security;

drop policy if exists "members can read club admins" on public.club_admin;
create policy "members can read club admins" on public.club_admin for select to authenticated using (active = true);

drop policy if exists "operators can read all club admins" on public.club_admin;
create policy "operators can read all club admins" on public.club_admin for select to authenticated using (public.is_app_operator());

drop policy if exists "members can read competitions" on public.competition;
create policy "members can read competitions" on public.competition for select to authenticated using (true);

drop policy if exists "members can read competition rounds" on public.competition_round;
create policy "members can read competition rounds" on public.competition_round for select to authenticated using (true);

drop policy if exists "members can read competition entries" on public.competition_entry;
create policy "members can read competition entries" on public.competition_entry for select to authenticated using (true);

drop policy if exists "members can read competition matches" on public.competition_match;
create policy "members can read competition matches" on public.competition_match for select to authenticated using (true);

insert into public.club_admin (club_id, person_id, active)
select c.id, p.id, true
from public.club c
join public.person p on lower(p.email) = lower('garlyons@gmail.com')
where c.name = 'Castle Golf Club'
on conflict (club_id, person_id) do update
set active = true;
