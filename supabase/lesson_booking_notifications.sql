-- Apply after lesson_diary.sql and notifications.sql.
begin;
alter table public.app_notification add column if not exists opened_at timestamptz;
alter table public.lesson_booking add column reminder_person_id uuid references public.person(id);
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw','livestream','lesson_booking'));
-- Existing explicit preferences predate this category; make the new category available once.
update public.notification_config set config=jsonb_set(config,'{enabledTypes}',coalesce(config->'enabledTypes','[]'::jsonb)||'"lesson_booking"'::jsonb) where not coalesce(config->'enabledTypes','[]'::jsonb) ? 'lesson_booking';
update public.notification_preference set preferences=jsonb_set(preferences,'{inboxTypes}',coalesce(preferences->'inboxTypes','[]'::jsonb)||'"lesson_booking"'::jsonb) where not coalesce(preferences->'inboxTypes','[]'::jsonb) ? 'lesson_booking';
commit;
