begin;
create table if not exists public.mobile_google_attempt (
 id text primary key,
 challenge text not null check(length(challenge)=43),
 user_account_id uuid references public.user_account(id) on delete cascade,
 credential_snapshot text,
 code_hash text unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes'
);
create index if not exists mobile_google_expiry_idx on public.mobile_google_attempt(expires_at);
alter table public.mobile_google_attempt enable row level security;
revoke all on public.mobile_google_attempt from public,anon,authenticated;
commit;
