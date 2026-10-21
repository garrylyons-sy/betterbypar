begin;
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check
 check (type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result'));
-- Keep historical rows, but retire all previous ladder deadline reminders.
update public.app_notification set expires_at=now()
 where type='ladder_challenge' and event_key like 'ladder:%:deadline:%'
 and (expires_at is null or expires_at>now());
commit;
