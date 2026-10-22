# Publisher sent history

Goal: Publishers can inspect only their own messages and actual recipients from the core app.
Architecture: nullable recipients JSON snapshot on notification_announcement (NULL for older sends); write snapshot atomically with notification/outbox inserts. Dedicated owner-scoped history/detail queries, ten messages and 25 recipients per page, lazy-loading compact core UI. Older messages use retained notification records with an explicit incomplete-history warning. No claim of phone receipt.

- [x] Add regression tests for owner scoping, pagination and immutable snapshots.
- [x] Add protected-schema migration, atomic snapshot writes, owner-scoped publisher API history/detail.
- [x] Add lazy expandable Sent messages UI, paginated recipient names and channel labels; refresh after send.
- [x] Apply additive migration, verify synthetic sends/history/deletion in rolled-back transaction, full tests/typecheck/build/review.

No real messages or push sends during verification. No commit/push requested.
