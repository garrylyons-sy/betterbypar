# Professional round review implementation plan

**Goal:** Let active professionals review completed rounds of players they coach and hold a round/hole discussion with the player or guardian.

**Architecture:** Dedicated read-only coach journal endpoint and append-only round discussion. Existing player journal remains the score editor. A shared SQL access predicate requires active club, professional membership, registered player and a noncancelled lesson booking, active group roster or active practice assignment with that coach. Administrative privileges alone do not grant journal access. Only completed rounds appear. Round comments notify through existing coaching feedback preferences, with access revalidation at delivery. Link to practice libraries with player context and originating round in the coaching notes.

**Execution:** Apply brainstorming defaults from the user’s standing AGENTS instructions; implement inline with existing Next/SQL patterns, without commits or pushes. No worktree: preserve this running local demo and all existing uncommitted changes.

- [x] Add real-SQL failing tests for related/unrelated professional access, assistant relation, inactive/cancelled relation, drafts, cross-club IDs, guardian discussion, bounded hole/body fields and duplicate request safety.
- [x] Create `supabase/round_coaching.sql`, local startup migration, `lib/server/round-coaching.ts`, DTOs and API route. Tests become green.
- [x] Build coach player/round list, read-only scorecard/notes/shots, per-hole discussion and practice shortcut; add player discussion to journal and notification deep links.
- [x] Integrate round comment events into coaching feedback notification policy and current-source access checks. Add notification tests.
- [x] Run typecheck/full suite/local HTTP and browser walkthrough, fresh independent review; document access/data migration and evidence.

**Review focus:** Club/pro/player revocation, draft visibility, same player across clubs, duplicate mutation after refresh failure, deep links into old rounds, edited round revisions, notification recipient revocation.

## Verification

- TypeScript and all 615 tests pass; whitespace check passes. Real SQL tests cover professional/assistant relationships from practice, group roster and lesson bookings; cancellations, drafts, cross-club selection, guardian revocation, comment input bounds, duplicate keys, revision conflict and notification eligibility.
- Local HTTP walkthrough passed coach review, unrelated denial, guardian reply, hole-specific comments, linked practice, denied professional edits, private drafts and shared notification creation. Disposable smoke-test records were removed.
- Browser verified Casey’s sample import with round and hole notes; Colin reviewed it, posted hole feedback, assigned a follow-up challenge with Casey preselected, then followed the assignment link back to the round. Labelled demo examples remain available.
- Fresh independent review found a stale round context when the same player is selected in another club. Fixed by requiring both club and player to match the originating URL before carrying a round reference; server also validates all context fields. No privacy/access blockers were found.
- No commit or push performed.
