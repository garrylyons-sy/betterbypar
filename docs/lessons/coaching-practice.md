# Challenges and drills

Professionals and assistant professionals can open **Challenges & drills** from the lesson diary (`/practice/manage`). Platform and club administrators have separate **Challenges** and **Drills** tabs. Players find their plan under **My Golf → Practice**, or `/practice`. Guardians can switch to their linked player.

## Libraries and assignments

Challenges and drills have separate database tables. Starter challenges include no three-putts, no double bogeys, no lost balls and Break 90. Starter drills include putting gate, distance ladder and landing-zone chipping, with labelled animated demonstrations. Coaches can create club templates or copy starter templates, then edit or archive their club's versions.

Assign a library item to a registered player, with a start date, optional due date and personal coaching notes. Challenges specify 9 or 18 holes; drills specify a target number of practice sessions. Instructions are copied into each assignment so later library edits do not change a player's existing plan. A professional assigns as themselves; administrators may assign on behalf of an active professional. Coaches can review club assignments and progress, but only the assigned coach or an administrator can cancel an assignment.

## Evidence and progress

Players and active guardians can check a completed saved round, attest to facts missing from the card, or log completed drill sessions with date, duration and notes. Recorded dates must fall within the assignment period and cannot be in the future.

- No three-putts uses player-entered putt counts. These are labelled player observations even on a Golf Ireland card.
- No double bogeys needs strokes and par on every hole. Missing par requires attestation.
- No lost balls requires attestation; penalties alone do not establish lost balls.
- Gross targets can use the immutable imported gross score. Known scores exceeding the target already prove failure, even when another hole has no score.
- Sample Golf Ireland cards are labelled as sample evidence. They are not live Golf Ireland verification.

Incomplete cards cannot automatically pass. A known scorecard failure cannot be overridden by attestation. Changing a linked round marks the old result as stale until checked again. The practice progress API exposes challenge outcomes and submitted practice notes. Related professionals can separately review completed journals through the [professional round review](professional-round-review.md) interface; drafts stay private. Duplicate request keys are safe to retry; using a saved key with changed details is rejected.

Drills have a description, ordered steps, duration, optional repetitions and success criteria, and a demonstration link. Supported links are YouTube, Vimeo, HTTPS MP4/WebM or the built-in animations. External media loads only when the player chooses to play it. The app does not fetch arbitrary remote URLs on the server or accept embedded HTML.

## Notifications

Assignment and completed-progress events use the existing **Coaching and lesson feedback** preference category. The standard framework determines inbox, push and email delivery, including no notification, quiet hours and current recipient eligibility. Guardian access, cancelled assignments, active coach membership and round revision are rechecked before delivery. Local demo email and push delivery remain disabled.

## Database setup

Apply `supabase/coaching_practice.sql` after the existing golf-round and notification migrations. It creates the two library tables, assignment snapshots, challenge attempts and drill sessions, with RLS and no direct anonymous/authenticated table access. The server API enforces club, professional, player and guardian access. Local demo startup applies this migration automatically.

Verification: `pnpm typecheck`, `pnpm test`, and `node scripts/verify-coaching-practice.mjs` (running local app/database). The smoke test removes its own temporary records. Browser walkthroughs additionally cover professional assignment, guardian attestation and in-app demo/session logging.
