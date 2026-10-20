# Notifications and inbox schema

Updated 20 October 2026. The six notification tables below are deployed through `supabase/notifications.sql` and `supabase/notification_announcements.sql`. The editable ER diagram is `notification-inbox-schema.mmd`; the full architecture diagram is `../IC Snooker Database Schema.svg` with a PNG export alongside it. Regenerate both with `node scripts/render-schema-diagram.mjs`; the original overview is retained in `docs/schema-assets/database-overview.png`.

| Child column | Referenced key | Null allowed | On delete |
| --- | --- | --- | --- |
| `notification_config.updated_by` | `person.id` | Yes | SET NULL |
| `notification_preference.person_id` | `person.id` | No | CASCADE |
| `app_notification.person_id` | `person.id` | No | CASCADE |
| `notification_push_subscription.person_id` | `person.id` | No | CASCADE |
| `notification_push_delivery.notification_id` | `app_notification.id` | No | CASCADE |
| `notification_push_delivery.subscription_id` | `notification_push_subscription.id` | No | CASCADE |
| `notification_announcement.sender_person_id` | `person.id` | Yes | SET NULL |

Each person can have at most one preference row, any number of inbox items and device subscriptions, and any number of sent announcements. Each delivery belongs to exactly one inbox item and one device subscription. The configuration is one global singleton; its optional `updated_by` records the last editor.

Unique constraints prevent duplicate `(person_id, event_key)` inbox items, duplicate device `endpoint` values, and duplicate `(notification_id, subscription_id)` deliveries. The announcement primary key is also its idempotency/request ID.

Announcements link to per-person inbox items by the application convention `app_notification.event_key = 'announcement:' || notification_announcement.id`. **This is not a foreign key**; neither `audience` JSON nor `summary` JSON introduces foreign keys to clubs, teams or people.

All six tables have row-level security enabled and no `anon`/`authenticated` table grants. The application accesses them through authenticated server APIs. Device `p256dh` and `auth` hold subscription encryption material; the VAPID private key remains in server environment configuration, not these tables. Existing conversation/message tables are separate from this inbox.
