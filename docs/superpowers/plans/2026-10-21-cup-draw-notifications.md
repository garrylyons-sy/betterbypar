# Cup Draw Notifications Implementation Plan

**Goal:** Optional audience-targeted notifications with the complete confirmed cup draw, plus clear Admins options in general notification administration.
**Architecture:** Confirm-time audience selection defaults to none. Save groups and summary on the draw attempt; queue one cup_draw event per eligible person in the same confirmation transaction. Dispatch push after commit. Full multiline draw stays in inbox; large phone payloads use a bounded preview. Existing global roles, preferences, quiet hours and retention remain authoritative.
**Execution:** Inline; user explicitly requests commit and push after verification.

- [x] Add failing tests for audience validation, full pairings/byes, deduplication, rollout/preferences, payload size, no sends before confirmation and postcommit dispatch.
- [x] Implement cup_draw policy migration/version 4, recipient SQL for current entrant-team assignments, transactional inbox/outbox, source validity and audit metadata.
- [x] Add unchecked audience controls to confirmation, history summary, multiline inbox rendering and clear Admins labels. Show current rollout restrictions.
- [x] Apply additive migration and run real SQL checks rolled back, full tests, typecheck/build and independent review; commit/push.

Constraints: Never send real test notifications. Do not enable device push or expand live role rollout implicitly. Provisional draw/reveal/redraw sends nothing. Manager and Player scopes must be tied to entered teams, including active legacy assignments; Admins means active app_operator accounts. Complete draw is in inbox even when phone display truncates it. Existing confirmed draws are not notified retroactively.

## Verification

- Full suite: 382 tests pass. Typecheck and production build pass.
- Additive migration applied. Real SQL verification passes for provisional lifecycle, entrant-team scope (direct and legacy), all audience groups, inactive accounts, opt-outs, audience audit, deduplication, source validity and durable push queue; all records rolled back and no real push sent.
- Independent review reported no actionable correctness or security findings and independently ran 33 relevant tests successfully.
- Global role rollout and device push opt-ins preserved. Phone payload capped at 3800 UTF-8 bytes for oversized draw previews; full text kept in inbox.
