# Native parity completion

**Goal:** Close the audited web/native customer and coaching gaps and verify real simulator flows.

**Architecture:** Keep server authorization authoritative. Reuse existing lesson availability/group/round/profile/dependant APIs. Add narrowly scoped native components and hidden menu routes; existing desktop administration stays web-focused. Coach selection may show authorized assistant diaries without granting ownership of their hours or feedback. Shared group management is club-wide; feedback is assigned-coach-only.

**Tech stack:** Expo 58 / React Native, shared contracts/presentation helpers, Next API / PostgreSQL.

## Tasks and ownership
- [x] Root: native coaching diary selector for own/authorized assistants; fresh canBook/canEdit flags; restore default week action; group session browser with all coaches, per-session coach/capacity, missing-roster bookings, cancellation and feedback permissions. Add integration/UI checks.
- [x] Round-review worker: native professional round directory/detail/discussion using existing scoped APIs. Own new component/routes/tests only. Root connects it into player rows / menus / hidden tab registration.
- [x] Family worker: clickable dependent Home panels plus native dependant administration through existing authorized APIs. Own new components/routes/Home integration/tests; root changes More menu link.
- [x] Profile worker: native profile/account screen including existing profile photo workflow; root connects More and hidden tab registration. Any native dependency requires Expo-compatible installation and simulator build verification.
- [x] Root: combine route registration, role-safe navigation and any shared contracts; review each task, run full tests/root and mobile TypeScript/native lint.
- [x] Root: deploy required backend changes, refresh/rebuild simulator as needed, verify key populated/loading/empty/error states and tap-through navigation; record remaining intentional limitations explicitly. No phone installation, commit or push.

## Decisions
- Existing modified checkout is retained to preserve all uncommitted feature work; file ownership separates independent tasks.
- Native family/profile/round features remain on current shared Supabase/backend, no separate database or browser sign-in.
- Use isolated local demo data for professional/guardian visual checks; never create live bookings or send messages as part of verification.

## Verification
- Full suite: 776 tests passed; subsequent Home key regression and focused native checks also passed (16 focused checks). Root/mobile TypeScript, native lint and diff checks passed.
- Local fictional-data HTTP checks passed for native bearer login, coach ordering, assistant diary permissions, shared group sessions, professional rounds, dependant summaries and profile fields.
- Production backend deployed at https://www.betterbypar.com (dpl_Az8VdZXLck4ySbCozfvd576ys4Cb).
- iOS simulator rebuilt and signed; verified real saved sign-in, upcoming Home lessons, correct scheduled booking expansion, native Profile with menu retained, and opening/cancelling the system photo picker. Professional/guardian paths were verified through API and component tests rather than manual simulator role navigation.
- Source-build Expo core/photo modules avoid incompatible precompiled native frameworks. The development server remains on 127.0.0.1:8081 with the production API default.
- Temporary QA app removed. No real bookings/profile photos changed, phone installation, commit or push. Android was not device-tested.
