# React Native foundation

Goal: runnable iOS/Android React Native client with a first working slice against the website's backend, preserving all existing work.

Implementation uses Expo's official blank TypeScript starter. The website remains Next.js. Keep independent mobile dependencies/lockfile and exclude mobile sources from website typechecking. Shared mobile DTOs contain no framework dependencies.

- [x] Test and implement separate hashed native sessions, expiry/revocation and active-account checks; bounded password login with maintenance policy, durable throttling and no browser-cookie token reuse. Existing currentUser resolves explicit native bearer credentials for the same API permissions.
- [x] Add mobile bootstrap/logout routes and SQL/local migration. Verify bearer login, website cookie isolation, invalid/expired/revoked tokens, club/player scope and persistent session behaviour through real SQL and local HTTP tests.
- [x] Create Expo client: secure credential storage, API origin configuration, session recovery, five safe-area menu sections, club/player selection, handicap/recent rounds, saved round summaries and practice plans. Logging a drill session must persist through the existing practice endpoint and website. Native screens, not a WebView.
- [x] Configure approved brand assets, iOS/Android app identities and local development instructions. No signing accounts, production access or paid cloud builds.
- [x] Install dependencies, typecheck both clients, test the website, bundle native platforms, run HTTP smoke verification and fresh security/code review. Attempt available simulator/device tooling; report exact limits. No commit/push requested.

Review focus: leaked browser credentials, hashed token storage, bearer-vs-cookie precedence, expired/disabled accounts, maintenance access, login limits, sign-out persistence, async session restoration/account switching, stale club/player context, native fetch failures and demo evidence labels.


## Verification and review

- Website TypeScript passed. Native TypeScript and Expo lint passed. All 625 tests passed.
- Expo SDK 58 iOS and Android production Hermes bundles exported successfully to `/tmp/bbp-native-ios` and `/tmp/bbp-native-android`. These are bundle checks, not signed native binaries or device runs.
- Local native HTTP smoke test passed twice, including final password-bound token issuance: no browser cookie returned by native login; only token hashes stored; native handicap/club data shared with web; drill log visible through website session; duplicate protection; unrelated guardian/player denial; invalid bearer cannot fall back to a valid browser cookie; app logout leaves browser session intact. Script cleaned its disposable records.
- Native session SQL test covers expiry, suspension, password-reset revocation and changed-password issuance rejection. Mobile tokens are issued only while the verified password hash and active account/person still match under a row lock.
- Fresh independent review found offline sign-out recovery and cross-club player selection bugs. Regression tests were written failing, then fixes clear local credentials before best-effort server revocation and filter native player choices to active club. Maintenance permits mobile logout. Secure-store deletion failure stays visible rather than claiming sign-out.
- Expo and React Native dependencies are separate packages in a shared pnpm workspace/lockfile; the initial standalone-lockfile plan was replaced because Expo CLI installs in the repository workspace. Website React dependencies remain independent of the native React version. No separate mobile lockfile remains.
- Simulator tooling was checked: Xcode exists, but there are no installed iOS simulator devices/runtimes and no Android emulator/adb. Device UI verification remains outstanding. No large runtime download, paid build, signing account or publishing action was undertaken.
- The local demo remains bound to loopback; physical-phone access requires an approved reachable backend. Native development server uses a localhost-only port, with default 8081 occupied; started on 8082 instead.
- Native lesson booking, professional coaching UI, round editing/import, challenge attestation, video demos and native push remain follow-on work, stated explicitly in the app and mobile README. No commit or push performed.
