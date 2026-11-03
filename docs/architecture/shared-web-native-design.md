# Shared web and native design

The existing Next.js website and Expo native app remain in the same pnpm workspace and use the same server APIs and PostgreSQL data. Shared code does not import server secrets or depend on a browser/native runtime.

## Sources of truth

| Concern | Source |
| --- | --- |
| Semantic palette, contrast, spacing, radii, type scale | `shared/design-system.mjs` and its declaration |
| Web CSS adapter and legacy aliases | `lib/club-theme.mjs` |
| Native active-club theme | `mobile/src/lib/theme.ts` |
| Complete golf-summary API contract | `shared/golf-summary.ts`; compatibility export in `lib/golf-summary.ts` |
| Handicap formatting, recent-round selection, dates, trend points and counting labels | `shared/golf-presentation.mjs` |
| Web summary view | `components/golf-summary.tsx` |
| Native summary view | `mobile/src/components/golf-overview.tsx` |

Native has the same club-aware palette as web, including readable foregrounds for pale primary colours. Sessions refresh club branding when returning to the app; Home pull-to-refresh also refreshes session branding. Native navigation keeps platform safe areas and touch behaviour. The typography scale is shared; operating-system font rendering still differs. No new font or native package is required by this slice.

## Home parity

Both summaries use the same official/live handicap display, demo fallback, low index, movement, index history, latest three dated rounds, gross score, tees, holes, differential, points, counting legend and source details. Invalid round dates do not enter the latest-three list. Zero and plus handicaps are preserved. Native retains a compact player selector for authorised linked players, retry/empty states and My Golf/Lessons navigation.

The native card uses native views for its chart and decorative orbit. The website uses SVG and CSS gradients. These renderers share semantic content and geometry but are not pixel-identical.

## My Golf and Lessons

Shared `round-contracts`, `practice-contracts` and `lesson-contracts` describe the existing API responses. Portable presentation helpers handle draft round normalization, import labels, eligible practice rounds, drill logs, Dublin lesson dates, eligible players, availability and booking groups. The website reuses the extracted lesson/practice rules; native components render platform-specific forms and section controls.

Native My Golf supports round creation/edit/import, hole notes and observations, AI consent/feedback, coaching discussion and structured practice progress. Lessons supports discovery, individual/group booking, goals, reminders, cancellation and feedback. Server authorization, group capacity, attendee-name privacy, revision conflicts and notification dispatch stay shared. Native PATCH requests use the same authenticated API transport. Draft guards protect club/player/section changes; uncertain booking writes reload before retry, and idempotency keys protect practice logs and coaching replies.

Lessons refresh on screen focus and have an explicit refresh action. Round discussions can refresh without discarding an unsent reply. Drill demos currently open a link externally; native push, embedded media and professional management remain later slices.

## Co-development checklist

1. Define or extend the shared contract, permission checks and business rule once.
2. Update the web and native renderers together. Use semantic tokens rather than copying colour literals.
3. Check loading, unavailable/demo/live data, errors, large text, pale club branding and club/player switching.
4. Run `pnpm typecheck`, `pnpm mobile:check`, relevant tests and iOS/Android exports. Compare screens on a mobile-sized browser and native preview.
5. Call out platform-specific capability gaps. Keep native storage, navigation, notifications and device access at the platform boundary.

## Golf Project capture reuse

The earlier local `Golf project/app.js` and `styles.css` supplied the course reference layouts, full-shot/putt and club choices, outcome buttons, inferred next-shot mode, hole strip, score stepper and setup/capture/review pattern. Portable code is adapted in `shared/round-capture.mjs`; React web and native views live in `components/round-capture.tsx` and `mobile/src/components/native-round-capture.tsx`.

`RoundInput.entryMode` is optional for backward compatibility and is validated/persisted in the existing round JSON, without a new database. Course presets are labelled reference data; the original 17-hole Sandbox layout is excluded from the current 9/18-hole card flow. Manual courses and unknown par remain supported. Presets cannot replace a started or imported card. A pickup has no completed gross score rather than the old app's artificial par-plus-three value. Hazards and OB/lost outcomes explicitly record the struck ball and one penalty. Undo edits observations; reopening a recorded hole expressly clears its score first. Existing score-only rounds can still receive the backend's factual coaching feedback, with its existing demo/live consent policy.

The original app's DOM mutation, global state, match engine, GPS capture and separate persistence layer are not imported. Draft/finish saves, version conflicts, access rules, official imported-score protection and the shared coaching/discussion APIs remain authoritative. This flow does not claim automatic offline storage or per-shot cloud synchronization.
