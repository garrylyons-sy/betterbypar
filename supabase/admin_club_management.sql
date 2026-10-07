alter table public.club
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists club_name_case_insensitive_idx
  on public.club (lower(name));
