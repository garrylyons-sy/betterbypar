-- Enable Row Level Security on public tables that were added after the
-- original schema hardening pass. The app uses server-side database access,
-- so no broad anon/authenticated policies are required here.

alter table if exists public.appearance enable row level security;
alter table if exists public.fixture_lineup enable row level security;
alter table if exists public.fixture_lineup_slot enable row level security;
alter table if exists public.fixture_week enable row level security;
alter table if exists public.fixture_week_match enable row level security;
alter table if exists public.invitation_club_membership enable row level security;
alter table if exists public.invitation_email enable row level security;
alter table if exists public.password_reset_token enable row level security;
