# Specific-message navigation and receipts

Goal: announcement/publisher notifications open their exact message (including push-only), and Publisher own sent history distinguishes Opened / Marked read / Unread.
Architecture: app_notification.opened_at with coalescing first-open timestamp. Receiver-only GET serves active retained announcements; explicit POST acknowledges after visible message render. Existing read_at remains explicit read/open marker; deletion stops manufacturing reads. Snapshot JSON receipts synchronize atomically on opens/mark-read for durable Publisher history after recipient deletion. Deep links use announcement UUID; legacy announcement inbox links upgrade on load and database hrefs migrate for pending pushes. Other event destinations unchanged.

- [x] Tests: deep links, recipient/expiry permissions, open acknowledgement, read/delete distinction, owner-only receipt history and status precedence.
- [x] Migration + transactional server receipt updates, receiver GET/POST API, snapshot/legacy history fields.
- [x] Mounted-app message panel with visible-only acknowledgement and retry; update Publisher recipient labels.
- [x] Apply migration, rolled-back real SQL verification (no push sends), complete suite/typecheck/build/review, commit and push.

Existing opens cannot be reconstructed. Opening a message does not prove it was read or understood. Preserve the configured retention window. Do not send real notifications during tests.
