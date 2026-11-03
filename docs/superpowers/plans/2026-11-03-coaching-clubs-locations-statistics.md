# Coaching clubs, locations and statistics implementation plan

**Goal:** One home club per player, expandable professional player lists, club-managed lesson locations and accurate lesson totals.

**Architecture:** A nullable person.player_club_id becomes the authoritative home club for player eligibility, retaining historical memberships and distinct administrative access. Lesson locations are club-owned records; slots reference a location, shared by all group attendees. Existing lessons without a location remain to be confirmed. Counts use non-cancelled, active sessions ending in the past; coach totals count sessions, player totals count attended bookings. Europe/Dublin determines month/year boundaries.

**Tech stack:** PostgreSQL/Supabase, Next.js, React Native/Expo; shared contracts.

- [x] Add idempotent migration and database tests for home club, location scope and seeded options.
- [x] Update player registration/admin forms, enforce eligibility centrally, expose home club.
- [x] Add authorized club location configuration; booking and group flows select locations and display them in both clients.
- [x] Extend coaching overview with player lesson totals and own/assistant month/year statistics; enforce assistant visibility server-side.
- [x] Replace web/native player cards with accessible accordions; show stats on dashboards and player rows.
- [x] Run meaningful DB/API tests, full suite, both TypeScript checks, native lint; visually verify web; apply migration and deploy website. No phone installation or git commit.

## Added scope: shared club groups

Groups created by any club professional, assistant or club administrator are shared club resources. Staff can manage rosters, group sessions and bookings. Each session keeps an active assigned coach; feedback remains attributable to that coach. Reject other clubs and revoked grants. Add DB validation migration, fresh staff access guard, web/native discovery and integration tests.
