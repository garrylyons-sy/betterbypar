# Round setup layout cleanup

Use the existing checkout; preserve the pending mobile www-domain changes. No commits/pushes without a new explicit request.

- Replace the rounds dropdown with an aligned feature-navigation action, card status and a clearly named discard/reload action. Guard both navigation and discard when edits or pending observations exist.
- On web, choose the sole layout automatically after selecting its club; show layout selection only for multi-layout clubs. Never infer a tee rating category. Use shared, tested singleton-layout selection.
- Replace the web tee dropdown with wrapping selection cards displaying the full tee/category, par, course rating and slope. Add equivalent full-detail native tee cards. Hide duplicate catalogue course/tee inputs; preserve manual and imported cards.
- Use responsive one-column form/card layouts on phones, aligned buttons and compact explanatory text. Preserve saved snapshots, started-card locks and catalogue errors/retry.
- Run root/native TypeScript, native lint, shared and regression tests; verify Castle and multi-layout Grange in a narrow web viewport without saving test rounds. Export native bundles. Deploy the current authorized changes to Vercel without Git mutation, verify the live result, report any limits.
