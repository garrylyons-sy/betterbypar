-- Switch Interclub Snooker from Supabase Auth-managed login to app-managed login.
-- Run this after the base schema exists.

alter table public.user_account
  drop constraint if exists user_account_id_fkey;

alter table public.user_account
  alter column id set default gen_random_uuid();

alter table public.user_account
  add column if not exists password_hash text;

create table if not exists public.app_session (
  id text primary key,
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists app_session_user_account_id_idx on public.app_session (user_account_id);
create index if not exists app_session_expires_at_idx on public.app_session (expires_at);

comment on table public.app_session is 'App-owned login sessions. The browser stores only this id in an HTTP-only cookie; Supabase Auth is not used for application login.';

alter table public.app_session enable row level security;

drop policy if exists "no client session access" on public.app_session;
create policy "no client session access" on public.app_session
for all to authenticated using (false) with check (false);
