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

**Admin → System → Notifications** controls the rollout. Notifications are enabled initially for **League Chair only**, based on current active server-side role assignments. Other users have no inbox or notification settings until their role is selected. Disable the feature, select no roles, or deselect a person's eligible role to block inbox access and subsequent phone delivery. Role selection controls eligibility; notifications still go only to relevant recipients. League Chairs receive league-wide fixture and missing-lineup oversight. Ladder alerts go only to the players involved, including during the pilot.

Eligible users get a header bell with unread count and **Account → Notification settings**. Inbox and phone categories are independent. Phone push is off by default; it needs an account opt-in, a device subscription, and browser permission requested by the user. iPhone/iPad users add the app to their Home Screen and enable it there. Logging out unsubscribes that browser and closes displayed notifications; other devices keep their subscriptions.

The first release includes fixture date/time/status/team/venue changes, upcoming fixture reminders, missing-lineup reminders, and ladder challenge/response/deadline alerts. Reminders use Europe/Dublin time; date-only fixture rows mean a 19:30 kickoff. The default reminders are 24 hours before a match, four hours before a missing lineup, and 24 hours before a ladder deadline. Admins can change these and the default 22:00–08:00 Dublin quiet hours. Quiet hours affect phone delivery, not inbox creation. Completed/cancelled/rescheduled sources and published lineups are checked before delivery; expired items are removed from the active inbox. Duplicate events are suppressed.

Apply `supabase/notifications.sql` to each database before deploying. It creates the config, inbox, preferences, subscriptions, and durable push queue with RLS and no client database-role access. App APIs authenticate the real session and never accept the demo `testUser` shortcut.

For optional phone push:

1. Generate one stable key pair with `pnpm exec web-push generate-vapid-keys`.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` contact or HTTPS URL) in local/deployment environment variables. Keep the private key server-only and retain the same key pair across deploys.
3. Set `CRON_SECRET` for `/api/cron/notifications`. The deployment configuration follows the existing Hobby-compatible pattern of 24 daily jobs distributed across the day. Reminders, quiet-hour release, and retries run approximately hourly; scheduling precision depends on the hosting plan. [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
4. Fixture/challenge changes and self-test pushes also trigger delivery after the HTTP response. The durable worker drains bounded concurrent batches, retries transient failures, and removes expired subscriptions. Inbox creation does not depend on push provider availability.
5. Verify **Phone push: Configured** under Admin → System, opt in from an eligible real account, enable that device, save preferences, and use **Send test notification**. No actual phone pushes are sent by the automated test suite.

Without VAPID settings, the inbox and preferences work and the UI explains that phone push is not configured. The feature does not send notification emails or announcements in this release. No existing notifications are backfilled on rollout; scheduled reminders are generated only for future fixtures/deadlines currently inside their configured reminder window.

`node --test test/*.test.mjs` checks policy, role isolation, reminders, source freshness, subscriptions, queue retries/concurrency, service worker behavior, and UI wiring. With Node 24+, `node scripts/verify-notifications.mjs` verifies the real database schema, pilot eligibility, deduplication, and opt-in inside a transaction that rolls back all test writes and sends no pushes. That verification deliberately asserts the initial League Chair-only pilot and should only be run while those rollout settings remain selected.
