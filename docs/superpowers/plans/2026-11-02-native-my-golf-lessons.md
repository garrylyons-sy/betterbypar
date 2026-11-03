# Native My Golf and Lessons parity

**Goal:** Bring the native My Golf and Lessons customer journeys up to the shared visual standard and implement their core website actions against the same backend.

**Architecture:** Existing Expo routes remain tab destinations; screen components use shared semantic design tokens, API contracts and pure presentation helpers. Server permission, capacity, conflict, reminder, AI and notification rules remain authoritative. No separate database or mock native business rules.

**Scope:** Native lesson discovery/coach/day filters, individual/open/roster booking for self or eligible dependants, goals, reminder changes, cancellation, upcoming/history/feedback. My Golf round list/detail/create/edit/import/commentary/hole inputs/AI feedback and coaching discussion where supported by current API. Practice challenges/drills, structured steps, log progress and challenge checks/attestation. Match web section structure and improve shared web presentation rules where extracted.

**Constraints:** No commits/pushes. No optional approval questions. No top back buttons; preserve tab navigation and dirty-draft warnings. Request reuse is idempotent where backend supports it; uncertain booking results must reload before retry. No cross-club/player stale form saves. Keep live/demo/unavailable and name-privacy distinctions. Existing sessions and browser authentication remain separate.

**Ruling:** Reuse the existing clean checkout so the phone/simulator's Metro and local backend continue to serve the edited source. User standing instructions authorise implementation without intermediate confirmation. Do not touch external production data.

- [x] Extend native request transport for PATCH and add shared form/section primitives.
- [x] Lessons implementation with shared contracts/presentation tests; independent task review.
- [x] Rounds implementation with shared validation/contracts/tests; independent task review.
- [x] Practice and My Golf section integration; preserve progress/idempotency and scoped player access.
- [x] Full TypeScript/lint/tests, native bundle exports, native visual/member-action checks and final review.

**Review focus:** Club/player switching during unsaved edits; network errors after writes; full groups/duplicate places; unknown or missing golf data; no misleading browser-only action; long labels and keyboard/safe areas.

## Verification

Root TypeScript, native TypeScript/lint and 650 automated tests pass. iOS and Android Hermes exports pass. The local-demo member-journey verifier passed booking/reminder/cancellation, round create/edit/revision-conflict/import/AI, duplicate-safe coaching replies and drill sessions, and challenge attestation; its disposable data was removed. iPhone simulator inspection confirmed My Golf navigation, round editor, practice empty state, personal bookings, lesson discovery and selected lesson form, with the bottom tab menu retained. Website My Golf and shared practice/lesson views were checked through the local browser. Native professional administration, embedded drill videos and native push remain outside this slice. No commit or push was requested or performed.
