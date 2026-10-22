begin;
-- NULL distinguishes older messages from durable recipient snapshots on new sends.
alter table public.notification_announcement add column if not exists recipients jsonb
  check (recipients is null or jsonb_typeof(recipients)='array');
create index if not exists notification_announcement_sender_created_idx
  on public.notification_announcement(sender_person_id,created_at desc,id desc);
comment on column public.notification_announcement.recipients is 'Actual recipient names and selected inbox/push channels captured at send time. NULL for legacy sends; not affected by inbox expiry or dismissal.';
commit;
