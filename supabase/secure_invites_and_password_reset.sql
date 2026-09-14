alter table public.invitation
  add column if not exists invitation_token_hash text unique,
  add column if not exists sent_at timestamptz;

comment on column public.invitation.invitation_token_hash is 'SHA-256 hash of the one-time activation token sent by email. The raw token is never stored.';
comment on column public.invitation.sent_at is 'When the invitation email was successfully sent by the application email provider.';

create table if not exists public.password_reset_token (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists password_reset_token_account_idx on public.password_reset_token(user_account_id, created_at desc);
create index if not exists password_reset_token_expires_idx on public.password_reset_token(expires_at);

comment on table public.password_reset_token is 'One-time password reset tokens. Only a hash is stored; the raw token exists only in the emailed reset link.';
