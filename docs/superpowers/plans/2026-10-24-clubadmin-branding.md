# Club Administration and Branding

**Goal:** Add /clubadmin alongside /admin so appointed club administrators can maintain their own logo, primary colour and accent colour.

**Design:** A focused club portal with its own login, club selector, branding form and preview. Use existing club branding columns and sessions. /admin retains platform governance and its existing operational panels; its club management continues to work. The new API requires an explicit active club administrator appointment, including for people who are also platform operators. No platform cache or demo data is used in the portal. The member app already consumes club branding; add a discoverable link for club administrators and update the existing club admin home links.

**Implementation:** Add tested pure branding validation and a SQL-backed store which checks club scope on every read/write. Add /api/clubadmin GET/PATCH and /clubadmin page/component. No database migration needed. No commits or pushes.

- [x] Test branding validation and real database scope isolation before implementation.
- [x] Implement store/API, portal login/editor/preview and navigation links.
- [x] Run full tests, typecheck/build and review changes.

Repository AGENTS.md authorizes inline implementation without intermediate approvals. This extends the existing web client; React Native remains deferred.

**Review decision:** Keep the club portal focused on Branding, Lessons, Dependants and blank Challenges. Existing People, Matches and Ladder workflows depend on platform assumptions and remain in the existing /admin interface. The portal's initial load uses only /api/clubadmin, avoiding the inherited platform dashboard data and cache. Lesson/dependant requests explicitly narrow operator privilege to appointed clubs. Supported query tabs are validated against these four sections.

## Verification

`pnpm test`: 527 passed, zero failures. `pnpm typecheck`: passed. Final `pnpm build`: passed (64 generated pages). `git diff --check`: passed. Tests execute branding writes against disposable PostgreSQL and verify foreign clubs, revoked assignments, inactive clubs, and platform operators without club appointments cannot mutate club branding. Independent review confirmed final portal navigation and scoped endpoints. No live Supabase/browser account test was run; the new Supabase project remains unconfigured. No database migration is needed for this portal.
