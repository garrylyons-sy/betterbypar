# Admin Club Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, database-backed Clubs admin section for platform and club administrators.

**Architecture:** Extend `public.club` with edit tracking, expose a dedicated permission-scoped admin API, and add a focused Clubs panel to the existing admin console. Existing club branding fields remain the integration contract for the rest of the application.

**Tech Stack:** Next.js 15 route handlers, React 19, TypeScript, PostgreSQL/Supabase, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-07-admin-club-management-design.md`

## Global Constraints

- This release manages club records only; team management is out of scope.
- Platform admins can create, rename, activate, and deactivate clubs.
- Club admins can edit only venue, address, logo, and colours for their authorised active club.
- Deactivation is reversible and never deletes historical data.
- Uploaded logos accept PNG, JPEG, or WebP and are limited to 1 MB.
- Existing static `logo_path` values must remain valid.

## Review Focus

- A club admin requesting another club must receive `403` without revealing its data.
- Case-only duplicate club names must be rejected clearly.
- An oversized or non-image data URL must be rejected before persistence.
- A no-op patch must not create a misleading audit event.
- Inactive clubs must remain visible to platform admins but disappear from club-admin results.

---

### Task 1: Club Data Validation and API

**Files:**
- Create: `lib/server/admin-clubs.ts`
- Create: `app/api/admin/clubs/route.ts`
- Create: `supabase/admin_club_management.sql`
- Modify: `supabase/schema.sql`
- Test: `test/admin-clubs.test.mjs`

**Interfaces:**
- Produces: `normalizeClubInput(input, mode)`, `changedClubFields(current, next)`, and `GET`/`POST`/`PATCH` route handlers.
- Consumes: existing `currentUser`, `dbQuery`, `app_operator`, `club_admin`, and `user_activity` patterns.

- [ ] Write failing tests for field normalisation, colour and logo rejection, permission markers in the route, case-insensitive uniqueness, no-op handling, and scoped inactive-club visibility.
- [ ] Run `node --test test/admin-clubs.test.mjs` and confirm the expected failures.
- [ ] Add `updated_at` to the schema and idempotent migration.
- [ ] Implement focused validation helpers and the permission-scoped route handlers.
- [ ] Run `node --test test/admin-clubs.test.mjs` and confirm it passes.

### Task 2: Clubs Admin Panel

**Files:**
- Modify: `components/admin-console.tsx`
- Modify: `app/api/admin/route.ts`
- Test: `test/admin-clubs.test.mjs`

**Interfaces:**
- Consumes: club objects returned by `/api/admin/clubs` and existing admin `adminMode`.
- Produces: a `clubs` AdminTab and `ClubsPanel` with compact list, closed-by-default editor, platform create/status controls, club-admin read-only fields, logo preview, and dirty Save state.

- [ ] Extend the failing test with navigation, field restriction, upload acceptance, closed editor, and dirty Save assertions.
- [ ] Run the focused test and confirm it fails for missing UI behavior.
- [ ] Add Clubs navigation for both admin modes and implement the panel using existing admin controls.
- [ ] Load clubs independently from teams so inactive and teamless clubs are represented.
- [ ] Run the focused test and confirm it passes.

### Task 3: Audit Integration and Full Verification

**Files:**
- Modify: `app/api/admin/clubs/route.ts`
- Test: `test/admin-clubs.test.mjs`

**Interfaces:**
- Consumes: existing `user_activity` logging schema.
- Produces: `Club created`, `Club updated`, `Club deactivated`, and `Club reactivated` activity records with club id, name, and changed fields.

- [ ] Add failing audit-log assertions for each mutating action and no audit row for no-op updates.
- [ ] Run the focused test and confirm the audit assertions fail.
- [ ] Implement the minimal audit writes inside the same database transaction as each mutation.
- [ ] Run the focused test, full `node --test`, typecheck, and production build.
- [ ] Review the final diff for unrelated changes, then commit and push the feature.
