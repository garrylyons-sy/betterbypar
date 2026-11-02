# Customer menu navigation

Goal: customer and professional mobile features use Home / My Golf / Lessons / Club / More, without top-of-page return buttons.

Approach: one route-aware navigation frame for standalone customer/coaching pages; the existing main app shell retains its own menu. Desktop standalone pages also gain the shared menu. App-shell deep links accept customer menu destinations so Club and More work from any feature. Existing sign-in prompts and workflow actions remain. The round editor uses a local round-selection menu, retaining unsaved-change protection.

- [x] Test route classification and menu destinations; implement shared frame and root menu query resolution.
- [x] Remove top return links from golf/practice/round/store/profile/family/lessons pages and professional routes; keep feature-specific actions.
- [x] Replace round editor back arrow with round-selection menu.
- [x] Typecheck, full tests, browser navigation across standalone feature and main app menu; document result. No commit/push requested.

Verification: TypeScript passed, all 617 tests passed and `git diff --check` is clean. Browser checked My Golf, profile, family and professional round review with one shared app menu; Club and More deep links opened the correct root app sections without duplicate menus. Guardian opened Casey’s scorecard and selected Round history through the new Rounds menu. Fresh independent review found no blockers. No commit or push performed.

## Viewport docking hardening

The current build initially measured flush with the viewport bottom; the supplied older-app screenshot alone did not reproduce a live drift. Both mobile menus now render through `ViewportPortal` directly under `document.body`, so page transforms or containment cannot establish a content-relative fixed-position ancestor. They share `.mobile-app-menu` bottom anchoring, maintain safe-area padding, and reserve content space. Desktop navigation stays inline. Viewport metadata enables safe-area coverage.

Verified both real menus with DOM measurements before and after scrolling: standalone round review at scroll 0 and 957 px; root app at scroll 0 and 1008 px. In all cases the menu bottom equalled the 504 px viewport bottom (0 px gap), and its direct parent was BODY. Visual screenshots confirmed the menu stayed docked. This is browser verification; a physical iPhone was not available. SSR/body-target regression tests and full suite pass: 619 tests. TypeScript and whitespace checks pass. No commit or push performed.
