-- Provisional draws are private admin records; no ties/fixtures exist until confirmation.
create table if not exists public.cup_draw_attempt (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.cup_competition(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'Provisional' check (status in ('Provisional','Superseded','Confirmed')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  revealed_count integer not null default 0 check (revealed_count >= 0),
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  witness_name text check (length(witness_name) between 1 and 120),
  confirmed_by uuid references public.person(id) on delete set null,
  confirmed_at timestamptz,
  redraw_reason text check (length(redraw_reason) between 1 and 500),
  superseded_by uuid references public.person(id) on delete set null,
  superseded_at timestamptz,
  unique (competition_id, attempt_number),
  check (status <> 'Confirmed' or (witness_name is not null and confirmed_at is not null)),
  check (status <> 'Superseded' or (redraw_reason is not null and superseded_at is not null))
);
create unique index if not exists cup_draw_one_provisional on public.cup_draw_attempt(competition_id) where status = 'Provisional';
create unique index if not exists cup_draw_one_confirmed on public.cup_draw_attempt(competition_id) where status = 'Confirmed';
alter table public.cup_draw_attempt enable row level security;
revoke all on public.cup_draw_attempt from anon, authenticated;
comment on table public.cup_draw_attempt is 'Saved cup draw snapshots and audit history. Server-only; fixtures are materialized only on confirmation.';
