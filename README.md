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
pnpm dev
```

Open `http://localhost:3000`.

## Database

Apply [supabase/schema.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/schema.sql) to a Supabase project SQL editor or migration pipeline. The schema intentionally keeps roles on `team_membership`, not on `person`, so one person can be a player, manager or assistant manager across different teams and leagues.

Then apply [supabase/seed.sql](/Users/garrylyons/Documents/Interclub%20Snooker/supabase/seed.sql) to create the initial 2026/27 season, leagues, clubs and team entries.

Scoring is modelled at frame level. Each `game` row is one frame: singles frames award 1 league point to the winning team, and the doubles frame awards 2 league points. `league_table_view` calculates standings from those frame-level points through `match_points_view`.
