begin;
-- Extend the existing inbox without exposing it through client database roles.
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check
  check (type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement'));
create table if not exists public.notification_announcement (
  id uuid primary key,
  sender_person_id uuid references public.person(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  audience jsonb not null check (jsonb_typeof(audience) = 'object'),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists notification_announcement_created_idx on public.notification_announcement(created_at desc);
alter table public.notification_announcement enable row level security;
revoke all on public.notification_announcement from anon, authenticated;
commit;
