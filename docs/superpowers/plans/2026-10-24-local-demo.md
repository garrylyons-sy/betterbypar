# Local demo without Supabase

Run the actual web app with app-owned login sessions against a local PGlite PostgreSQL socket server. Use fictional users, clubs, dependants and lesson slots; never copy live credentials or data. Keep demo data on local disk in a git-ignored directory. Use an explicit `pnpm demo:local` launcher that binds database and app to loopback, overrides database settings and disables email, OAuth and push credentials. Do not alter production authentication or the normal database adapter.

Add `/demo` available only with LOCAL_DEMO=1 in development, with a clear demo banner and role-login buttons through the existing password-login API. Expose /admin, /clubadmin, /profile, /family and /lessons normally. Seed platform admin, club admin, golf professional, assistant, parent, member and an account-free junior. Ensure club appointment constraints are met atomically and include a second fictional club for scope checks.

- [x] Verify demo gating and seed behavior with tests.
- [x] Add local bootstrap/launcher and seed, role entry page and banner.
- [x] Start on a free loopback port and verify real HTTP login, admin, club branding, dependants, lessons and image upload.
- [x] Run test suite/typecheck, review and give the user working local links.

No commits, pushes or live database actions. Repository AGENTS.md authorises inline work. Use existing schema plus its documented core setup files. Extra inherited features may need their existing migrations; apply only schema/settings migrations needed by the actual demo paths, without historical result imports or original users.

Verified: 541 tests passed, TypeScript check passed, and real HTTP smoke checks passed for login, admin, branding isolation, dependant lesson booking/cancellation, professional management and image resizing/removal. Browser confirmed Club Admin branding and the role picker at http://127.0.0.1:3500/demo. Persisted demo launches replenish future lessons without duplicating or overwriting existing slots.
