# Match livestreams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement inline. User AGENTS.md overrides phase approval and intermediate commit instructions.

**Goal:** Publishers list a fixture live; explicitly permitted viewers watch via YouTube.
**Architecture:** Protected SQL assignments/listings, authenticated APIs, server-bound authorization and a shared core-app livestream panel. YouTube link normalization stores only a validated video ID.
**Tech Stack:** Next/React, PostgreSQL/pg, Node test runner.
**Spec:** docs/superpowers/specs/2026-10-22-match-livestreams.md

## Global Constraints
- Viewing defaults off; only platform admins can assign it.
- CurrentUser only; no simulation authentication.
- Only publisher-owned listings can be ended by that publisher.
- One live listing per fixture; 12-hour expiry; no media proxy or real test broadcasts.
- No commit or push requested for this turn.

## Review Focus
- Malicious YouTube host/ID and malformed payloads must never create arbitrary embeds.
- Revoked viewers and inactive accounts cannot retrieve a video ID; playback closes on refresh.
- Concurrent publisher submissions must not overwrite somebody else's live stream.
- Fixture deletion/cancellation and expired listings disappear from viewers.
- Search/paging and rapid changes must not create stale selection or double sends.

### Task 1: Permissions, persistence and authenticated services
**Files:** supabase/match_livestreams.sql, lib/livestream-policy.mjs (+declarations), lib/server/livestreams.ts, app/api/livestreams/route.ts, existing admin People/auth/types/appearance.
**Interfaces:** validated youtubeVideoId(input), validateLiveDraft(input); listLiveStreams(personId), listPublisherFixtures(personId,search,page), makeFixtureLive(personId,input), endLiveStream(personId,id).
- [x] Write and run failing policy/API/service tests for malformed links, forbidden/anonymous access, owner-only ending and duplicate fixture handling.
- [x] Implement SQL with RLS/revokes, services and APIs. Add default-off Viewing checkbox, permission summaries and standalone Viewer context.
- [x] Run focused tests/typecheck; apply migration and verify SQL using synthetic records in rollback.

### Task 2: Publisher selection and viewer playback
**Files:** components/match-livestreams.tsx, components/app-shell.tsx, test/livestream-ui.test.mjs, README.md.
**Interfaces:** MatchLivestreams({publisher,viewer}) embedded on Home; publisher management and viewer list lazy loaded. Server controls actual access.
- [x] Write failing UI tests: selecting a fixture and link creates the right request; player only after Watch; failed refresh closes player; end listing refreshes.
- [x] Implement searchable paged fixture selection, Make live/End live actions, clickable live cards and click-to-load player, visible-only refresh with cancellation/unmount cleanup.
- [x] Run full node suite, typecheck, production build; review changed code and verify database security/permissions in rollback. Document setup and limits.

## Pre-flight
Task 2 consumes Task 1 IDs/status/permissions; use one shared response type. No conflicting interfaces. Existing working tree is clean and reused; do not create a worktree or commits.

## Verification results
- 465/465 Node tests passed; typecheck and production build passed.
- Additive migration applied. Real SQL verification passed, including default-off/admin-only assignment, standalone Viewer session, publisher/owner checks, conflict and retry handling, cancelled/expired/revoked listings, inactive accounts, and fixture cascade. All synthetic writes rolled back; no real streams or notifications sent.
- Independent read-only review: no actionable findings; 10/10 focused tests passed.
- Running production smoke test: Home 200; anonymous listings and fixture picker (including testUser=admin) 401 with private/no-store headers.
- No code commits/pushes requested. No Viewer assignments remain from verification. Actual phone/YouTube broadcasting remains for a real channel test.
