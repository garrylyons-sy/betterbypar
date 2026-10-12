# Last Man Standing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a database-backed Last Man Standing competition that League Chairs can enter and test, with editable two-player picks, deterministic automatic replacements, and settlement from official league frame results.

**Architecture:** Dedicated Last Man Standing tables hold competition, cycle, round, schedule, entry, pick, standings-snapshot, and immutable event state. Pure rule modules calculate tier eligibility, deadlines, replacement order, and outcomes; a transactional server service persists those decisions and is exposed through narrowly scoped participant and platform-admin APIs. The existing app shell receives a standalone League Chair page and home panel, while Admin receives a separate management section.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, PostgreSQL/Supabase, `pg`, Node test runner, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-12-last-man-standing-design.md`

## Global Constraints

- Pilot visibility and participant APIs are restricted to people with League Chair access.
- Platform administrators alone manage competitions, schedules, overrides, and settlement.
- Picks remain editable until 12:00 Europe/Dublin on the entrant's applicable match day.
- Player roles take priority over manager roles; C and D teams map to the C pool.
- Each entrant makes two distinct picks and cannot reuse a consumed player within a cycle.
- Typed guests and out-of-tier registered players are ineligible.
- Singles and doubles losses both eliminate an entrant.
- Automatic replacement order is deterministic, persisted, and based on a lock-time table snapshot.
- Multiple competitions and cycles may coexist without sharing picks or state.
- No scheduled job dependency is introduced in the pilot; processing is idempotent and request-triggered.
- Existing fixture, lineup, scoring, competition, and role behavior must remain unchanged.

## Review Focus

- A fixture moved after noon but before settlement must replace affected picks using the preserved round snapshot, never the later result; Task 3 tests this.
- Two concurrent requests at the deadline must create one effective pick per slot and consume each player once; Task 4 tests row-lock/idempotency behavior.
- A person with both player and manager roles must always derive selectable tiers from player roles only; Task 2 tests this.
- Different match dates inside one fixture week must produce entrant-specific noon deadlines; Task 2 tests this.
- A result correction after settlement must require explicit reopening and then rebuild derived statuses without erasing audit history; Task 4 tests this.

---

### Task 1: Add Last Man Standing persistence

**Files:**
- Create: `supabase/last_man_standing.sql`
- Modify: `supabase/schema.sql`
- Create: `test/last-man-standing-schema.test.mjs`

**Interfaces:**
- Consumes: existing `season`, `league`, `fixture_week`, `fixture`, `game`, `person`, `team`, and `user_activity_log` identifiers.
- Produces: tables `last_man_standing_competition`, `last_man_standing_round`, `last_man_standing_round_schedule`, `last_man_standing_entry`, `last_man_standing_pick`, `last_man_standing_team_order_snapshot`, and `last_man_standing_event` with the columns and constraints defined by the spec.

- [ ] **Step 1: Write failing schema tests**

Assert that the migration and canonical schema define all seven tables, status/audience/tier checks, unique entry and pick-slot constraints, foreign keys for fixture/game/player identity, indexes for active rounds and picks, immutable event storage, and row-level security that denies direct anonymous/authenticated writes.

- [ ] **Step 2: Run the schema test and verify RED**

Run: `node --test test/last-man-standing-schema.test.mjs`  
Expected: FAIL because the migration and table definitions do not exist.

- [ ] **Step 3: Implement the additive migration and canonical schema**

Use text checks rather than new PostgreSQL enum types so future states can be migrated without enum replacement. Store audience as `League Chair` or `Everyone`; entry tier as `A`, `B`, or `C`; pick slot as 1 or 2; timestamps as `timestamptz`; audit payload as `jsonb`.

- [ ] **Step 4: Run schema tests and the full suite**

Run: `node --test test/last-man-standing-schema.test.mjs && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 5: Commit**

```bash
git add supabase/last_man_standing.sql supabase/schema.sql test/last-man-standing-schema.test.mjs
git commit -m "Add Last Man Standing schema"
```

### Task 2: Implement pure eligibility, deadline, and fallback rules

**Files:**
- Create: `lib/last-man-standing-rules.mjs`
- Create: `lib/last-man-standing-rules.mjs.d.ts`
- Create: `test/last-man-standing-rules.test.mjs`

**Interfaces:**
- Consumes: normalized role rows, fixture dates, team standings, lineup slots, prior consumed player ids, and current time.
- Produces: `resolveEntryTierOptions(roles)`, `deadlineForEntry(input)`, `canEditPicks(input)`, `validateManualPicks(input)`, `orderedFallbackCandidates(input)`, and `outcomeForPickedPlayer(input)`.

- [ ] **Step 1: Write failing role and deadline tests**

Cover player-over-manager precedence, A/B/C/D mapping, multiple player-tier choices, manager-only choices, no-team-role rejection, Europe/Dublin noon before/equal/after behavior, daylight-saving boundaries, and entrant-specific dates within one fixture week.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/last-man-standing-rules.test.mjs`  
Expected: FAIL because the rules module does not exist.

- [ ] **Step 3: Implement tier and deadline functions**

Use `Intl.DateTimeFormat` with `Europe/Dublin`; do not compare noon by assuming UTC offset. Return stable validation codes alongside user-readable messages.

- [ ] **Step 4: Write failing pick, fallback, and outcome tests**

Cover duplicate picks, consumed players, inactive/typed-guest/out-of-tier players, own-team-first lineup order, second replacement continuation, table traversal and bottom wrap, skipped non-playing teams, no candidate, postponed fixtures, singles outcomes, doubles outcomes, and pending frames.

- [ ] **Step 5: Run focused tests and verify RED for the new cases**

Run: `node --test test/last-man-standing-rules.test.mjs`  
Expected: FAIL on unimplemented validation, fallback, and outcome functions.

- [ ] **Step 6: Implement validation, fallback, and outcome functions**

Keep every function deterministic and side-effect free. Return the chosen candidate plus source team, fixture, lineup slot, and automatic reason so persistence never has to reconstruct why a player was selected.

- [ ] **Step 7: Run focused tests and full suite**

Run: `node --test test/last-man-standing-rules.test.mjs && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add lib/last-man-standing-rules.mjs lib/last-man-standing-rules.mjs.d.ts test/last-man-standing-rules.test.mjs
git commit -m "Add Last Man Standing rules"
```

### Task 3: Build participant queries, entry, and pick APIs

**Files:**
- Create: `lib/server/last-man-standing.ts`
- Create: `app/api/last-man-standing/route.ts`
- Create: `app/api/last-man-standing/[competitionId]/route.ts`
- Create: `app/api/last-man-standing/[competitionId]/entries/route.ts`
- Create: `app/api/last-man-standing/[competitionId]/picks/route.ts`
- Create: `test/last-man-standing-api.test.mjs`

**Interfaces:**
- Consumes: Task 1 tables; Task 2 pure rules; `getSessionUser()` and existing League Chair context rules.
- Produces: `hasLastManStandingPilotAccess(personId)`, `listLastManStandingCompetitions(user)`, `loadLastManStandingCompetition(user, id)`, `enterLastManStandingCompetition(user, input)`, and `saveLastManStandingPicks(user, input)` plus the participant API routes.

- [ ] **Step 1: Write failing authorization and response-contract tests**

Assert that unauthenticated and ordinary roles receive 401/403, League Chairs can list pilot competitions, hidden audiences do not leak, concurrent competitions remain separate, current picks are private before each entrant's deadline, and response DTOs include panel and main-screen state.

- [ ] **Step 2: Run API tests and verify RED**

Run: `node --test test/last-man-standing-api.test.mjs`  
Expected: FAIL because participant service and routes do not exist.

- [ ] **Step 3: Implement read service and GET routes**

Return only active-audience competitions. Task 4 will add `processDueLastManStandingWork({ competitionId?, actorPersonId? })` to these reads once the real transactional processor exists; do not add a temporary production stub.

- [ ] **Step 4: Write failing entry and mutation tests**

Cover role-derived tier options, default highest player tier, fixed source team, duplicate entry rejection, version conflict, edits before noon, rejection exactly at noon, duplicate picks, consumed picks, and structured activity events for every saved change.

- [ ] **Step 5: Run API tests and verify RED for mutations**

Run: `node --test test/last-man-standing-api.test.mjs`  
Expected: FAIL on missing entry and pick mutations.

- [ ] **Step 6: Implement transactional entry and pick mutations**

Lock the entry/pick rows during mutation. Store pick revisions through immutable `last_man_standing_event` rows while retaining only the current selection in the pick row.

- [ ] **Step 7: Run API tests, typecheck, and full suite**

Run: `node --test test/last-man-standing-api.test.mjs && pnpm typecheck && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add lib/server/last-man-standing.ts app/api/last-man-standing test/last-man-standing-api.test.mjs
git commit -m "Add Last Man Standing participant API"
```

### Task 4: Implement locking, automatic picks, settlement, and reopening

**Files:**
- Modify: `lib/server/last-man-standing.ts`
- Create: `test/last-man-standing-processing.test.mjs`
- Modify: `app/api/manager/lineup/route.ts`
- Modify: `app/api/admin/matches/route.ts`
- Modify: `lib/server/live-scoring.ts`

**Interfaces:**
- Consumes: Task 2 fallback/outcome functions and Task 3 service records.
- Produces: `processDueLastManStandingWork(input)`, `lockLastManStandingRound(input)`, `settleLastManStandingRound(input)`, and `reopenLastManStandingRound(input)`.

- [ ] **Step 1: Write failing lock and replacement tests**

Cover two empty slots, selected player absent from a published lineup, fixture rescheduled before and after lock, preserved table order, no eligible candidate, deterministic event payloads, and two simultaneous processors producing one effective result.

- [ ] **Step 2: Run processing tests and verify RED**

Run: `node --test test/last-man-standing-processing.test.mjs`  
Expected: FAIL because processing functions do not exist.

- [ ] **Step 3: Implement transactional locking and automatic replacement**

Acquire a PostgreSQL advisory transaction lock keyed by competition and round, persist the team-order snapshot once, upsert exactly two pick rows, and emit one event for each state transition. Leave unresolved slots in `Needs Review` without eliminating the entrant.

- [ ] **Step 4: Write failing settlement and reopening tests**

Cover two wins, one loss, doubles loss, pending result, single winner, multiple survivors, deciding-round no-winner, fresh-cycle reinstatement and cleared used history, corrected-result reopening, and idempotent repeated settlement.

- [ ] **Step 5: Run processing tests and verify RED for settlement**

Run: `node --test test/last-man-standing-processing.test.mjs`  
Expected: FAIL on missing settlement/reopening behavior.

- [ ] **Step 6: Implement settlement, reopening, and result-save triggers**

Invoke due processing after manager, admin, and live-scoring result commits. Processing failures are logged and surfaced to Last Man Standing Admin but must not roll back or reject the official match result.

- [ ] **Step 7: Run processing tests and full suite**

Run: `node --test test/last-man-standing-processing.test.mjs && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add lib/server/last-man-standing.ts test/last-man-standing-processing.test.mjs app/api/manager/lineup/route.ts app/api/admin/matches/route.ts lib/server/live-scoring.ts
git commit -m "Process Last Man Standing rounds"
```

### Task 5: Add platform-admin competition management

**Files:**
- Create: `app/api/admin/last-man-standing/route.ts`
- Create: `app/api/admin/last-man-standing/[competitionId]/route.ts`
- Create: `app/api/admin/last-man-standing/[competitionId]/process/route.ts`
- Create: `app/api/admin/last-man-standing/[competitionId]/reopen/route.ts`
- Create: `components/admin-last-man-standing.tsx`
- Modify: `components/admin-console.tsx`
- Create: `test/admin-last-man-standing.test.mjs`

**Interfaces:**
- Consumes: Task 4 management and processing functions plus existing platform-admin authorization.
- Produces: CRUD/configuration endpoints and a lazy-loaded `AdminLastManStanding` section.

- [ ] **Step 1: Write failing admin authorization and CRUD tests**

Assert platform-only access; club admins and League Chairs receive 403; create/update validates season, entry window, audience, round sequence, all three tier schedule mappings, deciding round, and immutable fields once a round locks.

- [ ] **Step 2: Run admin tests and verify RED**

Run: `node --test test/admin-last-man-standing.test.mjs`  
Expected: FAIL because admin routes and navigation do not exist.

- [ ] **Step 3: Implement admin APIs and meaningful logs**

Every mutation writes `user_activity_log` with action, competition id/name, affected round, and changed fields. Admin override requires a non-empty reason and emits a dedicated Last Man Standing event.

- [ ] **Step 4: Write failing admin UI tests**

Assert the menu item is visible only to platform admins, the section loads only when opened, cards start collapsed, schedule controls map A/B/C fixture weeks, unresolved replacements are prominent, and process/reopen/archive actions require deliberate confirmation.

- [ ] **Step 5: Run admin tests and verify RED for UI**

Run: `node --test test/admin-last-man-standing.test.mjs`  
Expected: FAIL on missing admin component and menu integration.

- [ ] **Step 6: Implement the compact admin section**

Follow existing admin typography and controls. Keep competition rows collapsed by default; opening one reveals configuration, entrants, picks, events, unresolved items, and actions without navigating away.

- [ ] **Step 7: Run admin tests, typecheck, and full suite**

Run: `node --test test/admin-last-man-standing.test.mjs && pnpm typecheck && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/last-man-standing components/admin-last-man-standing.tsx components/admin-console.tsx test/admin-last-man-standing.test.mjs
git commit -m "Add Last Man Standing administration"
```

### Task 6: Add the League Chair standalone screen and home panel

**Files:**
- Create: `components/last-man-standing.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `lib/types.ts`
- Modify: `lib/appearance.ts`
- Create: `test/last-man-standing-ui.test.mjs`

**Interfaces:**
- Consumes: Task 3 participant API DTOs.
- Produces: `LastManStandingPage` and `LastManStandingHomePanel`, plus the `Last Man Standing` app-page/menu identity.

- [ ] **Step 1: Write failing access, navigation, and panel tests**

Assert the standalone menu option and page exist only with League Chair access; the home panel shows round, picks, deadline, standing state, and remaining/total count; ordinary roles see neither; multiple competitions expose a selector.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test test/last-man-standing-ui.test.mjs`  
Expected: FAIL because the page and panel do not exist.

- [ ] **Step 3: Implement page identity, access gating, menu item, and home panel**

Use a Trophy or Shield icon from Lucide. Add the panel to player, manager, and club-only home render paths only when `hasLeagueChairAccess` is true, without changing ordinary home layouts.

- [ ] **Step 4: Write failing interaction and privacy tests**

Assert two grouped selectors, previously used players disabled with small explanatory text, no-fixture teams marked, duplicate prevention, save/change until noon, locked state at noon, current-round picks hidden before each entrant deadline, automatic-pick reason labels, history, and standings.

- [ ] **Step 5: Run UI tests and verify RED for interactions**

Run: `node --test test/last-man-standing-ui.test.mjs`  
Expected: FAIL on missing interactive states.

- [ ] **Step 6: Implement responsive competition screen**

Use one compact unframed page section with 8px-or-less cards only for repeated entrants/history. On mobile, selectors stack; on desktop, they share a row. Keep all controls stable in width and prevent player names or deadline copy from truncating.

- [ ] **Step 7: Run UI tests, typecheck, and full suite**

Run: `node --test test/last-man-standing-ui.test.mjs && pnpm typecheck && node --test test/*.test.mjs`  
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add components/last-man-standing.tsx components/app-shell.tsx lib/types.ts lib/appearance.ts test/last-man-standing-ui.test.mjs
git commit -m "Add Last Man Standing experience"
```

### Task 7: Apply migration and perform end-to-end verification

**Files:**
- Modify if required by verification: files owned by Tasks 1-6 only
- Test: all project tests

**Interfaces:**
- Consumes: complete Tasks 1-6.
- Produces: migrated database and verified production build with the feature still audience-gated to League Chairs.

- [ ] **Step 1: Run final static verification**

Run: `git diff --check && node --test test/*.test.mjs && pnpm typecheck && pnpm build`  
Expected: zero diff errors, zero test failures, successful typecheck, successful production build.

- [ ] **Step 2: Apply the additive migration**

Run: `pnpm db:apply supabase/last_man_standing.sql`  
Expected: `Applied supabase/last_man_standing.sql`.

- [ ] **Step 3: Verify database defaults without creating a live competition**

Confirm all tables and indexes exist, no competition rows were inserted, and no ordinary user visibility changed merely by applying the migration.

- [ ] **Step 4: Run local browser QA**

Verify mobile and desktop layouts for League Chair home, standalone competition page, pick editing, history/standings, and Admin. Verify an ordinary player cannot see the menu or call the participant API. Capture console/network errors and fix any regression under TDD.

- [ ] **Step 5: Run final verification again after QA fixes**

Run: `git diff --check && node --test test/*.test.mjs && pnpm typecheck && pnpm build`  
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Verify Last Man Standing pilot"
```
