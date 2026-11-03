# Lesson booking flow implementation plan

Goal: choose a professional before browsing dates/times, use aligned time grids, and open booking details directly without scrolling past other coaches.
Architecture: shared selected-coach filtering; web native HTML dialog and React Native modal reuse existing booking inputs and server actions. Keep groups, privacy, capacity, player selection and unsaved-draft guards.

- [x] Add shared selected-professional filtering and regression tests for no selection, named coach and groups.
- [x] Replace all-professional view with explicit role/name/club coach choices on both clients. Dates and slots appear only after selection.
- [x] Equal grid columns and button heights; move confirmation form to accessible modal/sheet with safe keyboard/scroll behavior and discard guards.
- [x] Run shared/API tests, root/mobile TypeScript, native lint, UI review at phone width; build/deploy/install as available. Do not commit or push.

Verification: 695 tests passed; root/mobile TypeScript and native lint passed; Android Hermes export succeeded. Isolated sample-data UI at 390px verified explicit professional selection, aligned slots, immediate booking sheet, successful booking and Scheduled detail. Reviewer issues (sheet persistence during save, long group labels) corrected and rechecked. No live booking created during verification.
Rollout: final website deployment dpl_5jhWNQKd2D2onntnxoQiPkSbFDkA READY at www.betterbypar.com. iPhone redesign installed successfully; final tiny success-message reset build compiled at /private/tmp/bbp-lesson-flow-ios/BetterByPar.app but phone disconnected before final installation. Reconnect request pending. No commit/push performed.
Follow-up: final compiled build installed successfully on reconnected iPhone using devicectl; bundle com.betterbypar.mobile. Installation verified by device response.
