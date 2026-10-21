# Friendly notifications implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks inline. The user authorizes end-to-end execution without intermediate approvals. Do not commit unless requested.

**Goal:** Clear event messages, opponent lineup publication and League Chair results, no ladder deadlines, and working notification destinations.
**Architecture:** Extend the existing transactional inbox/outbox and preference categories; keep role rollout and per-device push consent. Add event-specific freshness checks and route the existing app state without reloading.
**Tech stack:** Next.js, React, TypeScript, PostgreSQL, node:test.
**Spec:** User request in this chat on 21 October 2026.

- [x] Add `lineup_published` and `match_result` categories with a compatible settings upgrade and SQL constraint migration; preserve existing push opt-outs.
- [x] Test and implement friendly fixture and named ladder messages; remove ladder reminder generation and suppress existing deadline items.
- [x] Test and implement opponent-manager publication alerts (first publication only), plus completion alerts for League Chairs from manager and admin completion flows; use stable deduplication keys and dispatch after commit.
- [x] Route fixture/lineup links to the right team, ladder links to the challenge, results to the correct league/season and match. Test warm and cold navigation.
- [x] Update admin/personal preferences and docs. Apply and verify the additive migration, run all tests/typecheck/build, and review the final diff. Verification sends no real messages.

## Review focus

- Saving a draft or editing an already-published lineup must not notify opponents.
- Only the opposing team's managers receive publication alerts; League Chair oversight must not leak into this audience.
- Duplicate requests and result edits must not create repeat or stale alerts.
- Existing audience restrictions and channel preferences still apply.
- Expired, withdrawn or completed challenges cannot produce old deadline pushes.
