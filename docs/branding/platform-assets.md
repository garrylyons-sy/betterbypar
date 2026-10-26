# Platform identity assets

The product name is **Better By Par**, chosen on 26 October 2026. Platform assets do not replace club-specific logos or colours.

- Platform: forest green, cream flag and gold putting green.
- Admin and club admin: midnight blue, cream flag and gold shield/check.
- Maintenance: warm charcoal, copper wrench and cream detail.

SVG masters and PNG/ICO exports live in public/brand/. Root favicon.ico and favicon-normal.ico use the platform mark. Each area has a distinct four-size ICO (16, 32, 48 and 64 pixels). Apple icons use 180px; PWA icons use 192px and 512px, with a separately padded opaque maskable icon.

Run `pnpm brand:generate` to rebuild all assets deterministically using Sharp. Edit geometry in scripts/generate-brand-assets.mjs, which is the source of truth. No external image service or font requests are required.

The startup screen stays visible until authentication completes and respects reduced-motion preferences. Maintenance is available at /maintenance. Development demo preview: /demo/brand (disabled outside explicit local demo mode).

Verification: all 541 tests passed, TypeScript passed, ICO headers and embedded dimensions checked, and HTTP metadata/favicon checks passed for demo, admin, clubadmin and maintenance. Brand studio splash inspected in browser.

## Club-wide colour configuration

Each club's saved primary and accent colours now drive member pages, Lessons, profile/family screens and club administration. Page tints, cards, borders, text, buttons, navigation, selected states and hover/focus styles use a derived palette. Text foregrounds automatically adapt to dark, light and saturated colours. Warning/error and sports-result colours retain their meaning and their own readable foregrounds; uploaded logos and the platform icon retain their artwork.

Use /clubadmin → Branding for immediate colour preview across the portal. Discard restores saved values; Save publishes the palette. Changing clubs switches the theme to the club being viewed. Open pages refresh saved palettes on focus, navigation or the60second refresh interval. Unsaved preview clears when leaving the editor.

The authorized `/api/club-theme` endpoint returns only active memberships, explicit admin clubs or clubs available to an active platform operator. Client-selected colour context never grants data access. New UI should use semantic CSS variables or Tailwind theme tokens. `lib/club-theme.mjs` derives variables; `components/club-theme-provider.tsx` applies them. Run `pnpm theme:generate` after editing inherited palette utilities; `scripts/generate-theme-utilities.mjs` bridges known inherited/navy and lesson/green classes while preserving semantic backgrounds.

Verified:548tests and TypeScript pass. Local HTTP checks confirm authentication, club scoping, admin save, member refresh and isolation from another club. Browser tests used temporary gold/purple, verified black text on a light main/diary header and white text on a dark purple preview, and verified Discard. Castle's original colours were restored after testing.
