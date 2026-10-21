begin;
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check
 check (type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw'));
alter table public.cup_draw_attempt add column if not exists notification_audience text[] not null default '{}'
 check (notification_audience <@ array['chairs','admins','managers','players']::text[]);
alter table public.cup_draw_attempt add column if not exists notification_summary jsonb;
comment on column public.cup_draw_attempt.notification_audience is 'Optional groups selected on confirmation. Empty means no notification. Original selection retained for audit.';
commit;
