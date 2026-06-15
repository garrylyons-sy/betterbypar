# Club Competitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add club competition setup, entry, draw, and result recording without affecting interclub league tables.

**Architecture:** Add club-scoped competition tables, a `club_admin` permission, member/admin API routes, and a `Competitions` app page. Competitions use club membership and handicaps; league fixtures and stats remain untouched.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL/Supabase, existing Tailwind/ShadCN-style components.

---

### Task 1: Database

**Files:**
- Create: `supabase/club_competitions.sql`
- Modify: `supabase/schema.sql`

- [ ] Add `club_admin`, `competition`, `competition_round`, `competition_entry`, and `competition_match`.
- [ ] Include `competition_type` and status checks.
- [ ] Keep `club_id` nullable for future platform/interclub competitions.

### Task 2: APIs

**Files:**
- Create: `app/api/competitions/route.ts`
- Create: `app/api/competitions/[id]/route.ts`
- Create: `app/api/competitions/[id]/entries/route.ts`
- Create: `app/api/competitions/[id]/draw/route.ts`
- Create: `app/api/competitions/[id]/matches/[matchId]/route.ts`

- [ ] Members can list and enter competitions for their clubs.
- [ ] Club admins can create competitions, add entrants, run a knockout draw, and enter results.
- [ ] Players can submit results only for their own competition match.

### Task 3: Admin

**Files:**
- Modify: `components/admin-console.tsx`
- Modify: `app/api/admin/route.ts`
- Modify: `app/api/admin/permissions/route.ts`

- [ ] Add a `club_admin` permission table and expose club-admin status.
- [ ] Add a Competitions admin tab for platform admins to create club competitions and run draws.
- [ ] Add permission controls to grant club admin rights.

### Task 4: Main App UX

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/appearance.ts`
- Modify: `components/app-shell.tsx`

- [ ] Add `Competitions` menu item.
- [ ] Add appearance panels for open competitions, my matches, draws, and club admin.
- [ ] Add a competition page with cards for entries, draw, rounds, and score entry.

### Task 5: Verify

- [ ] Apply SQL to Supabase.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Commit and push.
