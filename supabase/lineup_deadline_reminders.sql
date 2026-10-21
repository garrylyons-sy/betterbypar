begin;
alter table public.fixture add column if not exists notification_schedule_revision bigint not null default 0;
-- Retire ordinary match reminders and initialise the configurable publication target.
update public.notification_config set config=jsonb_set(
 config || jsonb_build_object('lineupDeadlineHours',coalesce(config->'lineupDeadlineHours','2'::jsonb)),
 '{enabledTypes}',coalesce((select jsonb_agg(value) from jsonb_array_elements_text(config->'enabledTypes') where value <> 'match_reminder'),'[]'::jsonb)
),updated_at=now() where singleton=true;
-- Retain history, but hide obsolete timing/copy and stop old pending phone alerts.
update public.app_notification set expires_at=now()
 where (type='match_reminder' or (type='lineup_reminder' and event_key not like '%:team:%:deadline:%'))
 and (expires_at is null or expires_at>now());
commit;
