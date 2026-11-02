# Better By Par: website and mobile app

Better By Par is one product delivered through a responsive website and separate iOS/Android apps built with React Native. The website remains a full customer experience on desktop, tablet and mobile; it is not only an administration portal. This confirms the original React Native direction.

## Shared product

One account, club identity, role model, player profile and Golf Ireland number are used across clients. Lessons, group bookings, dependants, rounds, coaching discussion, challenges, drills and notification preferences use the same backend records and authorization. Actions taken on either client become visible on the other after refresh/synchronization. Club branding applies consistently across both.

The member and professional feature set belongs on both the website and mobile app. Platform and club administration remain primarily web workflows, while professionals can manage their coaching day from either client. The second-hand club store remains scaffolding only until separately implemented.

## Client experiences

- Website: keep the existing Next.js client, responsive content and desktop navigation. Mobile browsers retain the bottom app menu.
- Mobile app: build the React Native client for iOS and Android, with native navigation, safe-area handling and platform media/notification integration. It is a separate client, rather than a wrapper around the website.
- Shared menu concepts: Home, My Golf, Lessons, Club and More. Screen transitions, gestures and layout should fit each platform rather than requiring identical markup.

## Backend boundary

Supabase PostgreSQL remains the shared data store. The current app-owned server/API layer enforces club, professional, player and guardian access. Native clients must not bypass these checks or receive database/service credentials.

Share portable domain policies and API contracts where appropriate. Keep Next.js, browser DOM, cookie handling and React Native UI dependencies out of shared domain logic. Preserve versioned round edits, duplicate-safe mutations and access revalidation for all clients.

## Current implementation and remaining work

The current running implementation is the responsive website, with an installable PWA manifest and service worker. An installed PWA is not the planned React Native application, and a first React Native client is now implemented in `mobile/` for sign-in, summaries and practice logging. It has not been installed on a device or published.

The [mobile implementation guide](../../mobile/README.md) records the working first slice and remaining native screens. The roadmap is:

1. Define and implement mobile-compatible sign-in, session expiry and revocation. Current authentication uses browser cookies; do not assume that exposing the existing cookie session as a bearer token is safe.
2. Establish shared API contracts/domain modules and a React Native client using those APIs. Start with sign-in, branding and the five main navigation sections, then add working feature flows.
3. Add native push registration and dispatch alongside the existing web push/email delivery paths, using the same person-level event and channel preferences. Native notifications must open the appropriate authenticated screen.
4. Add native media, profile image uploads, deep links and lifecycle refresh behaviour. Do not claim offline editing support until synchronization and conflict handling exist.
5. Verify on physical iOS/Android devices and desktop/mobile browsers. Configure the separate production Supabase account and app-store distribution when those accounts are available.

These are implementation stages, not features already delivered. No app-store accounts, paid services, publishing or additional production access are configured by recording this direction.
