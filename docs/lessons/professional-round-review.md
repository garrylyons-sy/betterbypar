# Professional round review

Open **Lesson diary → Player rounds** (`/rounds/coaching`) as a professional or assistant professional. The list includes registered players at active clubs where the professional has a noncancelled lesson booking, an active group roster place, or an active challenge/drill assignment. Past noncancelled bookings retain the coaching relationship. An administrator role alone does not grant access to round journals.

Professionals can read completed manual and imported rounds, including round notes, hole notes, shot observations, recorded statistics and already-generated AI/demo feedback. Draft rounds stay private to the player and guardian. Professionals cannot change scores, edit player notes or request AI feedback on the player's behalf. Sample imports remain labelled.

The round discussion supports whole-round and hole-specific comments. Players and active guardians can read and reply in their saved journal under **My Golf → Rounds**, or from a round-review notification. Comments retain their author, timestamp and the round revision reviewed. Editing the round keeps earlier discussion visible with an earlier-version label; comments submitted against an outdated revision are rejected until the page is refreshed.

From a round, **Assign a follow-up challenge or drill** opens the practice libraries with the club/player selected. The new assignment stores its originating round and includes a link back to the review. Changing to another club or player clears that originating context. The server validates the selected round, club, player and professional independently.

Comments notify the player and active guardians when posted by a coach. Player/guardian replies notify current coaches who have participated in that round's discussion. Events use the existing **Coaching and lesson feedback** preferences, so standard eligibility, inbox/push/email choices, quiet hours and delivery rules apply. Notification content is generic; comments are read inside the authenticated app. Both author and recipient access are rechecked before notification delivery. Demo outbound delivery remains disabled.

Apply `supabase/round_coaching.sql` after `coaching_practice.sql` and the existing golf round/notification migrations. It creates server-only RLS-protected discussion storage, coaching access predicates and the optional practice assignment round reference. Local demo startup applies it automatically.

Verification commands: `pnpm typecheck`, `pnpm test`, `node scripts/verify-round-coaching.mjs` against the running local demo. The HTTP smoke test creates and removes only its own disposable records.
