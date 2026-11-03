# Database course catalogue

**Goal:** Pick database courses and tee sets for round capture, initially Castle, Grange and Milltown; store par, course/slope ratings, distances and stroke indexes.
**Architecture:** Normalized golf_course (club + layout), golf_course_tee (rating category and tee-specific totals/ratings), golf_course_hole (tee/hole details). Shared typed API plus pure selection/snapshot rules. Authenticated shared server API used by web/native; round metadata snapshots preserve historical selections. Missing/unverified facts stay null and are labelled unavailable. Use club-published scorecards and attributed secondary rating sources with URL/review date; document discrepancies. No external provider credentials or paid service.
**Rulings:** Grange layouts are separate records, not one generic course. Men/women rating categories remain distinct even for same tee colour. 18-hole ratings must not be presented as nine-hole ratings; no new automatic handicap calculation. Existing/manual/imported rounds retain score protection; no retroactive name-based association. Tables read through app server; no anonymous DB grants. No admin editor requested, no commits/pushes. Current checkout reused to retain uncommitted changes/running demo.

- [x] Database tables, API, shared contracts/selection helpers and authoritative round snapshot preservation; tests.
- [x] Research and seed published scorecards/ratings for Castle, Grange and Milltown with provenance and honest unknowns; apply locally.
- [x] Replace hard-coded capture presets with database course/layout/tee selection on web/native, display ratings and hole metadata.
- [x] Review, root/native checks/tests, local DB/API and browser/native verification, bundles and docs.

**Verified:** 665/665 root tests; root and mobile TypeScript; Expo lint; live authenticated catalogue/create/save API check; browser Grange women’s tee selection; iOS simulator Castle tee selection; iOS and Android bundle exports. Independent review found and resolved canonical par preservation on saved cards. Five layouts, 17 tee/category combinations, 306 holes are applied to the local demo. No remote database changes or commits.
