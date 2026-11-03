# Golf Project round capture reuse

**Goal:** Adapt the earlier Golf Project's focused start/hole capture experience into Better By Par on web and native.
**Source:** /Users/garrylyons/Documents/Golf project/app.js and styles.css (COURSE_SEEDS, outcomes, shotFeedbackControls, scoreOnlyRoundView, inferredShotMode, defaultClubForShot).
**Architecture:** Extract portable course presets, shot choices and scoring transitions into shared/round-capture.mjs. Add backward-compatible optional entryMode to round JSON normalization. Render separate web/native capture components with setup, capture and card/review steps; reuse existing APIs and persistence/revision/access rules. No direct DOM/local-state storage transplant, separate backend, GPS permission, match subsystem or new dependency.
**Design:** Compact navy hole header, horizontal hole strip, score stepper, full shot/putt switch, club chips, outcome grid, editable shot timeline/undo, bottom Previous/Next/Review actions. Use shared subtle corner tokens; no top Back buttons. Keep score-only coaching available according to existing backend policy, without promising shot-level detail. Pickup stays no completed score, rather than the source's artificial par+3 score. Preset layouts are labelled saved reference layouts and never applied to imports. Keep existing manual/unknown course entry and 9/18 holes.
**Ruling:** Continue in current checkout to preserve running demo and all uncommitted work; no commit/push. Standing AGENTS instructions waive design questions. Use planning and subagent-driven implementation for independent web/native renderers; parent owns shared rules/backend compatibility and final checks.

- [x] Shared capture rules, original-source presets, backward-compatible entry mode and regression tests.
- [x] Web focused setup/capture/card experience, preserving imported notes, saves, AI/discussion.
- [x] Native matching capture experience and draft/scope/revision safeguards.
- [x] Independent review, root/native checks, tests, iOS/Android bundles and local browser/native inspection.

Validation focus: empty scores never become a fabricated par, unknown optional stats remain unknown, hazards/OB count a physical shot plus explicit penalty, pickup is not a gross score, adding/removing shots doesn't silently overwrite an existing score, imports never get overwritten, state is isolated by player/round, unsaved changes and failed saves remain recoverable.

## Verification and review

659 automated tests pass, including nine new capture-transition tests observed failing before implementation/fixes. Root/native TypeScript and native lint pass. Local-demo HTTP journeys confirm entryMode survives create/edit alongside booking, import, revision conflict, AI, discussion and practice checks; disposable data was cleaned. iOS and Android Hermes bundles export. Browser checks cover Castle preset, Driver-to-Iron default, automatic putting after On green, holed score, score-only stepper and combined review card. iPhone simulator checks confirm setup/preset/capture header and bottom navigation; simulator scrolling automation was unreliable, so full native on-course interaction is not claimed.

Independent reviews fixed undo statistics preservation, nine-to-eighteen preset expansion, back-nine shrink confirmation, imported Stableford points, next-shot default club, configurable hero contrast and pending-note scope guards. Pending notes/directions are retained by hole and protected when changing player/club/history. First save retains capture state. Native shot stage was compacted after visual inspection to bring outcome controls closer. No commit or push performed.
