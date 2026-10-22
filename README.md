# Interclub Snooker

Mobile-first league management platform for amateur interclub snooker.

## What is included

- Next.js, TypeScript and Tailwind CSS app scaffold
- ShadCN-style local UI primitives
- Premium dark sports dashboard with splash screen
- Role-aware player and manager home views
- Team context switcher for multi-role people
- League table qualification highlighting
- Supabase/PostgreSQL schema with invitations, membership-based roles, fixtures, matches, games, breaks, messaging, computed views and starter RLS policies

## Run locally

```bash
pnpm install
pnpm dev -- -p 3500
```

Open `http://localhost:3500`.

To enable real accounts, create `.env.local`:

```bash
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3500/auth/google/callback
SESSION_SECRET=replace-with-a-long-random-string
CRON_SECRET=replace-with-a-different-long-random-string
```

The app owns login sessions directly and uses Supabase/Postgres as the database. Supabase Auth providers are not used for application sign-in.

## Google Login

The app handles Google OAuth directly, like the golf app. The existing golf app credentials can be reused, but they must be entered in Vercel/local environment variables, not in Supabase Auth.

1. Open `/Users/garrylyons/Documents/Golf project/.env` locally.
2. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. Add the app callback URLs in Google Cloud Console:

```text
http://localhost:3500/auth/google/callback
https://www.interclubsnooker.com/auth/google/callback
```

4. In Vercel, set:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://www.interclubsnooker.com/auth/google/callback
SESSION_SECRET
CRON_SECRET
DATABASE_URL
```

After that, the app's `Continue with Google` button redirects to `/auth/google`, the app exchanges the Google code itself, sets an HTTP-only app session cookie, and uses Supabase/Postgres only for data storage. When a Google email has one pending invitation, the app automatically claims that invitation and creates the linked player profile.

The seed data includes a real Castle A player invitation for:

```text
garlyons@gmail.com
```

That invite grants `Player` access to `Castle A` in `A League`.

## Database

Apply [supabase/schema.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/schema.sql) to a Supabase project SQL editor or migration pipeline. The schema intentionally keeps roles on membership tables, not on `person`, so one person can be a player or manager across different teams and leagues.

Then apply [supabase/seed.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/seed.sql) to create the initial 2026/27 season, leagues, clubs and team entries.

If upgrading an existing database that was created while Supabase Auth was still the login layer, apply [supabase/app_managed_auth_migration.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/app_managed_auth_migration.sql) before testing app-owned login.

Apply [supabase/table_bookings.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/table_bookings.sql) to add Castle table booking support. It creates `club_table`, `table_booking`, the Castle Table 1/Table 2 seed rows and the unique active slot constraint.

Historical imports live in separate SQL files so they can be applied deliberately:

- [supabase/a_league_2025_26_results.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_results.sql) imports A League 2025/26 team fixtures and match points.
- [supabase/a_league_2025_26_player_games.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_player_games.sql) imports A League 2025/26 player-v-player game results from `match results 25-26.xlsx`.

Historical player imports create `person.id` records for everyone who appears in match data. They do not create `user_account` rows. A person only gets login access after invitation acceptance or the approved registration flow links that person to an app-owned login account.

The account flow is invitation-only. The Interclub Snooker app owns password and Google login, while application identity lives in:

- `person` for the human record
- `user_account` for username, password hash and Google ID linkage
- `team_membership` for Player and Manager roles
- `invitation_membership` for the team roles granted by an invite
- `invitation_request` for public player-only invite requests
- `user_activity_log` for login and page-visit audit events

The app-owned API routes create or link `user_account` rows after a valid invitation match. Seed data includes Garry Lyons as a Castle A player, example Castle A player access and a dual role where one person is Player in Castle A and Manager in Castle B.

The public home page supports three paths:

- Standard login for existing users
- Account activation for users with an invitation code
- Player invite requests where a person enters their name, email, club and team

Invite requests are always for the `Player` role. Manager access is deliberately excluded from the public request form and should be created through backend membership management.

Admin access is separate from player and manager roles. Player and manager control is handled through membership data, especially `team_membership`, `invitation_membership`, `invitation_request` and `membership_management_view`.

The private admin console is available at `/admin`. To grant the first operator, sign in once, find the linked `person.id`, then insert it into `app_operator` from the Supabase SQL editor:

```sql
insert into public.app_operator (person_id)
values ('person-uuid-here');
```

The admin console can create invitation codes, attach Player/Manager permissions to teams, and view `user_activity_log`.

When the database is configured, the app records login events and dashboard visits in `user_activity_log`. Users can read their own activity rows; backend service access can review the complete audit log.

Scoring is modelled at frame level. Each `game` row is one frame: singles frames award 1 league point to the winning team, and the doubles frame awards 2 league points. `league_table_view` calculates standings from those frame-level points through `match_points_view`. Historical aggregate imports can store only `match.home_team_score` and `match.away_team_score`; `match_points_view` falls back to those totals until frame-level detail is added.

Apply [supabase/a_league_2025_26_results.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_results.sql) to import last season's A League regular-season results from `Snooker A League 25-26.xlsx`. The two semi-finals and final are intentionally excluded.

### System settings

Platform administrators can open **Admin → System** to configure fixture and manager-lineup polling, live scoring refresh intervals, and the match-night polling window. Values are validated server-side and stored globally in `public.system_settings`; apply `supabase/system_settings.sql` when provisioning a database. The table is not exposed to client database roles; the app provides only the non-secret polling values through `/api/system-settings`, and saves require platform administrator access.

Current intervals remain the defaults. Save changes to apply them on the current device; reload other open devices to pick them up. Restore defaults fills the form and requires Save settings to persist. Polling pauses in background tabs, and fixture polling skips completed matches. Match-night times follow each device's local clock; windows crossing midnight continue tracking the previous evening's fixtures. Live scorer refresh is limited to 30 seconds to stay below the 45-second scorer lease.


### Notifications (League Chair pilot)

**Admin → Notifications** controls the rollout. Notifications are enabled initially for **League Chair only**, based on current active server-side role assignments. Other users have no inbox or notification settings until their role is selected. Disable the feature, select no roles, or deselect a person's eligible role to block inbox access and subsequent phone delivery. Role selection controls eligibility; notifications still go only to relevant recipients. League Chairs receive league-wide fixture and missing-lineup oversight. Ladder alerts go only to the players involved, including during the pilot.

Eligible users get a header bell with unread count and **Account → Notification settings**. Inbox and phone categories are independent. Phone push is off by default; it needs an account opt-in, a device subscription, and browser permission requested by the user. iPhone/iPad users add the app to their Home Screen and enable it there. Logging out unsubscribes that browser and closes displayed notifications; other devices keep their subscriptions.

Notifications include fixture date/time/status/team/venue changes, optional team-publication deadline reminders, named ladder challenges/responses, opponent lineup publication, confirmed cup draws and League Chair final results. Ordinary match reminders and ladder deadline reminders are disabled. Publication reminders target one hour before the configured deadline (default: two hours before kickoff) and only reach managers of still-unpublished teams. Reminders use Europe/Dublin time; date-only fixture rows mean a 19:30 kickoff. Admins can change the publication deadline and the default 22:00–08:00 Dublin quiet hours. Quiet hours affect phone delivery, not inbox creation. Completed/cancelled/rescheduled sources and published lineups are checked before delivery; expired items are removed from the active inbox. Duplicate events are suppressed.

Apply `supabase/notifications.sql` to each database before deploying. It creates the config, inbox, preferences, subscriptions, and durable push queue with RLS and no client database-role access. App APIs authenticate the real session and never accept the demo `testUser` shortcut.

For optional phone push:

1. Generate one stable key pair with `pnpm exec web-push generate-vapid-keys`.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` contact or HTTPS URL) in local/deployment environment variables. Keep the private key server-only and retain the same key pair across deploys.
3. Set `CRON_SECRET` for `/api/cron/notifications`. The deployment configuration follows the existing Hobby-compatible pattern of 24 daily jobs distributed across the day. Reminders, quiet-hour release, and retries run approximately hourly; scheduling precision depends on the hosting plan. [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
4. Fixture/challenge changes and self-test pushes also trigger delivery after the HTTP response. The durable worker drains bounded concurrent batches, retries transient failures, and removes expired subscriptions. Inbox creation does not depend on push provider availability.
5. Verify **Phone push: Configured** under Admin → Notifications → Notification settings, opt in from an eligible real account, enable that device, save preferences, and use **Send test notification**. No actual phone pushes are sent by the automated test suite.

Without VAPID settings, the inbox and preferences work and the UI explains that phone push is not configured. The feature does not send notification emails or announcements in this release. No existing notifications are backfilled on rollout; scheduled reminders are generated only for future fixtures/deadlines currently inside their configured reminder window.

`node --test test/*.test.mjs` checks policy, role isolation, reminders, source freshness, subscriptions, queue retries/concurrency, service worker behavior, and UI wiring. With Node 24+, `node scripts/verify-notifications.mjs` verifies the real database schema, pilot eligibility, deduplication, and opt-in inside a transaction that rolls back all test writes and sends no pushes. That verification deliberately asserts the initial League Chair-only pilot and should only be run while those rollout settings remain selected.

### Targeted announcement composer

Platform administrators can use **Admin → Notifications → Send an announcement** to write a title and message, select one or more roles, and optionally narrow the audience to a club or a team within that club. Multiple selected roles are combined; club/team filters narrow the selection. No roles selected means all roles within the chosen scope. Only active accounts and current-season team assignments are included, with each person counted once. Club-role filters require that role in the selected club; Player/Manager filters also require assignment to the selected team.

Use **Preview recipients** to see matching people, rollout exclusions, inbox recipients, phone-push recipients, and people with no enabled channel. The League Chair-only pilot remains enforced. To include other roles, explicitly enable those roles in the rollout settings first. Editing the message or audience invalidates its preview; changing recipient preferences or rollout settings before Send requires another preview. The explicit Send button creates inbox items and queues opted-in phone push transactionally. Repeat clicks or retrying a lost response do not create duplicate announcements. Sent history records the title, message, audience, recipient counts, sender, and time. Quiet hours and personal preferences still apply.

Apply `supabase/notification_announcements.sql` after the base notifications migration. Version 2 configuration enables the new Announcements category on upgrade and includes it in eligible users' inbox defaults. Phone push for this new category is off by default until recipients select **Announcements from administrators** in their notification settings; existing push opt-ins and choices are preserved. Deliberate category opt-outs made with the new settings remain saved.

`node scripts/verify-notification-announcements.mjs` checks the live schema and audience/send/idempotency SQL using a rolled-back transaction and a disabled push dispatcher. No test announcement is committed or sent.

Sent announcements are loaded on demand from **Admin → Notifications → Sent announcements**, with 10 summary rows per page. Expand a row to load its message body and audience details. Notification settings are a separate accordion loaded on first opening.

Recipient notifications disappear after the retention period configured in **Admin → Notifications → Notification settings → Keep notifications for (days)** (1–365 days, default 10), or earlier if their event expires. Changes apply to existing messages; increasing retention can restore older messages that have not otherwise expired. The inbox API filters old rows before returning messages and unread counts; open inboxes also remove ageing items locally. Old notifications cannot be delivered by push. Historical database rows and admin sent-announcement history are retained.

Apply `supabase/notification_event_updates.sql` after the announcements migration. This adds `lineup_published` and `match_result`, and expires existing ladder deadline reminders without deleting them. Ladder deadlines are no longer scheduled; challenge creation and responses still notify the players involved. Version 3 settings enable the new event categories and inbox defaults once; existing push category choices and role rollout are preserved. Managers must be included in the configured rollout to receive their alerts, and people can opt into the new phone push categories in their own settings.

Publication alerts are sent once per fixture/publishing team, only to the opposing team's active managers: **Opponents published** — “{team} have published their line up.” Saving drafts or editing an already-published lineup does not send another alert. League Chairs receive **Match completed** — “{home} {home score}–{away score} {away}. {league} result.” from manager or administrator completion. Rescheduling produces **Match rescheduled** with the teams and new date/time; ladder challenges identify the challenger and ladder, and accept/decline responses identify the opponent. Notification links open the relevant fixture, ladder challenge or exact result without reloading a running app. `node scripts/verify-notification-events.mjs` verifies real event SQL in a rolled-back transaction without dispatching push.

### Provisional cup draws

Apply `supabase/cup_provisional_draws.sql` before deploying this release (included in the consolidated schema). In Admin → Cup Competitions, review the entrants and round dates, run a provisional draw, then reveal one match at a time with the person overseeing it. Reveal progress is saved. Enter the witness's name and choose **Confirm and publish draw** to create the fixtures. The witness name is recorded by the organiser, not verified through a second account.

A redraw requires a reason and retains every previous attempt, its original entrant/round/pairing snapshot, organiser and timestamps. Admins can expand **Full draw history** and print a draw record. Provisional records are private to administrators, and no provisional fixtures or bracket ties are exposed in the calendar. Confirmation publishes exactly the saved bracket, including byes and later-round progression, in one transaction. Confirmed draws cannot be redrawn. Cups drawn before this release keep their fixtures and show that historical attempts were not recorded. History is retained for the lifetime of the cup; the existing permanent Delete competition action also removes its draw history.

Verification: `node --test test/cup-draw-workflow.test.mjs test/cup-draw-review.test.mjs` and `node scripts/verify-cup-draws.mjs` (real database checks with all changes rolled back).

### Optional cup draw notifications

Apply `supabase/cup_draw_notifications.sql` after `supabase/cup_provisional_draws.sql`. On **Confirm and publish draw**, optionally select League Chairs, Admins (active platform operators), Managers of teams in the competition, and/or Players on those teams. All choices start unchecked: selecting nobody publishes the cup without sending a notification. Provisional draws, reveals and redraws send nothing. Confirming queues one `cup_draw` event per eligible person, deduplicating overlapping roles. The full inbox message includes the cup name, first-round pairings/byes and round dates, and opens the person's inbox. The audience and delivery summary are retained in the draw history.

Manager/player audiences resolve to active assignments on entered teams in that cup's season, including legacy assignments. Club-wide membership alone is insufficient. Active accounts, global inbox access, the **Announcements** category, personal channel preferences, retention and quiet hours still apply. The confirmation screen shows current inbox access roles; expand them in **Admin → Notifications → Notification settings** if needed. General inbox and announcement selectors label the existing platform `Administrator` role as **Admins**. Club Admin remains a separate role. This release does not expand the live inbox rollout automatically.

Configuration/preferences upgrade to version 4, enabling the new inbox category once while preserving existing push opt-ins and later opt-outs. Confirmed cup draws use the existing **Announcements** inbox and phone-push preferences; there is no separate cup draw option. Large draws stay complete in the inbox; oversized phone payloads are shortened to a preview directing the recipient to the full draw. Notifications and device deliveries are inserted in the confirmation transaction; phone dispatch runs after commit. Existing confirmed cups are not notified retroactively. `scripts/verify-cup-draws.mjs` checks audience scope, active accounts, preferences, deduplication and the durable outbox without sending real push; all changes roll back.

Cup draws with byes display the preliminary matches separately and put each bye recipient directly into their next-round pairing. Later rounds identify the exact match winners feeding into them. For example, nine teams produce one preliminary match, seven byes and four explicit quarter-final pairings. Reveals show one preliminary match at a time, followed by one next-round pairing involving bye teams at a time. Existing provisional snapshots keep their saved preliminary order and gain the remaining pairing steps; confirmation stays unavailable until every pairing is revealed. This changes the presentation only: saved bracket slots, results and fixture progression retain their identities. Printed draw records and new notification messages use the same round-by-round layout.


### Team publication deadline reminders

Apply `supabase/lineup_deadline_reminders.sql` before deploying. In Admin → Notifications, enable **Unpublished team deadline reminder** and set **Teams must be published — hours before match** (0–168 hours; fractional hours supported, default 2). A 19:30 kickoff with a two-hour publication deadline means teams are due at 17:30 and the reminder targets 16:30. The worker checks approximately hourly, so delivery can be closer to the deadline. Personal preferences, global inbox role access and phone quiet hours still apply. This is a target publication time, not a new lock on saving or publishing late.

The message says: `You need to publish your team by {Dublin date/time}. {team} — {home} v {away}.` Only managers of the unpublished side are targeted; League Chair oversight alone does not receive this action reminder. Each team has its own event identity, expiry and fixture link. Publishing the team immediately expires its reminder, including for managers assigned to both sides. The reminder also expires at the deadline; config changes and fixture changes invalidate obsolete events. `fixture.notification_schedule_revision` makes A → B → A reschedules independent of whether fixture-change notifications are enabled or accepted. Existing ordinary match reminders and obsolete lineup reminders are retired without deleting records. Legacy hour keys/types remain readable for compatibility but no longer generate match alerts.

Verify with `node scripts/verify-lineup-reminders.mjs`: real SQL timing, per-team scope, duplicates, A → B → A with fixture alerts off, changed cutoffs, publication expiry, late suppression and optional disabling, with all writes rolled back and no real push sent.

Cup draw inbox cards use a short summary and an expandable **View draw** with grouped pairings and a compact later-round schedule. Existing saved draw messages receive the same presentation. The internal `cup_draw` event type remains for formatting, source checks and deduplication, while creation and phone delivery both use the `announcement` preference/config category. Legacy independent cup selections are ignored; Announcement opt-outs remain authoritative. No existing read messages are resent when this preference mapping changes.

### Publisher messaging

Apply `supabase/publishers.sql` before deploying this release (also included in `supabase/schema.sql`). It creates the RLS-protected `app_publisher` assignment table; it grants nobody the role automatically. Platform administrators assign or revoke **Publisher** in **Admin → People → Edit → Standalone roles**. Publisher is independent of clubs, teams and League Chair access and grants no admin permissions.

Publishers see **Send a message** on the core app home screen and under **More**, regardless of which of their normal team roles is selected. People with no club/team membership receive a standalone Publisher app context. Reload the app after changing the assignment. The API checks the real signed-in person's active Publisher assignment for options, previews and sends, including a permission recheck inside the send transaction.

The composer supports role groups, a club, a team within a club, or up to 100 individually selected people. Titles allow 120 characters; messages allow 2,000. Choose inbox, phone push or both. Sending checks the audience and sends in one action; duplicate taps and retries reuse the same request ID. Global inbox rollout, announcement preferences, device opt-in, retention and phone quiet hours still apply. Existing admin announcement history includes Publisher sends. Specific-person choices and delivery channels are stored with the announcement audience for safe retries and audit history.

Run `node scripts/verify-publisher-messaging.mjs` to verify role assignment, revocation, standalone session loading, exact recipient delivery, channel choices and idempotent retries against the database. It uses synthetic records inside one rolled-back transaction and disables real push dispatch.

Publisher **Send a message → Sent messages** shows only that person's own sends, with ten messages per page. Open a row to read its full text and view recipient names in pages of 25, with inbox/phone-push channel labels. Recipient names and selected channels are captured atomically at send time, independently of inbox dismissal/expiry and subsequent account changes. Phone-push labels describe the selected/queued channel, not confirmed receipt. Apply `supabase/publisher_message_history.sql` before deploying this history feature. Older sends use retained recipient records and display an explicit warning that deleted records or some channel details cannot be reconstructed.

### Specific messages and Publisher read/open status

Apply `supabase/notification_open_receipts.sql` before deploying. New announcement notifications link to `/?notifications=1&message=<announcement-id>`. The app opens a specific-message panel without reloading the mounted app; push-only recipients can open their own message even when it is absent from their inbox. Access requires the real recipient's current notification eligibility and an unexpired message within configured retention. Dismissed messages cannot be reopened through the link. Existing saved announcement links are upgraded; already-delivered phone banners keep their originally sent payload.

Fetching message contents does not create a receipt. A separate acknowledgement runs once the loaded message is displayed in a visible app window. `opened_at` stores the first such acknowledgement and also marks the message read. Publisher sent history displays **Opened**, otherwise **Marked read** for a read flag, otherwise **Unread**, with timestamps where available. These labels record app actions, not proof the text was read or understood. Previous opens cannot be reconstructed. Older read flags reflect the historic mark-read behavior, including bulk actions and older dismissal behavior. New dismissal no longer creates a read flag.

Read/open receipts are synchronized transactionally into the saved recipient snapshot so history survives inbox expiry/dismissal and recipient deletion. The migration also preserves existing read timestamps in snapshots. `scripts/verify-publisher-messaging.mjs` covers receiver-only access, push-only opens, unread/marked/opened transitions, repeated acknowledgements, expiry, deletion and durable historical receipts with synthetic data rolled back and real push dispatch disabled.
