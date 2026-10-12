# Last Man Standing Competition Design

**Date:** 12 October 2026  
**Status:** Approved design, pending implementation plan

## Purpose

Add a standalone Last Man Standing competition to Interclub Snooker. The first release is a League Chair pilot, but the data model and authorization boundaries must support opening individual competitions to players, managers, and club members later. Multiple competitions may run at the same time.

Each entrant chooses two eligible players per round. An entrant remains standing only when both selected players win their frames. Entrants may edit their picks until 12:00 noon on the applicable match day. Missing or invalid picks are replaced deterministically from published lineups. A losing singles player or a player in a losing doubles pair eliminates the entrant.

## Scope

### Included in the pilot

- A standalone Last Man Standing menu option and screen.
- A League Chair home-page panel.
- Self-entry by League Chairs who have an active team role.
- Eligibility derived from the entrant's existing player or manager role.
- Two editable picks per round.
- Pick history and remaining-entrant display.
- Automatic picks for missing selections, lineup omissions, and rescheduled fixtures.
- Automated round settlement from official frame results.
- Multiple concurrent competitions.
- Platform-admin competition and round management.
- Activity logs for picks, substitutions, settlement, reinstatement, and overrides.
- Database audience fields for future wider access.

### Deliberately deferred

- Making the feature visible to ordinary players, managers, or club members.
- Notifications or reminder email.
- Paid entry, prizes, or checkout.
- Public spectator pages.
- Automatic scheduled jobs. Pilot processing is triggered safely by normal reads and explicit admin actions.

## Access Model

The pilot audience is `League Chair`. A person must have League Chair access to see the menu item, home panel, competition list, entry controls, picks, and standings.

Platform administrators manage competitions, schedules, exceptional cases, and round settlement from Admin. League Chair status does not grant competition administration.

Every competition stores its own audience. The initial supported value is `League Chair`; the schema also supports `Everyone` for a later release. Server authorization always enforces the audience even if a client attempts to call the API directly.

## Entrant Tier Resolution

An entrant receives a fixed eligible tier when joining a competition:

1. Active player roles take priority over all manager roles.
2. If there is no active player role, an active manager role is used.
3. A League maps to the A player pool.
4. B League maps to the B player pool.
5. C League teams, including D teams, map to the C player pool.
6. If a person has active player roles in more than one tier, the highest tier is the default and the entry form allows selection from only the tiers justified by their player roles.
7. If a person has only manager roles in more than one tier, the highest tier is the default and the form allows selection from only the tiers justified by their manager roles.
8. The chosen tier is stored on the entry and cannot change after the first round locks.

League Chair status itself never determines the tier. A League Chair without an active player or manager role cannot enter during the pilot and sees a clear eligibility message.

### Future club-member entry

When an `Everyone` audience is enabled in a later release, a club member without a player or manager role chooses one active team from their club while entering. That choice fixes the entry's tier and source team for the whole competition. A club with A, B, and C teams therefore gives its club members three legitimate choices; a club member cannot choose another club or a tier in which their club has no active team. This future path uses the same stored tier and source-team fields as the pilot and requires no schema redesign.

## Competition Lifecycle

Competition status is one of:

- `Draft`: visible only in Admin.
- `Open`: eligible users may enter; configured rounds may accept picks.
- `In Progress`: entry is closed and rounds continue.
- `Complete`: a winner was declared.
- `No Winner`: the configured deciding round eliminated every remaining entrant.
- `Archived`: read-only historical record.

Each competition belongs to one season and has an entry-open timestamp, entry-close timestamp, audience, and configured round sequence. Entrants may join only while the competition is open and before its entry deadline.

## Round Scheduling

A logical competition round has a separate schedule row for each eligible tier. Each tier schedule points to one existing fixture week and records its deadline. This allows the same competition round to use:

- the corresponding A League fixture week,
- the corresponding B League fixture week,
- the corresponding C League fixture week,
- different match dates for those leagues.

The default deadline is 12:00 Europe/Dublin on the scheduled match date for that tier. Admin may configure a different date only by changing the round's mapped fixture week or match date; the time remains noon in the pilot.

If a fixture week contains matches on more than one date, each entrant's deadline is noon on the date of their own team's fixture. Entrants whose team has no fixture use noon on the earliest active fixture date in their tier schedule. Picks remain editable until that entrant-specific deadline.

The round stores a snapshot of league-table order at lock time. Automatic fallback never changes later merely because corrected results alter the table.

## Pick Rules

- Each entrant has exactly two pick slots per round.
- Picks may be created, replaced, or cleared until the entrant-specific deadline.
- The final saved values at the deadline are authoritative.
- The two slots cannot contain the same person.
- A person previously consumed by that entrant in the same competition cannot be selected again.
- Only active, registered players with an active player role in the entry's tier are shown in manual selection.
- Typed guests are never eligible.
- The menu groups players by team and indicates when a team has no active fixture in the round.
- Other entrants' current-round picks remain hidden until their relevant deadline has passed. Historical picks are visible.

A pick is consumed when the round locks, including an automatic replacement. A manually selected player who is replaced before settlement because they did not play is not consumed; the replacement is consumed instead.

## Automatic Replacement Algorithm

Automatic replacement is required when:

- a pick slot is empty at the deadline,
- the selected player is not present in a published lineup for the mapped round,
- the selected player's fixture is cancelled,
- the selected player's fixture is postponed or rescheduled outside the mapped round,
- the selected player becomes ineligible before the deadline.

For each slot requiring a replacement:

1. Start with the entrant's own team in the fixed entry tier.
2. If that team has an active fixture in the mapped round, inspect its published lineup in slot order: game 1 player 1, game 1 player 2 where applicable, then subsequent games in order.
3. Choose the first registered player who belongs to the tier, is not the entrant's other pick, and has not previously been consumed by the entrant.
4. For the second replacement, continue through the same ordered lineup.
5. If the entrant's team is not playing or has no eligible unused player, move to the next team below it in the lock-time league-table snapshot.
6. Continue downward one team at a time. From the bottom, wrap to the top.
7. Stop after every team has been considered once.

Lower-team players playing up are skipped when their registered player role is outside the entry tier. Typed guests are also skipped. If no valid replacement exists, the slot is marked `No Eligible Pick`; it does not eliminate the entrant automatically and requires platform-admin resolution before settlement.

Every automatic decision stores the original selection, effective selection, reason, source fixture, source lineup slot, league-table snapshot, and timestamp.

## Rescheduled Matches

Round membership is based on the configured fixture-week mapping, not merely a calendar week. A match moved outside that mapped round is not used to decide the competition round.

If the move happens before the entrant's deadline, affected picks are replaced at lock time. If the move happens after locking but before a frame result, the affected picks are replaced using the preserved lock-time table and lineup data. A result from the later rescheduled fixture never retroactively settles the old round.

If a match is moved to another date but remains explicitly attached to the same competition round by an administrator, its entrants receive a new noon deadline for that match date. This is an explicit admin action and is logged.

## Outcome And Elimination

The effective picked player is evaluated against the official `game` result:

- Winning a singles frame is a win.
- Losing a singles frame is a loss.
- Being part of a winning doubles pair is a win.
- Being part of a losing doubles pair is a loss.
- An undecided frame keeps the pick and round pending.

An entrant remains standing only when both effective picks win. One or two losses eliminate the entrant at the end of that round. Settlement stores each pick outcome and the exact game used.

Settlement is transactional and idempotent. Re-running it cannot create duplicate replacements, consume players twice, or eliminate an entrant twice.

If an official result is corrected after settlement, a platform administrator may reopen the round. Reopening reverses derived entrant statuses for that round, preserves the audit trail, and then permits a fresh settlement from the corrected official data.

## Winner And No-Winner Rule

- One remaining entrant after a settled round becomes the winner and the competition becomes `Complete`.
- More than one remaining entrant advances to the next configured round.
- If every remaining entrant is eliminated in the deciding round, no winner is declared.
- In that case the competition is marked `No Winner`, and a new cycle may be started in the same competition.
- Starting a new cycle reinstates every original non-withdrawn entrant and clears used-player history for the new cycle while retaining the complete history of the prior cycle.

This treats “everyone is back in again” as a fresh cycle, without deleting the failed cycle or pretending its picks never happened.

## Data Model

Use dedicated tables rather than overloading the existing knockout competition tables.

### `last_man_standing_competition`

Stores season, name, audience, entry timestamps, status, created-by, and timestamps.

### `last_man_standing_round`

Stores competition, cycle number, round number, label, state, opened/locked/settled timestamps, and whether it is the deciding round.

### `last_man_standing_round_schedule`

Stores round, league/tier, fixture-week reference, default match date, and deadline policy.

### `last_man_standing_entry`

Stores competition, person, source role, tier league, source team, status, entered timestamp, eliminated round, and winner flag. One person may enter each competition once.

### `last_man_standing_pick`

Stores entry, round, slot 1 or 2, original person selection, effective person selection, state, automatic reason, source fixture/game/lineup slot, outcome, timestamps, and version. One row exists per entry, round, and slot.

### `last_man_standing_team_order_snapshot`

Stores the table position of every team for a round schedule at lock time. This makes fallback reproducible.

### `last_man_standing_event`

Immutable audit events for entry, pick changes, locks, automatic replacements, outcomes, eliminations, reinstatements, reopenings, and overrides. Payload is structured JSON with actor and timestamp.

Indexes cover competition status, active entries, round state, entrant picks, selected players, and fixture/game references. Foreign keys preserve historical player and fixture identity; records are archived rather than deleted after play begins.

## API And Service Boundaries

Keep rule calculations in focused server modules rather than the large app component:

- eligibility and entrant tier resolution,
- competition/round queries,
- pick validation and mutation,
- deadline calculation,
- deterministic lock and replacement processing,
- result settlement and round reopening,
- authorization and audience checks.

Suggested API surface:

- `GET /api/last-man-standing`
- `POST /api/last-man-standing/entries`
- `GET /api/last-man-standing/[competitionId]`
- `PUT /api/last-man-standing/[competitionId]/picks`
- `GET /api/admin/last-man-standing`
- `POST /api/admin/last-man-standing`
- `PATCH /api/admin/last-man-standing/[competitionId]`
- `POST /api/admin/last-man-standing/[competitionId]/process`
- `POST /api/admin/last-man-standing/[competitionId]/reopen`

Mutations use database transactions and row locking. Pick updates use a version or updated-at check to prevent two devices overwriting one another silently.

## User Experience

### Navigation

Add `Last Man Standing` as its own app page and More-menu option. During the pilot it appears only when `hasLeagueChairAccess` is true. It is not folded into existing club competitions.

### Home panel

The League Chair home panel shows:

- competition name,
- current cycle and round,
- status: open, standing, eliminated, winner, or awaiting result,
- two current picks,
- pick deadline,
- entrants remaining out of total entrants,
- primary action: Enter, Make picks, Change picks, or View competition.

### Competition screen

The screen provides:

- a selector when more than one competition is available,
- current-round summary,
- two compact player selectors grouped by team,
- a clear `Selections editable until 12:00` message,
- saved state and last-updated time,
- previous-pick history,
- standings with remaining/eliminated status,
- current-round picks revealed only after their deadlines,
- automatic-pick labels and reasons.

The initial state is the usable competition screen, not an explanatory landing page.

### Administration

Add a `Last Man Standing` admin section where platform administrators can:

- create and edit competitions,
- set audience and entry window,
- map each round to A, B, and C fixture weeks,
- identify the deciding round,
- inspect entrants, picks, automatic replacements, and unresolved cases,
- process or reopen a round,
- override a pick with a mandatory reason,
- start a new cycle after a no-winner outcome,
- archive a competition.

## Processing Strategy

The pilot does not require cron infrastructure. Processing runs through an idempotent service when:

- an entrant opens the competition after their deadline,
- a League Chair loads standings,
- an administrator opens or processes the competition,
- official game results are saved.

Each trigger attempts only due work and uses row locks so concurrent requests are safe. A future scheduled job can call the same service without changing the rules.

## Error Handling

- A missed deadline returns the locked picks rather than accepting late changes.
- Incomplete or unpublished lineups leave processing pending until fallback can be resolved.
- No eligible replacement creates a visible admin exception, not an automatic elimination.
- Fixture or result corrections require explicit round reopening once settled.
- Inactive or deleted people remain referenced historically but cannot be selected in future rounds.
- APIs return stable machine-readable error codes for deadline, eligibility, duplicate pick, reused player, hidden audience, unresolved fallback, and settled-round conflicts.

## Testing

Tests must cover:

- player-role priority over manager role,
- A, B, C, and D tier mapping,
- multiple legitimate role choices,
- League Chair pilot authorization,
- future audience isolation,
- concurrent competitions,
- pick changes before noon and rejection at noon,
- Europe/Dublin daylight-saving boundaries,
- duplicate and previously used player rejection,
- missing picks and both replacement slots,
- unpublished/absent selected players,
- postponed and rescheduled fixtures,
- lock-time standings order and bottom-to-top wrapping,
- exclusion of typed guests and out-of-tier players,
- singles and doubles wins/losses,
- pending frame results,
- idempotent processing and concurrent requests,
- elimination, winner, no-winner, and new-cycle behavior,
- round reopening after corrected results,
- menu, home panel, privacy, and admin visibility.

## Rollout

1. Apply the additive schema with no visible UI.
2. Deploy server rules and admin management behind League Chair authorization.
3. Create a pilot competition and verify fixture-week mappings.
4. Expose the League Chair menu, home panel, entry, picks, and standings.
5. Run at least one complete pilot cycle and review automatic-pick events.
6. Later enable the stored `Everyone` audience after ordinary-role UX and scale testing.
