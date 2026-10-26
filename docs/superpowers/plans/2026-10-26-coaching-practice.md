# Structured challenges and drills

**Goal:** Separate challenge/drill databases, professional assignment, player/guardian completion and progress, in-app drill demos and evidence-aware round checking.

**Architecture:** Club-scoped libraries plus immutable assignment snapshots; challenge attempt and drill session records. App-owned server authorization with server-only RLS tables. Player and professional practice interfaces integrated with My Golf, the lesson diary and admin. Assignment notifications use the existing lesson-feedback preference category and delivery framework.

**Constraints:** No commits/push; retain existing work. Pros/assistants are not players. Only self/active guardians submit player progress. Coaches see assigned challenge outcomes and practice notes, not a player's private round journal. Imported immutable scores and player-added observations have distinct evidence labels. Unknown/missing/partial data never becomes an automatic pass. All demos are opt-in in-app players; no untrusted HTML or server URL fetching. Built-in local animated demonstrations are explicitly labelled.

- [x] Test and implement template validation, video URL parsing and challenge evaluation.
- [x] Add separate library tables, assignment snapshots, attempts/sessions, seeds and local migration support.
- [x] Implement club-scoped manager and player APIs, assignment/cancellation, check/attest/log actions, duplicate protection and revision-aware outcomes. Test real SQL access and progress.
- [x] Integrate assignment events with standard notification eligibility, preferences, quiet hours and source revalidation.
- [x] Build distinct challenges/drills views for coaches/admin and players; structured demo playback and completion forms.
- [x] Run TypeScript/full tests, local HTTP/browser end-to-end checks, fresh review and setup documentation.

**Rulings:** No three-putts requires optional per-hole putting observations; Golf Ireland does not provide these here. No double bogeys requires hole par and strokes; missing imported par requires attestation. No lost balls is attested. A seeded gross-score target demonstrates a check possible from a complete imported Golf Ireland gross score. Course par/holes are not guessed. Challenge targets specify 9/18 holes and a date window. Library edits do not rewrite existing assignments. Editing a checked round makes its old result stale until rechecked.

## Verification and review

- TypeScript and all 614 tests pass; `git diff --check` is clean.
- Local HTTP smoke test passes for professional assignments, guardian access, unrelated denial, sample round checks, attestation, duplicate-safe progress, cancellation and shared notifications.
- Browser verified Colin assigning No lost balls and Putting gate to Casey; Jordan attesting the challenge, playing the local demo and recording one of three sessions. These labelled fictional demo plans remain available to explore.
- Independent review found two recovery/evidence issues, now fixed with regressions: known gross lower bounds cannot be attested away; picked-up cards cannot auto-pass using adjusted gross; successful POSTs remain successful if refresh fails; duplicate request keys return persisted results or reject changed payloads. Re-review confirmed no remaining blockers.
- No commit or push performed.
