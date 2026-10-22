# Optional livestream notifications

Goal: Video users can notify all active Viewing-permission holders when making today's match live. A notification opens that exact stream, in-app without a reload. Checkbox defaults off. Notifications use Announcements inbox/push preferences and global enable/category switches, device opt-in and quiet hours. Viewing itself authorises this specific alert even outside the general inbox-role rollout; it does not make viewers eligible for other notifications. At most one notification fanout per listing; retry-safe and transactional. No real broadcasts/pushes during verification. No commit/push requested.

Implementation inline with TDD:
- [x] Policy + navigation + UI regression tests: optional checkbox, announcement mapping, Viewer-only eligibility, exact stream selection and unavailable stream feedback.
- [x] Protected additive migration: listing fanout timestamp/count and internal livestream event type. Batch snapshot active viewers, insert inbox/outbox atomically and schedule delivery after commit. Ended/revoked/expired sources suppressed.
- [x] Server/API role isolation and duplicate handling; notification inbox access for standalone Viewing, scoped only to permitted categories/events.
- [x] Wire initial URL and running-app notification navigation to a validated stream UUID; viewer loads selected player, never an unrelated stream.
- [x] Real rollback DB checks of recipients, opt-outs, duplicate sends, ended/revoked sources; full suite, typecheck, build and independent review.


Verification: 483/483 tests, typecheck and production build passed. Real rollback-only livestream notification verification and Publisher messaging regression verification passed; dispatch was stubbed and no real broadcasts/pushes sent. Additive migration applied. Independent review identified announcement-detail eligibility and Viewer-only push-test regressions; both were reproduced with failing tests, fixed, and passed in the full suite and real SQL checks. Added stream-row locking and an ended/missing-listing regression test to prevent fanout after concurrent termination. No deferred review findings. No commits/pushes requested.
