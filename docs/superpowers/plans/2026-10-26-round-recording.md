# Round recording and coaching implementation plan

**Goal:** Adapt the original Better By Par round journal and evidence-based coaching into My Golf, with Golf Ireland imports and round/hole commentary.

**Architecture:** PostgreSQL app-owned round journal, server authorization using existing player/guardian grants, JSON hole cards with revision checks. Server-side read-only Golf Ireland adapter and OpenAI Responses adapter; explicit isolated demo providers. React mobile-first editor and review integrated with My Golf, leaving lessons available.

**Sources:** garrylyons-sy/betterbypar-original main (server.js round_review/round_assessment rules; schema.sql rounds/hole_scores/shots); official Golf Ireland ISV Swagger and OpenAI Responses structured-output docs.

**Constraints:** No commits/push. Preserve existing work and club branding. No real outbound AI requests in local demo. Imports never submit to Golf Ireland or recalculate handicaps. Imported scoring remains immutable while player commentary and observations are editable. No fake hole data in live mode. Unknown par/putts/penalties are null. Demo feedback is labelled as a rules-based preview. All records are self/active guardian only; professionals are excluded as players.

- [x] Test and implement normalization, totals, partial cards, input bounds and simple evidence-based demo feedback.
- [x] Add server-only RLS-protected round storage, permission-scoped APIs, optimistic saves, duplicate-safe imports and revision-bound feedback. Test with real PostgreSQL-compatible SQL.
- [x] Adapt original coaching rules into validated structured output. Add explicit live configuration, no name/GI-number forwarding, timeout, rate/idempotency limits and no demo fallback on provider failure. Test with mocked network only.
- [x] Extend Golf Ireland read adapter for detailed score import, verify member ownership and preserve holes/pickups/unknowns. Test mapping and duplicates.
- [x] Build My Golf round list, creation, draft/resume, hole and shot recording, round commentary, import selector, review and feedback. Keep personal lessons accessible.
- [x] Apply local migration, run full checks and HTTP/browser smoke tests, review authorization/concurrency/provider semantics and document configuration/limitations.

**Review focus:** Cross-player/club isolation, guardian revocation, stale writes/feedback, missing imported hole/par information, and distinguishing deterministic demo feedback from live AI.

Verification: 607 tests pass, TypeScript passes, local HTTP draft/finish/feedback/import/annotation/duplicate/isolation smoke passes. Browser exercised draft saving, partial completion, demo feedback, sample GI import and persistent hole commentary. Fresh read-only review found three P2 issues (partial imports, conflict recovery and old history); all resolved and verified by reviewer.

Ruling: Adapt the original journal and evidence-based coaching patterns into app-owned sessions and PostgreSQL rather than copy its independent SQLite/users/match system. GPS, match scoring and persistent cross-round coaching memory remain outside this round-journal request. Live AI/GI adapters are configured but not called with real credentials; demo labels distinguish deterministic coaching and sample imports.
