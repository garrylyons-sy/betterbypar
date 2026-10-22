# Publisher messaging implementation plan

Goal: standalone Publisher permission assignable in admin People, with a Publisher-only core-app composer.
Architecture: app_publisher assignment table, active-account server authorization, session access flags and a Publisher-only fallback context. Reuse announcement audience/preview/idempotency/outbox machinery; add optional channel and individual-person restrictions stored in audience JSON.

User-approved scope: create role and core sending workflow, audiences, title, 2000-character message. Placement: Home shortcut and More. No admin access granted. Respect global rollout, announcement preferences, device opt-in and quiet hours. Do not send real messages during verification. No commit/push requested.

- [x] Add policy regression tests for channel selection and individual audiences; implement compatible optional audience fields.
- [x] Add app_publisher schema/migration and server authorization; wire admin person flag and standalone session contexts. Test non-Publisher denial and role assignment permissions.
- [x] Add Publisher API, reuse composer with channel/person options and automatic preview+send; show only to Publishers in Home and More. Test duplicate send protection and message limits.
- [x] Apply additive migration; verify real SQL with synthetic people/messages rolled back, no push dispatch. Run full suite, typecheck, build and code review.
