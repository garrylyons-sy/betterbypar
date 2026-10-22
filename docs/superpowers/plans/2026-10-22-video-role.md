# Separate Video from Publisher

Goal: Video is a standalone platform-admin-assigned role that alone permits creating/managing owned match livestreams. Publisher continues to control messaging. Viewing remains separate; Video can preview owned streams. No automatic assignments or existing message/ownership rewrites. No commit/push requested.

Implementation (inline using existing standalone-role patterns and TDD):
- [x] Add regression coverage for Video-only broadcasting, Publisher-only denial, Viewing-only playback, standalone Video sessions, admin-only assignment and revocation.
- [x] Add protected app_video migration (RLS/revokes; no grants to people) and include in consolidated schema.
- [x] Add Video checkbox/labels, session flag/fallback, default appearance, Home/More gates; change livestream authorization to Video and keep messaging gates on Publisher.
- [x] Update UI/types/API/verification script to use canBroadcast/video labels; preserve existing listing ownership column for database compatibility.
- [x] Apply migration, verify real SQL in rollback without broadcasting/sending notifications, run full suite/typecheck/build and independent review.

Verification: 474/474 tests, typecheck and production build passed. Both real-SQL livestream/role verification and Publisher messaging regression verification passed with synthetic data rolled back and no real pushes/broadcasts. Independent review found no actionable issues. Migration applied without assigning any real people. Changes are uncommitted.
