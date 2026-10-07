# League Chair Live Scoring Pilot

## Purpose

Add an isolated live frame-scoring pilot for Interclub League Chairs. A League Chair can open any fixture, record ordinary frame winners using the existing result model, or run a shot-by-shot live scorer. No controls, live state, payload changes, or behavioural changes are exposed to players, managers, club members, or club administrators during the pilot.

## Access boundary

- An active Interclub League Chair and an active platform administrator may read and operate live scoring.
- Access is checked by the server on every request using the existing app session and active-role records. Client-side hiding is not the security boundary.
- The pilot applies across all leagues and clubs because League Chair is an Interclub-wide role.
- All other users retain the current fixture and result-entry experience unchanged. They cannot see that a live session exists.

## User experience

When a League Chair expands a fixture, an additional `League chair controls` section appears. It is closed by default and contains:

1. The existing frame list with home, away, or undecided winner controls, allowing the chair to input or correct an ordinary match result.
2. A `Live score` action beside an undecided frame. Opening it shows a dedicated mobile-first scorer.

The scorer keeps the team and player names, frame totals, active side, current break, connection state, and ball inventory fixed in view. Large controls record pots of 1 through 7, fouls, end of visit, undo, scorer handover, and frame completion. Destructive actions require confirmation.

A second League Chair opening the same frame sees a read-only live scoreboard and can deliberately take over scoring. A short lease prevents two scorers writing concurrently. Takeovers are logged.

## Ball visual and rules state

The table is an inventory visual, not a positional simulator:

- It starts with 15 reds and all six colours.
- A potted red disappears.
- Colours remain while reds remain because they are respotted.
- After the final red and following colour, colours disappear in clearance order.
- The display derives points remaining and whether snookers are required.
- Foul points do not remove balls.
- The scorer can correct the latest action with undo and can explicitly restore/correct ball state when the physical table differs.
- A tied clearance supports a re-spotted black state.

For doubles, the scorer selects which player is currently at the table so completed breaks can be attributed correctly.

## Data model

The pilot adds two tables without changing the meaning of existing match tables.

### `live_frame_session`

One current snapshot per game:

- game and fixture identifiers
- status: `Live`, `Paused`, `Completed`, or `Abandoned`
- home and away frame totals
- active team and active player
- current break
- reds remaining and clearance state
- monotonically increasing version
- scorer lease owner and expiry
- started, updated, completed, and abandoned metadata

Only one non-terminal live session may exist for a game.

### `live_frame_event`

An immutable ordered audit stream:

- session and sequence number
- event type: start, pot, foul, end visit, turn selection, ball correction, undo, takeover, pause, resume, complete, or abandon
- team, player, ball and points where applicable
- state before and after the action
- actor and timestamp

The snapshot makes reads inexpensive; the event stream provides auditability, undo and recovery.

## API and concurrency

A dedicated League Chair API owns all live-scoring operations. It returns only the selected fixture/frame and never adds live data to the existing general fixture endpoints.

Every mutation is transactional and supplies the session version. A stale version returns a conflict and the client reloads the latest state instead of overwriting another scorer. The scorer lease is refreshed while the scoring screen is active and released when paused, completed, abandoned, or explicitly handed over.

For the pilot, League Chair screens fetch the small live snapshot every two seconds while visible. Polling stops when the panel closes or the app is backgrounded. This works with the app's existing cookie authentication and keeps the rollout isolated. The event/snapshot design can later publish the same state through Supabase Realtime without changing scoring semantics.

## Finalising a frame

Live totals are provisional. They do not affect the official match until the scorer chooses `Complete frame` and confirms the winner.

Finalisation occurs in one database transaction:

1. Validate the League Chair, lease, version, frame and winner.
2. Copy the final totals into `game.home_score` and `game.away_score`.
3. Set `game.winner_team_id` through the same result service used by existing score entry.
4. Recalculate the official match score through the existing database result logic.
5. Persist qualifying completed breaks against the game without duplicates.
6. Mark the live session completed and write its final audit event.

An abandoned session leaves the official game and match untouched. Resetting an official result remains available through the League Chair frame controls and is separately logged.

## Failure handling

- Each accepted action is saved server-side before the UI advances.
- A visible `Saved`, `Saving`, `Offline`, or `Score changed elsewhere` indicator communicates state.
- Failed actions remain retryable and do not update the displayed saved totals optimistically.
- Reopening the scorer reconstructs from the saved snapshot; the event stream can repair or audit discrepancies.
- If polling fails, the last score remains visible but controls are disabled until reconnection.
- Completing a frame is idempotent so a repeated request cannot award the frame twice.

## Existing-user isolation

- Existing manager lineup and score-entry APIs retain their current permissions and response shapes.
- Existing player and manager fixture components are not repurposed for live scoring.
- No live tables are queried for users without League Chair/platform access.
- No `LIVE` badge, provisional score or scoring control is rendered for other roles.
- Existing completed-frame and match-result views continue to read only from `game` and `match`.

## Audit logging

Meaningful actions are written to the existing activity log: live session started, scorer takeover, frame paused/resumed, frame completed, session abandoned, and official result corrected. High-frequency pot events remain in `live_frame_event` rather than flooding the administrative activity log.

## Testing and rollout

- Permission tests prove that League Chairs/platform admins can access the pilot and every other role receives `403` without learning whether a live session exists.
- State-machine tests cover reds, colours, fouls, end visits, undo, clearance, tied black, completion and abandonment.
- Transaction tests cover stale versions, scorer leases, duplicate completion and match-score recalculation.
- UI tests cover mobile scorer ergonomics, read-only second-chair view, offline state and closed-by-default controls.
- Existing manager scoring, lineup, fixture and table tests remain unchanged and must continue to pass.

The pilot launches with polling and League Chair-only visibility. Supabase Realtime and broader player/manager scoring are explicitly deferred until the scoring workflow has been exercised in real matches.
