# Working style

- When the user requests a feature or says "do it", "build it", "go for it",
  or equivalent, proceed end to end without asking for confirmation.
- Make reasonable product and technical assumptions using existing application
  patterns.
- Do not ask optional design questions or request approval between implementation
  phases.
- Investigate, implement, test, and verify in the same turn.
- Ask a question only when genuinely blocked, or before a destructive,
  irreversible, security-sensitive, or paid external action.
- Do not ask whether to continue with the next obvious part of the requested work.
- Do not commit or push unless explicitly requested.

# Web and native product development

- Treat the Next.js website and Expo iOS/Android app as clients of one product.
- Use `shared/design-system.mjs` for semantic club colours and visual scales;
  web CSS variables adapt it through `lib/club-theme.mjs`, and native components
  consume it through `mobile/src/lib/theme.ts`.
- Put framework-free API contracts and presentation/business rules in `shared/`.
  Enforce permissions and authoritative business rules on the server.
- For customer features, implement and verify both clients in the same task
  unless the user explicitly limits the scope. Keep desktop administration
  web-focused. State any remaining parity gaps explicitly.
- Use the mobile website as the current visual reference. Compare loading,
  empty, error and populated states, pale club palettes, long text and safe areas.
- Run root and mobile TypeScript checks, native lint and relevant shared tests.
  A JavaScript export is not evidence of a device installation or visual check.
