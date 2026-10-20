# Notifications Implementation Plan

**Goal:** Role-gated notification inbox, preferences, four automatic types, optional Web Push.
**Architecture:** Postgres storage and transactional event creation, Next API endpoints, CRON_SECRET worker, client notification center and admin settings.
**Spec:** docs/superpowers/specs/2026-10-20-notifications-design.md

## Shared contracts
- lib/notification-policy.mjs + .d.mts exports notificationTypes ['fixture_change','match_reminder','lineup_reminder','ladder_challenge'], notificationRoles, defaultNotificationConfig, normalize/validateNotificationConfig, defaultNotificationPreferences, normalize/validateNotificationPreferences, isNotificationEligible(roles,config), canDeliverPush(notification,preferences,config,roles,now), isQuietTime(now,config), safeNotificationHref(href). UI may import these. Type declarations Config/Preferences.
- Config shape: {enabled:boolean, eligibleRoles:string[], enabledTypes:NotificationType[], matchReminderHours:number(default24), lineupReminderHours:number(default4), ladderReminderHours:number(default24), quietStart:string(default22:00), quietEnd:string(default08:00)}. Reminder hours integer 1..168. Quiet hours Europe/Dublin; equal endpoints means disabled.
- Preferences {inboxTypes:NotificationType[] (all),pushTypes:NotificationType[] (all),pushEnabled:boolean(false)}.
- lib/server/notifications.ts exports loadNotificationConfig(), saveNotificationConfig(input,personId), notificationAccess(personId): Promise<{eligible:boolean,roles:string[],config:Config,preferences:Preferences}>, loadNotificationInbox(personId), saveNotificationPreferences(personId,input), markNotificationsRead(personId,id?:string), processNotificationReminders(). Core may add exports.
- GET /api/notifications -> {eligible:boolean, items:[{id,type,title,body,href,createdAt,readAt}],unreadCount:number,preferences,config}. For noneligible return {eligible:false,items:[],unreadCount:0} no details. PATCH /api/notifications body {id:string} OR {all:true}. Auth currentUser() only, no testUser bypass. GET/PATCH /api/notifications/preferences; PATCH full prefs object -> {preferences}. Auth+eligible 403.
- public.notification singleton row NOT used. Tables app_notification(id uuid,person_id,type,title,body,href,event_key,created_at,read_at,expires_at), notification_preference(person_id,preferences jsonb,updated_at), notification_config(singleton,config jsonb,updated_by,updated_at), notification_push_subscription(id uuid,person_id,endpoint unique,p256dh,auth,active,created_at,updated_at), notification_push_delivery(id uuid,notification_id,subscription_id,status ['Pending','Sending','Sent','Failed','Skipped'],attempts int default0,available_at defaultnow,locked_at,sent_at,last_error,unique(notification_id,subscription_id)). Notification creation also queues per active subscriptions when prefs pushEnabled+type enabled; subscription creation queues no old items.
- Push agent owns lib/server/notification-push.ts exporting pushReadiness() -> {ready:boolean,publicKey:string|null}, processNotificationPush() -> stats. GET /api/notifications/push -> {ready,publicKey,subscribed:boolean}; POST {subscription:PushSubscriptionJSON} opts in device; DELETE {endpoint} unsubscribes device. Use notificationAccess. Test endpoint /api/notifications/push/test POST may queue self-only test message (no global send), authenticated eligible.
- Root owns app/api/admin/notifications/route.ts GET/PATCH -> {config,push:{ready,publicKey},stats?}; UI uses it. Root owns components/admin-notifications.tsx and AdminSystem integration. Root owns app/api/cron/notifications/route.ts invoking reminders then push. Push agent may create cron route but coordinate.

## Tasks
- [x] Core: policy tests first, schema, access/settings/inbox API, transactional events and due reminders; no retroactive challenge/fixture notifications.
- [x] Push: install web-push and typings, secure subscription endpoints, queue worker, sw.js push and click, tests.
- [x] UI: notification center bell + inbox + preferences under Account; follow same-origin deep links, visible-only refresh, push UX.
- [x] Admin: notification controls under System, VAPID readiness, initial League Chair audience and category/reminder/quiet-hour controls.
- [x] Integrate: migration, cron scheduler, environment examples/docs; full tests/typecheck/build, review auth/duplicates/retries/preferences and pilot role gating.

Verified full suite, production build, rollback-only database integration and auth401 smoke tests. User/admin visuals checked using temporary sample-data route, removed afterwards. No real push sent. VAPID keys remain deployment configuration, unconfigured locally.
