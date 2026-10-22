begin;
alter table public.match_livestream add column if not exists viewers_notified_at timestamptz;
alter table public.match_livestream add column if not exists viewers_notified_count integer not null default 0 check(viewers_notified_count>=0);
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check
 check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw','livestream'));
comment on column public.match_livestream.viewers_notified_at is 'One-time transactional fanout to current Viewing-permission holders, using Announcement preferences.';
commit;
