# Lineup publication deadline reminders

Goal: retire match reminders; optional team-specific publication reminders target one hour before a configurable deadline relative to kickoff.

- [x] Test timing boundaries, configuration limits, disabled reminders, per-team manager scope, published suppression, deadline changes and stale match alerts.
- [x] Add lineupDeadlineHours (default 2, range 0–168, fractional hours supported), optional lineup_reminder controls, and retire match_reminder creation/UI/delivery. Keep legacy keys/types for stored data compatibility.
- [x] Generate only during [deadline minus 1 hour, deadline), using team-specific dedupe keys including deadline and schedule revision; expire on publication/deadline and reject stale policy/schedule events.
- [x] Apply non-destructive retirement SQL, verify SQL inside rollback without push, full tests/typecheck/build and independent review, then commit/push as requested.

Deadline is a publication target, not a new restriction on saving/publishing late. Reminder cadence remains approximately hourly under the deployed scheduler. Existing eligibility, personal preferences and quiet hours apply. No real push sent during testing; no role rollout changes.

Verification: full tests and production build pass; typecheck passed. Real database script verifies one-hour window, team scope, duplicate prevention, A→B→A with fixture alerts disabled, cutoff changes, publication expiry, late suppression, optional disabling and retired alerts; all records rolled back and no real push dispatched. Independent review finding on schedule identity fixed with a persistent fixture revision, then rechecked (42 targeted tests pass). Migration applied. Separate concurrent cup-setup edits in the workspace are outside this commit.
