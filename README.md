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

Without Supabase environment variables the app runs in demo mode. To enable real accounts, create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Enable Email/Password and Google in Supabase Auth. Set the local app URL during development and the production domain for live use:

```text
http://localhost:3500
https://www.interclubsnooker.com
```

## Google Login

The app uses Supabase Auth for Google login. The existing golf app credentials can be reused, but they must be entered in Supabase, not committed to this repo and not exposed as `NEXT_PUBLIC_*` secrets.

1. Open `/Users/garrylyons/Documents/Golf project/.env` locally.
2. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. In Supabase Dashboard, go to Authentication, Providers, Google.
4. Enable Google and paste the client ID and secret.
5. In Google Cloud Console, add the Supabase Google callback URL shown by Supabase. It normally looks like:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

6. In Supabase URL Configuration, set the production site URL and allow both local and production redirect URLs:

```text
https://www.interclubsnooker.com
http://localhost:3500
```

For production, set the Supabase **Site URL** to:

```text
https://www.interclubsnooker.com
```

After that, the app's `Continue with Google` button uses `supabase.auth.signInWithOAuth({ provider: "google" })` and returns the user to the app. When a Google email has one pending invitation, the app automatically claims that invitation and creates the linked player profile.

The seed data includes a real Castle A player invitation for:

```text
garlyons@gmail.com
```

That invite grants `Player` access to `Castle A` in `A League`.

## Database

Apply [supabase/schema.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/schema.sql) to a Supabase project SQL editor or migration pipeline. The schema intentionally keeps roles on `team_membership`, not on `person`, so one person can be a player, manager or assistant manager across different teams and leagues.

Then apply [supabase/seed.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/seed.sql) to create the initial 2026/27 season, leagues, clubs and team entries.

Historical imports live in separate SQL files so they can be applied deliberately:

- [supabase/a_league_2025_26_results.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_results.sql) imports A League 2025/26 team fixtures and match points.
- [supabase/a_league_2025_26_player_games.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_player_games.sql) imports A League 2025/26 player-v-player game results from `match results 25-26.xlsx`.

Historical player imports create `person.id` records for everyone who appears in match data. They do not create `user_account` rows. A person only gets login access after invitation acceptance or the approved registration flow links that person to a Supabase Auth user.

The account flow is invitation-only. Supabase Auth owns password and Google login, while application identity lives in:

- `person` for the human record
- `user_account` for username and Auth user linkage
- `team_membership` for Player, Manager and Assistant Manager roles
- `invitation_membership` for the team roles granted by an invite
- `invitation_request` for public player-only invite requests
- `user_activity_log` for login and page-visit audit events

Use `accept_invitation_for_current_user(invitation_code_input, username_input)` after a user signs up or returns from Google OAuth with a code. Use `accept_pending_invitation_for_current_user(username_input)` for Google users who match one pending invite by email. Seed data includes Garry Lyons as a Castle A player, example Castle A player access and a dual role where one person is Player in Castle A and Manager in Castle B.

The public home page supports three paths:

- Standard login for existing users
- Account activation for users with an invitation code
- Player invite requests where a person enters their name, email, club and team

Invite requests are always for the `Player` role. Manager and assistant manager access is deliberately excluded from the public request form and should be created through backend membership management.

Admin access is separate from player and manager roles. Player and manager control is handled through membership data, especially `team_membership`, `invitation_membership`, `invitation_request` and `membership_management_view`.

The private admin console is available at `/admin`. To grant the first operator, sign in once, find the linked `person.id`, then insert it into `app_operator` from the Supabase SQL editor:

```sql
insert into public.app_operator (person_id)
values ('person-uuid-here');
```

The admin console can create invitation codes, attach Player/Manager/Assistant Manager permissions to teams, and view `user_activity_log`.

When Supabase is configured, the app records login events through `record_user_login(...)` and dashboard visits through `record_page_visit(...)`. Users can read their own activity rows; backend service access can review the complete audit log.

Scoring is modelled at frame level. Each `game` row is one frame: singles frames award 1 league point to the winning team, and the doubles frame awards 2 league points. `league_table_view` calculates standings from those frame-level points through `match_points_view`. Historical aggregate imports can store only `match.home_team_score` and `match.away_team_score`; `match_points_view` falls back to those totals until frame-level detail is added.

Apply [supabase/a_league_2025_26_results.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/a_league_2025_26_results.sql) to import last season's A League regular-season results from `Snooker A League 25-26.xlsx`. The two semi-finals and final are intentionally excluded.
