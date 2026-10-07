# League Chair Live Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Interclub League Chairs an isolated, mobile-first way to enter frame winners and run auditable live frame scoring without changing any other role's experience.

**Architecture:** A pure scoring state machine drives a persisted session snapshot and append-only event ledger. A dedicated cookie-authenticated League Chair API owns reads and writes, uses optimistic versions plus a scorer lease, and finalises through the existing official `game`/`match` result model. A separately gated UI polls only while a League Chair has its controls open.

**Tech Stack:** Next.js 15, React 19, TypeScript, PostgreSQL/Supabase, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-07-league-chair-live-scoring-design.md`

## Global Constraints

- Only active League Chairs and platform administrators may discover, read, or mutate live-scoring data.
- Existing fixture, lineup, score-entry and completed-result behaviour for every other role must remain unchanged.
- Live totals are provisional until explicit frame completion.
- The pilot uses two-second polling only while its panel is visible; Supabase Realtime is deferred.
- Existing app-owned cookie authentication remains the authority.

## Review Focus

- Two League Chairs submit against the same version: the stale write receives `409` and cannot overwrite saved state (Task 3).
- A scorer loses connectivity after tapping: the UI advances only after a saved response and disables controls while offline (Task 4).
- The final red is followed by its colour before colour clearance begins (Task 1).
- A tied frame can enter re-spotted black and cannot complete without a winner (Tasks 1 and 3).
- A player, manager, club admin, or unauthenticated caller cannot infer whether a live session exists (Task 3).

---

### Task 1: Scoring state machine

**Files:**
- Create: `lib/live-scoring.mjs`
- Create: `test/live-scoring.test.mjs`

**Interfaces:**
- Produces: `createLiveFrameState(input)`, `applyLiveFrameAction(state, action)`, `pointsRemaining(state)`, and `snookersRequired(state)` returning serialisable state snapshots.
- Consumes: No database or React dependencies.

- [ ] Write failing tests for initial inventory, alternating red/colour play, final-red transition, ordered colour clearance, fouls, end visit, undo restoration, doubles player selection, concession, and re-spotted black.
- [ ] Run `node --test test/live-scoring.test.mjs` and confirm the missing-module failure.
- [ ] Implement the pure state and action functions with integer validation and explicit action errors.
- [ ] Run `node --test test/live-scoring.test.mjs` and confirm all cases pass.
- [ ] Commit the state machine and tests.

### Task 2: Persistent sessions and events

**Files:**
- Create: `supabase/league_chair_live_scoring.sql`
- Modify: `supabase/schema.sql`
- Create: `test/live-scoring-schema.test.mjs`

**Interfaces:**
- Produces: `public.live_frame_session`, `public.live_frame_event`, indexes, status/event constraints, one-active-session enforcement, and replica identity suitable for a later Realtime rollout.
- Consumes: Existing `fixture`, `match`, `game`, `team`, `person`, and `app_session` identifiers.

- [ ] Write failing schema tests for required columns, foreign keys, version and lease fields, event ordering, terminal statuses, and the one-active-session constraint.
- [ ] Run `node --test test/live-scoring-schema.test.mjs` and confirm failure.
- [ ] Add idempotent migration SQL and mirror the canonical definitions into `supabase/schema.sql`.
- [ ] Run the schema test and `git diff --check`.
- [ ] Commit the database model.

### Task 3: League Chair scoring service and API

**Files:**
- Create: `lib/server/game-results.ts`
- Create: `lib/server/live-scoring.ts`
- Create: `app/api/league-chair/live-scoring/route.ts`
- Modify: `app/api/manager/lineup/route.ts`
- Create: `test/live-scoring-api.test.mjs`

**Interfaces:**
- Consumes: Task 1 state functions and Task 2 tables.
- Produces: `recordOfficialGameResult(client, input)`, `requireLeagueChairScoringAccess(personId)`, `loadLiveScoringFixture(fixtureId)`, and API actions `recordResult`, `start`, `pot`, `foul`, `endVisit`, `selectPlayer`, `undo`, `correctBalls`, `takeover`, `pause`, `resume`, `complete`, and `abandon`.

- [ ] Write failing API/service tests proving server-side role gating, indistinguishable `403` responses, fixture/game validation, stale-version `409`, lease enforcement, idempotent completion, ordinary result reset, and activity-log boundaries.
- [ ] Run `node --test test/live-scoring-api.test.mjs` and confirm failure.
- [ ] Extract official game-result persistence into `game-results.ts` and switch the existing manager route to that helper without changing its request or response shape.
- [ ] Implement the League Chair service with transactional snapshots/events, version checks, leases, final-score copying, qualifying break persistence, and match-point refresh.
- [ ] Implement the dedicated GET/POST API with `no-store` responses and stable error codes.
- [ ] Run the API test, existing manager/admin tests, and TypeScript typecheck.
- [ ] Commit the secured scoring backend.

### Task 4: League Chair controls and live scorer

**Files:**
- Create: `components/league-chair-live-scoring.tsx`
- Modify: `components/app-shell.tsx`
- Create: `test/live-scoring-ui.test.mjs`

**Interfaces:**
- Consumes: Task 3 API and the existing `TeamContext.hasLeagueChairAccess` flag.
- Produces: `LeagueChairMatchControls` and `LiveFrameScorer`, mounted only for League Chair/platform contexts when a fixture is expanded.

- [ ] Write failing UI source tests for League Chair gating, closed-by-default controls, ordinary home/away/undecided result buttons, live-score launch, ball inventory, large scoring controls, status indicators, two-second visible-only polling, and absence from general fixture payloads.
- [ ] Run `node --test test/live-scoring-ui.test.mjs` and confirm failure.
- [ ] Build the closed-by-default League Chair controls without changing existing manager/read-only component branches.
- [ ] Build the mobile scorer with fixed scores, active player/current break, ball inventory, pot/foul/end-visit/undo controls, completion confirmation, lease/takeover state, and saved/offline/conflict feedback.
- [ ] Add visible-only polling with cleanup on close, backgrounding, completion, or abandonment.
- [ ] Run the UI test, all Node tests, typecheck, and production build.
- [ ] Verify the desktop and mobile layouts in-browser as League Chair and confirm a non-chair receives the unchanged fixture UI.
- [ ] Commit the League Chair UI.

### Task 5: Database rollout and final verification

**Files:**
- Modify only if verification exposes a defect in files owned by Tasks 1-4.

**Interfaces:**
- Consumes: Complete feature and migration.
- Produces: Applied database schema and verified deployable branch.

- [ ] Apply `supabase/league_chair_live_scoring.sql` through the repository migration command and inspect the result.
- [ ] Exercise one live frame locally: start, score pots/foul, undo, hand over, reconnect, complete, and verify official frame/match totals.
- [ ] Verify abandon leaves official totals unchanged and ordinary League Chair result entry can set and reset a winner.
- [ ] Verify Player, Manager, Club Member, and Club Admin sessions receive no controls and `403` from the pilot API.
- [ ] Run the complete Node test suite, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [ ] Review the final diff for unrelated changes, commit any verification fixes, and report migration/deployment status.
