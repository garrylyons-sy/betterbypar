begin;
alter table public.app_notification add column if not exists opened_at timestamptz;
comment on column public.app_notification.opened_at is 'First acknowledgement after the recipient displayed the specific announcement message. Separate from manually marking read.';
-- Pending pushes use the current saved href; already-delivered phone banners
-- retain the payload originally sent to the device.
update public.app_notification
set href='/?notifications=1&message='||substring(event_key from 14)
where type='announcement' and href='/?notifications=1'
  and event_key ~ '^announcement:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
-- Preserve existing read receipts independently of recipient account deletion.
update public.notification_announcement a
set recipients=(
 select coalesce(jsonb_agg(case when n.id is not null then recipient||jsonb_build_object(
   'readAt',coalesce(n.read_at,(recipient->>'readAt')::timestamptz),
   'openedAt',coalesce(n.opened_at,(recipient->>'openedAt')::timestamptz))
   else recipient end order by ordinal),'[]'::jsonb)
 from jsonb_array_elements(a.recipients) with ordinality as r(recipient,ordinal)
 left join public.app_notification n on n.person_id=(recipient->>'personId')::uuid
   and n.event_key='announcement:'||a.id::text and n.type='announcement'
)
where a.recipients is not null and exists(
 select 1 from public.app_notification n where n.event_key='announcement:'||a.id::text
   and n.type='announcement' and (n.read_at is not null or n.opened_at is not null)
);
commit;
