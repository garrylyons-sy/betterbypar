# Native login polish

Scope: native iOS/Android login only, using the established BBP navy/blue branding and existing logo. Website already has its public entry design. Retain current auth API, live origin, secure credential storage, offline recovery and dev-only origin override.

- Replace generic Page/Card entry with safe-area and keyboard-aware branded composition: logo, concise hero, invitation badge, white form with persistent labels and clear focused/error states.
- Use existing Ionicons; add password visibility control and keyboard next/go. Retain loading/disabled safeguards and offline reconnect/sign-out controls. Explain invitation activation and club contact without creating self-registration.
- Verify root/mobile TypeScript, mobile lint, iOS/Android exports and simulator empty/focus/password/error/offline-safe rendering. Rebuild/install standalone iPhone app and verify launch if connected. No commit/push.
