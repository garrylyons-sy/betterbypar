# Shared design system and native Home implementation plan

**Goal:** Make web and native Home use one club palette, visual scale, golf-summary contract and presentation rules, using the existing mobile website as the reference.

**Architecture:** Framework-free modules in shared/ supply semantic colours, spacing, radii, type sizes and golf display models. The existing web CSS adapter remains compatible; native consumes the same tokens through a club-aware hook. Native Home gains the web's player identity, index/low index, movement, trend, score tiles, counting legend and expandable data details. Platform navigation remains native.

**Constraints:** Preserve existing unrelated changes and website behaviour. No commits or pushes. No additional native dependencies. Keep unavailable/live/demo distinctions, plus handicaps, zero scores, unknown counting status and club changes correct. No misleading native actions for features still available only on the website.

- [x] Add failing tests for palette parity/contrast and summary presentation (invalid dates, plus/zero index, live status, unknown counting, ordering and source immutability).
- [x] Extract shared tokens and adapt existing web theme/CSS. Share the complete API contract and golf presentation model between clients.
- [x] Apply tokens to native primitives/navigation, and implement the reference Home layout with responsive sizing, accessibility, retry/empty states and compact linked-player selection.
- [x] Verify targeted/full tests, both TypeScript projects, native lint and bundle export. Inspect native UI where device access permits; review the final diff and document parity workflow.

**Future feature workflow:** Define one API contract and business rules, implement web/native in the same task, review mobile-sized states side by side, and check both clients before calling a customer feature complete. Desktop administration remains web-focused. This slice covers Home; it does not claim native booking or round-editing parity.

## Verification ledger

- Shared tests were observed failing before implementation; the pale-foreground regression was also observed failing before its fix.
- 630 tests passed; root and native TypeScript and native lint passed.
- iOS and Android Hermes bundle exports passed. iOS device and simulator native builds passed; a signed simulator build was needed for SecureStore entitlements.
- Simulator sign-in succeeded with the fictional member. Inspected native Home with index 12.4, low index 11.8, trend, recent round scores 83/86/85, counting legend and bottom navigation while scrolled, then returned to the top.
- Fresh code review found pale primary colours could hide selected native tabs; fixed using the shared readable primary foreground and added contrast/parity checks.
- No new native dependencies in this slice; changes load through the running Metro server. No commits or pushes.
