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

Both summaries use the same official/live handicap display, demo fallback, low index, movement, index history, latest three dated rounds, gross score, tees, holes, differential, points, counting legend and source details. Invalid round dates do not enter the latest-three list. Zero and plus handicaps are preserved. Native retains a compact player selector for authorised linked players, retry/empty states and My Golf/Lessons navigation. Web's round recording action remains web-only until native editing is implemented; native does not advertise an unsupported action.

The native card uses native views for its chart and decorative orbit. The website uses SVG and CSS gradients. These renderers share semantic content and geometry but are not pixel-identical. The next parity slices are My Golf and Lessons; this change does not complete their native feature sets.

## Co-development checklist

1. Define or extend the shared contract, permission checks and business rule once.
2. Update the web and native renderers together. Use semantic tokens rather than copying colour literals.
3. Check loading, unavailable/demo/live data, errors, large text, pale club branding and club/player switching.
4. Run `pnpm typecheck`, `pnpm mobile:check`, relevant tests and iOS/Android exports. Compare screens on a mobile-sized browser and native preview.
5. Call out platform-specific capability gaps. Keep native storage, navigation, notifications and device access at the platform boundary.
