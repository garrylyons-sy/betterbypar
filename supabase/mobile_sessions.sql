begin;
create table if not exists public.mobile_session (
 token_hash text primary key check(length(token_hash)=64),
 user_account_id uuid not null references public.user_account(id) on delete cascade,
 created_at timestamptz not null default now(),expires_at timestamptz not null
);
create index if not exists mobile_session_account_idx on public.mobile_session(user_account_id);
create table if not exists public.mobile_login_limit (
 identifier_hash text not null,window_start timestamptz not null,attempts integer not null default 1,
 primary key(identifier_hash,window_start)
);
alter table public.mobile_session enable row level security;
alter table public.mobile_login_limit enable row level security;
revoke all on public.mobile_session,public.mobile_login_limit from public,anon,authenticated;
-- A password reset or account/person suspension revokes native devices too.
create or replace function public.revoke_mobile_account_sessions() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='user_account' then
  if new.password_hash is distinct from old.password_hash or new.active is distinct from old.active then delete from mobile_session where user_account_id=new.id; end if;
 elsif new.active is distinct from old.active then
  delete from mobile_session where user_account_id in (select id from user_account where person_id=new.id);
 end if;
 return new;
end $$;
drop trigger if exists revoke_mobile_user_sessions on public.user_account;
create trigger revoke_mobile_user_sessions after update of password_hash,active on public.user_account for each row execute function public.revoke_mobile_account_sessions();
drop trigger if exists revoke_mobile_person_sessions on public.person;
create trigger revoke_mobile_person_sessions after update of active on public.person for each row execute function public.revoke_mobile_account_sessions();
revoke all on function public.revoke_mobile_account_sessions() from public,anon,authenticated;
commit;
