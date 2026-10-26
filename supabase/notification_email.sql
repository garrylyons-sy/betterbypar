begin;
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw','livestream','lesson_booking','lesson_reminder','lesson_cancelled','lesson_feedback'));
create table if not exists public.notification_email_delivery (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references public.app_notification(id) on delete cascade,
 status text not null default 'Pending' check(status in ('Pending','Sending','Sent','Skipped','Failed')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),locked_at timestamptz,sent_at timestamptz,last_error text,
 created_at timestamptz not null default now()
);
create index if not exists notification_email_due on public.notification_email_delivery(status,available_at);
alter table public.notification_email_delivery enable row level security;
revoke all on public.notification_email_delivery from public,anon,authenticated;
-- Existing preferences are normalized in code. This never opts anyone into email.
commit;
