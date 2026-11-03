# Better By Par mobile

Native React Native / Expo SDK 58 client for iOS and Android. The production website remains the separate Next.js application. This client uses that application's API and Supabase PostgreSQL data; no database or service key belongs in the app.

## First working slice

- Password sign-in with the same user account as the website.
- Hashed, independent native sessions, 30-day expiry and SecureStore device storage. Password changes or suspension revoke native sessions. Signing out clears the device immediately and attempts server revocation; offline revocation is best effort.
- Home, My Golf, Lessons, Club and More through Expo Router tabs, with native safe areas.
- Club selection/branding; own or guardian-managed player's handicap and recent Golf Ireland/sample data.
- My Golf sections for rounds, practice and personal lessons, with authorised player/dependant selection.
- Create/edit 9- or 18-hole rounds, hole commentary and shot observations, Golf Ireland import, consent-based AI feedback and coaching discussions.
- Structured challenges/drills, dated practice logs, saved-round checks and confirmed player/guardian attestation.
- Discover and book individual/group lessons, choose goals and reminders, cancel bookings and review professional feedback.

Drill demo links open externally; embedded video, professional administration and native push are not implemented yet. Some entries explicitly open the website, which has an independent browser sign-in. The store stays a coming-soon preview. No offline editing or sync queue is claimed. Golf Ireland and AI use the backend's configured live/demo/off modes.

## Install and run

From the repository root:

```sh
pnpm install
pnpm mobile:check
pnpm mobile:start
```

The workspace keeps the website and native React versions separate in a single lockfile. `mobile/src/app` contains Expo Router routes; shared framework-free API DTOs live in `shared/native-contracts.ts`.

Apply `supabase/mobile_sessions.sql` to the same database as the website before native sign-in. Local demo startup applies it automatically; restart the demo if it was already running when the migration was added. The local HTTP verifier also applies it idempotently.

For simulator development, the API defaults to `http://127.0.0.1:3500` on iOS and `http://10.0.2.2:3500` on Android. The website/demo backend must be running. The sign-in screen allows changing the backend origin in development only. You can also copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`, then restart Metro. Do not copy the example unchanged for Android: its loopback address is different.

`pnpm mobile:ios` needs an installed iOS simulator runtime; `pnpm mobile:android` needs an Android emulator/toolchain. The same SDK-compatible Expo Go or a development build can run on a physical device, but it needs a reachable backend. The existing demo binds to loopback for safety. A phone's localhost is the phone, not the development computer; use an approved HTTPS development backend or deliberately configure trusted LAN access. Do not expose the unauthenticated local demo role picker to a public network.

The default Metro command also binds to localhost. Change network access deliberately when testing physical devices. Native app IDs are initially `com.betterbypar.mobile`; configure your final identifiers and signing accounts before distribution. Production builds require an HTTPS `EXPO_PUBLIC_API_URL`.

### Testing on your own iPhone

Connect the phone by USB, trust the Mac, and enable Developer Mode. In Xcode Settings → Accounts, add your Apple ID and select your Personal Team (paid membership is not required for a local device build). If no teams appear, sign in at https://developer.apple.com/account/ and complete the free developer registration/agreement, then reopen Xcode. Create an Apple Development certificate using Manage Certificates if needed.

For a trusted private Wi-Fi network, deliberately start the demo on the Mac's current private IPv4 address:

```sh
LOCAL_DEMO_HOST=192.168.68.120 pnpm demo:local
```

Replace that example address with your Mac's address. The default remains loopback; public and wildcard bind addresses are rejected. The database remains on loopback. Other devices on that Wi-Fi can reach the fictional demo, including its role picker, so stop the server when testing is finished.

Set `EXPO_PUBLIC_API_URL=http://192.168.68.120:3500` in ignored `mobile/.env.local`, using the same address, then run:

```sh
pnpm --dir mobile start --lan --port 8082
pnpm mobile:ios --device --port 8082
```

Keep the phone and Mac on the same Wi-Fi. Allow local network access on the phone when prompted. The native build requires CocoaPods and Xcode signing setup. JavaScript exports alone do not install an app on the device.

Local demo credentials are listed in the root README. The native sign-in limit is eight attempts per normalized identifier per 15-minute window, and applies to demo accounts too.

## Verification

```sh
pnpm mobile:check
pnpm test
node scripts/verify-native-client.mjs
node scripts/verify-native-member-journeys.mjs
EXPO_OFFLINE=1 pnpm --dir mobile exec expo export --platform ios --output-dir /tmp/bbp-native-ios
EXPO_OFFLINE=1 pnpm --dir mobile exec expo export --platform android --output-dir /tmp/bbp-native-android
```

The HTTP verifiers run only against the local demo and clean up their disposable records. The member-journey verifier checks bookings/reminders/cancellation, round edits/conflicts/import/AI, idempotent coaching replies and practice logging, and challenge attestation. Set `NATIVE_TEST_ORIGIN` to the trusted LAN origin when the demo is bound there. Export verifies JavaScript/Hermes bundles; it is not a signed native binary or physical-device test. An iOS development build has been installed locally; no EAS build, app-store publishing or paid services have been configured.

## Shared design and feature parity

Home, My Golf and Lessons use shared semantic branding, visual scales, API contracts and presentation rules. See [the shared design architecture](../docs/architecture/shared-web-native-design.md). Club branding refreshes on return to the app and Home pull-to-refresh. Native Home includes low index, movement, trend, detailed recent rounds, counting icons/legend and expandable source details. My Golf and Lessons perform their core customer actions against the website backend, with draft guards and server-side access, capacity, revision and duplicate checks.
