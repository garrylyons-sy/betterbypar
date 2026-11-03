# Vercel deployment

Production: https://betterbypar-platform.vercel.app

Vercel project: `betterbypar-platform` in `garrylyons-shipyardtechs-projects`. This is separate from the older `betterbypar` and `betterbypar-x4kx` projects. The framework is Next.js with Node 24. The website and its APIs use the existing Better By Par Supabase project `bakhooumccmxnylmrwtf`.

The first production deployment was uploaded directly from the current local workspace using the authenticated Vercel CLI. GitHub auto-deployment is not connected: Vercel could not access the private `garrylyons-sy/betterbypar` repository. Nothing was committed or pushed as part of deployment. Connecting the Vercel GitHub app to that repository is a separate account-permission step.

Production configuration is stored in Vercel, not source control:

- `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` are secret environment variables.
- `LOCAL_DEMO=0`.
- `NEXT_PUBLIC_APP_URL` and `APP_URL` use the production origin above.
- `GOOGLE_REDIRECT_URI` uses `/auth/google/callback` on that origin. Google client credentials have not been configured.
- `GOLF_IRELAND_DATA_MODE=demo`, retaining the explicit sample-data labels until API access is configured.
- `ROUND_AI_MODE=off` until live AI credentials are configured.

A verified email sender and delivery credentials are still required for outbound email. Existing app-owned email/password login uses Supabase and works independently of Google or an email sender.

`.vercelignore` excludes local environment files, the local demo database, generated native build folders and local installation artefacts. `.vercel/` holds the local project link and remains ignored by Git.

To deploy the current workspace again:

```sh
npx --yes vercel@latest deploy --prod --yes
```

Run appropriate tests and `npm run build` first. Stop the local Next development process while running a local production build, since both use `.next`, and restart it afterwards. Deployment itself builds remotely and does not require shutting down the local site.

Verified after deployment: production build ready; public homepage HTTP 200; unauthenticated session reports signed out; authenticated administrator session works; Castle is returned with its professional appointment; all five course layouts load; unauthenticated catalogue access is denied; `/demo` returns 404. The existing password works on the production sign-in form, but browser sessions are separate from the local hostname.

The native app can use this same HTTPS origin as its backend. A development build still needs Metro; changing the backend URL alone does not turn it into an independently installed release app.
