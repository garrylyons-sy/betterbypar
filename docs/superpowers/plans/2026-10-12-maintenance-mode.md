# Maintenance Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-backed maintenance mode with a polished holding page and a platform-admin escape hatch.

**Architecture:** A singleton PostgreSQL row stores the switch. Pure access-policy helpers define page and login behaviour, server-side layout gating protects normal pages, and authentication routes independently enforce the same policy. A platform-only dashboard control updates the switch.

**Tech Stack:** Next.js 15, React 19, TypeScript, PostgreSQL, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-12-maintenance-mode.md`

## Global Constraints

- Maintenance mode defaults to off.
- Only platform administrators may change the switch or sign in during maintenance.
- `/admin` and `/maintenance` remain reachable while normal pages are blocked.
- Existing unrelated workspace files must remain untouched.

## Review Focus

- Missing settings table must fail open so a migration rollout cannot lock out the application.
- A forged admin login intent must not admit a non-platform user.
- Google sign-in must obey the same restriction as password sign-in.
- The maintenance page must not redirect to itself.
- Club administrators must not receive the maintenance control.

---

### Task 1: Access policy and persistence

**Files:**
- Create: `test/maintenance-mode.test.mjs`
- Create: `lib/maintenance-policy.mjs`
- Create: `lib/server/maintenance.ts`
- Create: `supabase/maintenance_mode.sql`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `shouldShowMaintenance(pathname, enabled)`, `canSignInDuringMaintenance(input)`, `loadMaintenanceMode()`, and `setMaintenanceMode(enabled, personId)`.

- [ ] Write policy and schema tests, then run them and confirm failure.
- [ ] Implement the pure policy, persistence helper, and SQL migration.
- [ ] Run the focused test and confirm it passes.

### Task 2: Page and authentication gates

**Files:**
- Create: `middleware.ts`
- Create: `components/maintenance-page.tsx`
- Create: `app/maintenance/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/auth-controls.tsx`
- Modify: `app/api/login/route.ts`
- Modify: `app/auth/google/route.ts`
- Modify: `app/auth/google/callback/route.ts`
- Modify: `app/api/session/route.ts`

**Interfaces:**
- Consumes: Task 1 policy and persistence interfaces.

- [ ] Add source-level tests for page and login gates, then confirm failure.
- [ ] Implement server-side page gating and password/Google/session enforcement.
- [ ] Run focused tests and confirm they pass.

### Task 3: Admin control and visual asset

**Files:**
- Create: `app/api/admin/maintenance/route.ts`
- Create: `public/snooker-logo-maintenance.png`
- Modify: `app/api/admin/route.ts`
- Modify: `components/admin-console.tsx`

**Interfaces:**
- Consumes: Task 1 persistence interfaces.
- Produces: platform-only admin maintenance API and dashboard toggle.

- [ ] Add tests for platform-only control and dashboard visibility, then confirm failure.
- [ ] Implement the endpoint and admin dashboard control.
- [ ] Generate, inspect, and install the maintenance mascot asset.
- [ ] Run focused tests and confirm they pass.

### Task 4: Verification and rollout

**Files:**
- Modify only files required by findings.

- [ ] Run the complete test suite, typecheck, and production build.
- [ ] Apply the SQL migration with the switch defaulting to off and verify the persisted value.
- [ ] Obtain an independent code review and resolve important findings with RED-GREEN tests.

