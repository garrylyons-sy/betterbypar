# Provisional Cup Draw Implementation Plan

**Goal:** Save, reveal, witness and confirm cup draws, retaining every attempt without creating fixtures before confirmation.
**Architecture:** Keep cups Draft while provisional. Store immutable entrant/round/bracket snapshots in a new draw-attempt table with persisted reveal count and audited lifecycle. Existing fixture materialization consumes the confirmed snapshot inside the confirmation transaction. Existing confirmed cups remain unchanged.
**Execution:** Inline, following the user's instruction to implement end to end. No commits or pushes.

- [x] Add lifecycle tests covering no early publication, stale attempts, redraw reasons, reveal progression, required witness, exact-snapshot confirmation and confirmed lock.
- [x] Add RLS-protected draw-attempt migration, server workflow and authenticated admin endpoints. Use cryptographic shuffle. Serialize mutations using the competition row lock.
- [x] Add compact admin draw component: entrants, persisted progressive reveal, confirmation, reasoned redraw, expandable complete history and printable record.
- [x] Verify full tests/typecheck/build and rolled-back database lifecycle; apply additive migration. Document rollout.

Review focus: concurrent/stale browser actions must not redraw or confirm a different attempt; provisional data must not leak to fixtures; failures roll back publication; snapshots preserve names/dates; existing published cups continue working. Witness is a recorded name, not independent account approval. Reveal is presentation, not concealment from administrators. History persists for the lifetime of the cup (existing explicit cup deletion removes it).

## Verification and review

- Full suite: 369 passing tests; typecheck and production build pass.
- `scripts/verify-cup-draws.mjs`: actual SQL workflow, byes, redraw snapshots, reveal retries, exact-pairing publication, failed-confirmation rollback, private access and confirmed lock verified in a rolled-back transaction.
- Additive migration applied; no real cups drawn or fixtures published during verification.
- Independent review: no concrete correctness/security findings. Concurrent request ordering is protected by the competition row lock; simultaneous-client integration was not exercised.
- UI render checks cover hidden/revealed pairings, confirmation availability and read-only history. Local browser was unavailable at localhost:3500; no authenticated browser walkthrough was performed.
- No commit or push requested or performed.
