# Golf player registration

Player registration is separate from club access and login. A registered player has `person.is_golf_player = true` and a unique `golf_ireland_number`. Numbers are stored as text, preserving leading zeroes. The application accepts digits up to 20 characters; this is a local identifier check, not a Golf Ireland lookup.

In Admin → People, mark a person as **Registered player** and enter their number. A player need not have a login or email, so this also supports junior dependants. Non-playing guardians and administrators can keep club access with the box unchecked. The same fields are available for new invitations and bulk import. Existing people's invitation/resend flows retain their registration. The number is visible on the player's profile, in the guardian's dependant view, and in the administrator's People list/search; it is not added to member-facing availability responses.

Golf Professionals and Assistant Professionals are coaching staff and cannot hold registered-player or team Player roles, even if they retain generic Club Member access. Assigning a coaching role removes player registration and active Player/roster roles, revokes relationships where that person is the dependant (not relationships where they are a guardian), cancels future lessons where they were an attendee, and clears those reminders. Removing player registration performs the same cleanup. Historical bookings and results remain available.

The shared SQL functions `is_golf_coach(person_id)` and `is_golf_player(person_id, club_id)` govern active player candidates. Member/guardian selectors, professional booking, group rosters, active team rosters, lineup and guest selection, competition entry, ladders and Last Man Standing candidates enforce this policy on reads and writes. General people directories, officer appointments and historical results remain intact.

Apply `supabase/golf_players.sql` after all lesson migrations, including `lesson_groups.sql`. Existing contacts remain non-playing until registered with a genuine number; the migration never invents numbers for real people. Local demo accounts and Casey Parker receive clearly fictional `999…` identifiers during setup. Demo professionals remain unregistered.

Verification: `pnpm test`, `pnpm typecheck`, and `node scripts/verify-golf-players.mjs`. The HTTP check uses only the localhost demo and cleans up its temporary player and invitation. To reapply the migration while developing locally, use `--apply-migration`.
