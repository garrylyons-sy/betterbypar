# Golf Foundation Implementation Plan

> Execute inline under repository AGENTS.md. Do not commit or push.

**Goal:** Add dependants, professional roles, mandatory club appointments, Lessons and an empty Challenges admin section.
**Architecture:** Extend club memberships; add independent relational lesson and dependant capabilities with shared scoped server access. Retain app sessions and PostgreSQL/Supabase.
**Tech Stack:** Next.js, TypeScript, pg, Supabase PostgreSQL, node:test.
**Spec:** docs/superpowers/specs/2026-10-24-golf-foundation-design.md

## Global constraints
No React Native client yet. No existing credentials or live DB access. Preserve branding, existing bookings and invites. No commits or pushes.

## Review focus
- Cross-club access and forged guardian/player IDs must fail.
- Revoked/deactivated relationships and memberships must immediately stop delegation.
- Concurrent lesson reservations must have exactly one winner.
- Removing the last required club officer must fail, including account/person deactivation.
- Clubs without league teams must support people and invites.

## Tasks
- [x] 1. Add failing domain tests for appointments, scoped delegation, lesson validation and authorization; run node --test test/golf-foundation.test.mjs.
- [x] 2. Add supabase/golf_foundation.sql: role constraints, dependants, slots, bookings, RLS, transactional invariants. Provide clean-install schema ordering fix and setup instructions.
- [x] 3. Add lib/golf-policy.ts and lib/server/golf-access.ts. Wire professional roles into people, invitations, activation, session contexts, appearance. Add appointment selection to Clubs and atomic persistence to its API.
- [x] 4. Add admin Dependants/Lessons APIs and panels; add member/guardian APIs and web pages for family and lessons. Use actor identity from session and always check club scope.
- [x] 5. Add Challenges blank tab. Install locked dependencies, run new and inherited tests, TypeScript and production build. Review diff and document database/runtime verification limits.

## Verification and review

- `pnpm test`: 522 passed, 0 failed (Node 24). Includes policy and disposable PostgreSQL tests.
- `pnpm typecheck`: passed; final production build also checked TypeScript after the last code changes.
- `pnpm build`: passed, including all new pages and API routes.
- `git diff --check`: passed.
- Independent review: fixed the conditional-hook regression in the spreadsheet parser, inactive-dependant authorization, and missing setup documentation. Follow-up review found no important issues in the reviewed changes.
- The existing Permissions endpoint now synchronizes both administrator grant representations, with rollback tests for the last required administrator.
- PostgreSQL tests use PGlite on one connection. Competing requests exercise unique/exclusion constraints, but are not a test of independent server connections.
- No live Supabase migration, email delivery, or configured-account browser flow was run. Those remain environment checks after the user supplies the new project. No commits or pushes.

## Implementation decisions

Keep the current checkout for this newly cloned project, per repository instructions to proceed in place. Use one-to-one lessons, explicit club-scoped delegation, and separate actor/player identities. No payments, group classes or recurring slots. Existing inherited authentication is cookie-based; React Native authentication transport is deferred. Add only a development dependency on PGlite to reproduce database checks without live credentials.
