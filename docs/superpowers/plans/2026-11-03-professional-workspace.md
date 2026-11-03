# Professional workspace

Goal: separate coaching roles from player workflows on web and native, and support structured challenge/drill progress reviews.

Professional navigation: Home, Diary, Players, Practice, More. No Record a round, personal handicap, player lesson booking or My Golf while acting as a professional. Professionals and assistants use the same coaching capabilities, scoped to active club membership; only their own diaries/groups/assigned reviews are writable. Platform/club administration remains separate.

- Shared role capabilities and server enforcement: coaches cannot use player-write paths; player views redirect/show coaching alternative. Add coaching overview API for current coach with scoped diary, registered players, own groups.
- Web professional dashboard exposes today/week diary, members, groups, round reviews and practice reviews using existing management screens.
- Native professional workspace provides diary and booking-on-behalf/lesson feedback, player/group management, and practice assignment/review without player capture controls.
- Practice adds par-all-par-threes and maximum-five-per-hole rules alongside no-double-bogeys, seeded library entries and editable club templates. Store coach progress reviews separately from member attestations, authorise current assigned professional/admin, notify players/guardians through standard framework, and display reviews to members.
- Verify role and cross-club permissions, incomplete/missing/pickup score evidence, review targets, web/native workflows, migrations, TypeScript/lint/tests. Apply additive migrations, deploy and prepare/install mobile when available. No commit/push without user request.
