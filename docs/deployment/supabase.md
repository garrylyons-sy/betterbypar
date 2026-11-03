# Connect Better By Par to Supabase

Better By Par uses the same arrangement as Interclub Snooker: the Next.js server owns authentication, permissions and database access; Supabase hosts PostgreSQL. The website and Expo app call that same server. Supabase Auth, anonymous API keys and service-role keys are not required for the current app-managed login flow. Never copy the snooker database connection or credentials.

## 1. Create a separate project

Create an empty Supabase project for Better By Par. In its **Connect** panel choose **Session pooler** (port 5432), which works with IPv4 networks and this persistent Node server. See [Supabase's connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres). Keep its database password in your local secret configuration, not Git or chat.

Copy `.env.example` to `.env.local` and set:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres
LOCAL_DEMO=0
NEXT_PUBLIC_APP_URL=http://YOUR_COMPUTER_LAN_IP:3500
```

Copy the actual pooler hostname from Connect. URL-encode reserved characters in the password. The project HTTPS API URL alone is not a database connection string. For a hosted website set `NEXT_PUBLIC_APP_URL` to its HTTPS origin instead.

## 2. Install the schema

Run `npm run db:prepare`. This creates `supabase/install.generated.sql`, a reviewable installation containing the 17 required migrations in dependency order: core/app authentication, club settings, golf appointments and dependants, lesson diary/groups/privacy, notifications/email preferences, player registrations, rounds, practice, coaching discussion, native sessions and the course catalogue.

Open the **new project's** SQL Editor, paste that generated SQL and run it. Alternatively, after verifying `.env.local` points to the intended new project, run:

```sh
npm run db:apply -- supabase/install.generated.sql
npm run db:check
```

The installer refuses an existing application database. It is a one-time clean installation, not an upgrade runner. Individual migrations contain transaction boundaries: if interrupted partway through, do not rerun over the partial installation; inspect the error and restore a clean project before retrying. The generated file is reproducible and ignored by Git.

Only published course reference data is seeded: Castle, Grange and Milltown. There are no fictional people, clubs/memberships, lessons, demo passwords or snooker result imports. Existing local demo data remains in the separate PGlite demo database.

`db:check` performs read-only checks, prints the project reference and installed catalogue counts, and never prints the connection string or password.

## 3. Activate the first administrator

In the new project's SQL Editor, replace the email, name and app origin below, then run once. The returned one-time activation URL is a secret; open it privately to set your own password. This grants platform administration only, without assigning a player role or inventing a Golf Ireland number. No email is sent by this SQL.

```sql
with setup as (
 select encode(gen_random_bytes(32),'hex') as token
), invitation as (
 insert into public.invitation (
  email,invitation_code,invitation_token_hash,invited_person_name,
  invited_role,invite_administrator,expires_at
 )
 select 'YOUR_EMAIL','SETUP-'||encode(gen_random_bytes(8),'hex'),
  encode(digest(token,'sha256'),'hex'),'YOUR_NAME','Player',true,
  now()+interval '24 hours'
 from setup returning id
)
select 'http://YOUR_COMPUTER_LAN_IP:3500/activate?token='||setup.token as activation_url
from setup cross join invitation;
```

Use the actual backend URL and your own identity. After activation, `/admin` lets you create clubs, configure colours, appoint administrators/professionals, and invite real users. Coaching staff are not automatically players.

## 4. Start the live-backed server

Stop the local demo process only after configuration and database checks succeed. Then run:

```sh
npm run dev -- --hostname 0.0.0.0 --port 3500
```

Use `dev`, not `demo:local`: the latter deliberately overrides database settings and external delivery credentials to isolate the fictional demo. Ordinary dev uses `.env.local` and the Supabase connection.

Keep `mobile/.env.local` pointing `EXPO_PUBLIC_API_URL` at this same server's LAN origin while testing on the phone. Restart Metro after changing that value. Do not put database credentials into the mobile app. Both clients now read and write the same Supabase data through the server. The computer must stay running during local testing. For independent phone access later, deploy the same Next.js backend and point the native app at its HTTPS URL.

Email invitations/reminders need a verified sender domain and `RESEND_API_KEY`/`INVITE_FROM_EMAIL`; Google login needs this project's OAuth configuration. Password activation/login works without Google OAuth. Golf Ireland remains explicitly labelled demo data until club API credentials are configured. AI feedback remains off until its server credentials and consent flow are enabled. None of these external services is enabled by the database installer.

Verify after activation: log in on web/native, add a club with the required appointments, invite a player, save a course-backed round, book a lesson, then confirm both clients see those same records.
