import type { PoolClient } from "pg";

import { applyLiveFrameAction, createLiveFrameState } from "@/lib/live-scoring.mjs";
import { dbQuery, withTransaction } from "@/lib/server/db";
import { GameResultError, recordOfficialGameResult } from "@/lib/server/game-results";

const LEASE_SECONDS = 45;

export class LiveScoringError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "LIVE_SCORING_ERROR") {
    super(message);
    this.name = "LiveScoringError";
    this.status = status;
    this.code = code;
  }
}

type LiveState = ReturnType<typeof createLiveFrameState>;

type SessionRow = {
  id: string;
  fixture_id: string;
  game_id: string;
  status: "Live" | "Paused" | "Completed" | "Abandoned";
  state: LiveState;
  version: number;
  scorer_person_id: string | null;
  lease_expires_at: string | null;
  home_team_id: string;
  away_team_id: string;
  game_winner_team_id: string | null;
  home_player_1_id: string | null;
  home_player_2_id: string | null;
  away_player_1_id: string | null;
  away_player_2_id: string | null;
  home_player_1_guest_name: string | null;
  home_player_2_guest_name: string | null;
  away_player_1_guest_name: string | null;
  away_player_2_guest_name: string | null;
};

type GameContext = {
  game_id: string;
  fixture_id: string;
  match_id: string;
  fixture_status: string;
  home_team_id: string;
  away_team_id: string;
  winner_team_id: string | null;
  home_player_1_id: string | null;
  home_player_2_id: string | null;
  away_player_1_id: string | null;
  away_player_2_id: string | null;
  home_player_1_guest_name: string | null;
  home_player_2_guest_name: string | null;
  away_player_1_guest_name: string | null;
  away_player_2_guest_name: string | null;
};

export type LiveScoringInput = {
  action: string;
  fixtureId: string;
  gameId?: string;
  sessionId?: string;
  version?: number;
  winnerTeamId?: string | null;
  activeTeam?: "home" | "away";
  activePlayerId?: string | null;
  team?: "home" | "away";
  playerId?: string;
  value?: number;
  points?: number;
  awardedTo?: "home" | "away";
  homeScore?: number;
  awayScore?: number;
  currentBreak?: number;
  redsRemaining?: number;
  phase?: string;
  expectedBall?: string | number | null;
  coloursRemaining?: number[];
  winner?: "home" | "away";
};

export async function requireLeagueChairScoringAccess(personId: string) {
  const { rows } = await dbQuery<{ can_score: boolean }>(
    `select exists (
       select 1
       from public.club_membership cm
       join public.person p on p.id = cm.person_id and p.active = true
       where cm.person_id = $1
         and cm.active = true
         and cm.role = 'League Chair'
       union
       select 1
       from public.app_operator ao
       join public.person p on p.id = ao.person_id and p.active = true
       where ao.person_id = $1
         and ao.active = true
     ) as can_score`,
    [personId]
  );
  return Boolean(rows[0]?.can_score);
}

export type LiveScoringStatus = {
  fixture_id: string;
  game_id: string;
  game_number: number;
  game_type: string;
  status: "Live" | "Paused";
  state: LiveState;
  scorer_name: string | null;
  active_player_name: string | null;
};

export async function loadLiveScoringStatuses(fixtureIds: string[]) {
  const ids = Array.from(new Set(fixtureIds
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))))
    .slice(0, 50);
  if (!ids.length) return [];

  return (await dbQuery<LiveScoringStatus>(
    `select distinct on (lfs.fixture_id, lfs.game_id)
            lfs.fixture_id::text, lfs.game_id::text, g.game_number, g.game_type::text,
            lfs.status, lfs.state,
            nullif(concat_ws(' ', scorer.first_name, scorer.last_name), '') as scorer_name,
            coalesce(
              nullif(concat_ws(' ', active_player.first_name, active_player.last_name), ''),
              case lfs.state->>'activePlayerId'
                when 'guest:home:1' then g.home_player_1_guest_name
                when 'guest:home:2' then g.home_player_2_guest_name
                when 'guest:away:1' then g.away_player_1_guest_name
                when 'guest:away:2' then g.away_player_2_guest_name
                else null
              end
            ) as active_player_name
     from public.live_frame_session lfs
     join public.fixture f on f.id = lfs.fixture_id
     join public.season s on s.id = f.season_id
     join public.match m on m.fixture_id = f.id
     join public.game g on g.id = lfs.game_id and g.match_id = m.id
     left join public.person scorer on scorer.id = lfs.scorer_person_id
     left join public.person active_player on active_player.id = lfs.active_player_id
     where lfs.fixture_id = any($1::uuid[])
       and lfs.status in ('Live', 'Paused')
       and lfs.superseded_at is null
       and s.active = true
       and f.status <> 'Completed'
       and f.fixture_type = 'League'
       and f.fixture_date >= current_date
     order by lfs.fixture_id, lfs.game_id, lfs.updated_at desc`,
    [ids]
  )).rows;
}

export async function loadLiveScoringDashboard() {
  const fixtures = (await dbQuery<{
    id: string;
    fixture_date: string;
    status: string;
    season_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    home_team_score: number;
    away_team_score: number;
    home_lineup_status: "Draft" | "Published" | null;
    away_lineup_status: "Draft" | "Published" | null;
    has_live_session: boolean;
  }>(
    `select f.id::text, f.fixture_date::text, f.status::text,
            s.name as season_name, l.name as league_name,
            ht.name as home_team_name, at.name as away_team_name,
            m.home_team_score, m.away_team_score,
            hfl.status::text as home_lineup_status,
            afl.status::text as away_lineup_status,
            exists (
              select 1
              from public.live_frame_session lfs
              where lfs.fixture_id = f.id
                and lfs.status in ('Live', 'Paused')
                and lfs.superseded_at is null
            ) as has_live_session
     from public.fixture f
     join public.season s on s.id = f.season_id
     join public.league l on l.id = f.league_id
     join public.team ht on ht.id = f.home_team_id
     join public.team at on at.id = f.away_team_id
     join public.match m on m.fixture_id = f.id
     left join public.fixture_lineup hfl on hfl.fixture_id = f.id and hfl.team_id = f.home_team_id
     left join public.fixture_lineup afl on afl.fixture_id = f.id and afl.team_id = f.away_team_id
     where s.active = true
       and f.status <> 'Completed'
       and f.fixture_type = 'League'
       and (f.fixture_date at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
     order by has_live_session desc, f.fixture_date, l.name, ht.name`,
    []
  )).rows;

  const statuses = await loadLiveScoringStatuses(fixtures.map((fixture) => fixture.id));
  return { fixtures, statuses };
}

export async function loadLiveScoringFixture(fixtureId: string, personId: string) {
  await dbQuery(
    `update public.live_frame_session
     set lease_expires_at = now() + make_interval(secs => $3)
     where fixture_id = $1
       and scorer_person_id = $2
       and status = 'Live'`,
    [fixtureId, personId, LEASE_SECONDS]
  );

  const fixture = (await dbQuery<{
    id: string;
    status: string;
    fixture_date: string;
    league_name: string;
    home_team_id: string;
    home_team_name: string;
    away_team_id: string;
    away_team_name: string;
    home_team_score: number;
    away_team_score: number;
  }>(
    `select f.id::text, f.status::text, f.fixture_date::text, l.name as league_name,
            ht.id::text as home_team_id, ht.name as home_team_name,
            at.id::text as away_team_id, at.name as away_team_name,
            m.home_team_score, m.away_team_score
     from public.fixture f
     join public.league l on l.id = f.league_id
     join public.team ht on ht.id = f.home_team_id
     join public.team at on at.id = f.away_team_id
     join public.match m on m.fixture_id = f.id
     where f.id = $1
     limit 1`,
    [fixtureId]
  )).rows[0];
  if (!fixture) throw new LiveScoringError("Fixture not found.", 404, "NOT_FOUND");

  const games = (await dbQuery<{
    id: string;
    game_number: number;
    game_type: string;
    home_score: number;
    away_score: number;
    winner_team_id: string | null;
    home_player_1_id: string | null;
    home_player_1_name: string | null;
    home_player_1_guest_name: string | null;
    home_player_1_win_percentage: number | null;
    home_player_2_id: string | null;
    home_player_2_name: string | null;
    home_player_2_guest_name: string | null;
    home_player_2_win_percentage: number | null;
    away_player_1_id: string | null;
    away_player_1_name: string | null;
    away_player_1_guest_name: string | null;
    away_player_1_win_percentage: number | null;
    away_player_2_id: string | null;
    away_player_2_name: string | null;
    away_player_2_guest_name: string | null;
    away_player_2_win_percentage: number | null;
  }>(
    `with player_stats as (
       select
         fp.person_id,
         case
           when count(distinct pgr.game_id) > 0 then round(
             100.0 * count(distinct pgr.game_id) filter (where pgr.winner_player_id = fp.person_id)
             / count(distinct pgr.game_id)
           )::int
           else null
         end as win_percentage
       from public.fixture f
       join public.match fixture_match on fixture_match.fixture_id = f.id
       join public.game fixture_game on fixture_game.match_id = fixture_match.id
       cross join lateral (
         values
           (fixture_game.home_player_1_id),
           (fixture_game.home_player_2_id),
           (fixture_game.away_player_1_id),
           (fixture_game.away_player_2_id)
       ) as fp(person_id)
       left join public.player_game_result_view pgr
         on pgr.season_id = f.season_id
        and pgr.league_id = f.league_id
        and (pgr.player_1_id = fp.person_id or pgr.player_2_id = fp.person_id)
       where f.id = $1
         and fp.person_id is not null
       group by fp.person_id
     )
     select g.id::text, g.game_number, g.game_type::text, g.home_score, g.away_score,
            g.winner_team_id::text,
            g.home_player_1_id::text,
            coalesce(nullif(g.home_player_1_guest_name, ''), nullif(concat_ws(' ', hp1.first_name, hp1.last_name), '')) as home_player_1_name,
            g.home_player_1_guest_name,
            hp1_stats.win_percentage as home_player_1_win_percentage,
            g.home_player_2_id::text,
            coalesce(nullif(g.home_player_2_guest_name, ''), nullif(concat_ws(' ', hp2.first_name, hp2.last_name), '')) as home_player_2_name,
            g.home_player_2_guest_name,
            hp2_stats.win_percentage as home_player_2_win_percentage,
            g.away_player_1_id::text,
            coalesce(nullif(g.away_player_1_guest_name, ''), nullif(concat_ws(' ', ap1.first_name, ap1.last_name), '')) as away_player_1_name,
            g.away_player_1_guest_name,
            ap1_stats.win_percentage as away_player_1_win_percentage,
            g.away_player_2_id::text,
            coalesce(nullif(g.away_player_2_guest_name, ''), nullif(concat_ws(' ', ap2.first_name, ap2.last_name), '')) as away_player_2_name,
            g.away_player_2_guest_name,
            ap2_stats.win_percentage as away_player_2_win_percentage
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     join public.game g on g.match_id = m.id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     left join player_stats hp1_stats on hp1_stats.person_id = g.home_player_1_id
     left join player_stats hp2_stats on hp2_stats.person_id = g.home_player_2_id
     left join player_stats ap1_stats on ap1_stats.person_id = g.away_player_1_id
     left join player_stats ap2_stats on ap2_stats.person_id = g.away_player_2_id
     where f.id = $1
     order by g.game_number`,
    [fixtureId]
  )).rows;

  const sessions = (await dbQuery<{
    id: string;
    game_id: string;
    status: string;
    state: LiveState;
    version: number;
    scorer_person_id: string | null;
    scorer_name: string | null;
    lease_expires_at: string | null;
    updated_at: string;
  }>(
    `select distinct on (lfs.game_id)
            lfs.id::text, lfs.game_id::text, lfs.status, lfs.state, lfs.version,
            lfs.scorer_person_id::text,
            concat_ws(' ', scorer.first_name, scorer.last_name) as scorer_name,
            lfs.lease_expires_at::text, lfs.updated_at::text
     from public.live_frame_session lfs
     left join public.person scorer on scorer.id = lfs.scorer_person_id
     where lfs.fixture_id = $1
       and lfs.superseded_at is null
     order by lfs.game_id, lfs.updated_at desc`,
    [fixtureId]
  )).rows.map((session) => ({
    ...session,
    canControl: session.status !== "Completed"
      && session.status !== "Abandoned"
      && session.scorer_person_id === personId,
    canTakeOver: session.status !== "Completed"
      && session.status !== "Abandoned"
      && session.scorer_person_id !== personId
  }));

  return { fixture, games, sessions };
}

async function gameContext(client: PoolClient, fixtureId: string, gameId: string) {
  const result = await client.query<GameContext>(
    `select g.id::text as game_id, f.id::text as fixture_id, m.id::text as match_id,
            f.status::text as fixture_status, f.home_team_id::text, f.away_team_id::text,
            g.winner_team_id::text,
            g.home_player_1_id::text, g.home_player_2_id::text,
            g.away_player_1_id::text, g.away_player_2_id::text,
            g.home_player_1_guest_name, g.home_player_2_guest_name,
            g.away_player_1_guest_name, g.away_player_2_guest_name
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     join public.game g on g.match_id = m.id
     where f.id = $1 and g.id = $2
     limit 1
     for update of g`,
    [fixtureId, gameId]
  );
  const game = result.rows[0];
  if (!game) throw new LiveScoringError("Game not found for this fixture.", 404, "NOT_FOUND");
  if (game.fixture_status === "Completed") throw new LiveScoringError("This match is already completed.", 409, "MATCH_COMPLETED");
  const recordedBreaks = await client.query<{ has_breaks: boolean }>(
    `select exists (
       select 1 from public.break where game_id = $1
     ) as has_breaks`,
    [gameId]
  );
  if (recordedBreaks.rows[0]?.has_breaks) {
    throw new LiveScoringError("Recorded breaks already exist for this frame. Remove them before starting live scoring.", 409, "BREAKS_EXIST");
  }
  return game;
}

function guestParticipantKey(team: "home" | "away", slot: 1 | 2) {
  return `guest:${team}:${slot}`;
}

function databasePersonId(value: string | null | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

type GamePlayers = Pick<GameContext,
  | "home_player_1_id" | "home_player_2_id" | "away_player_1_id" | "away_player_2_id"
  | "home_player_1_guest_name" | "home_player_2_guest_name" | "away_player_1_guest_name" | "away_player_2_guest_name"
>;

function participantKey(game: GamePlayers, team: "home" | "away", slot: 1 | 2) {
  const personId = game[`${team}_player_${slot}_id`];
  const guestName = game[`${team}_player_${slot}_guest_name`];
  return personId ?? (guestName?.trim() ? guestParticipantKey(team, slot) : null);
}

function assertGamePlayer(
  game: GamePlayers,
  team: "home" | "away",
  playerId: string | null | undefined
) {
  if (!playerId) return;
  const allowed = [participantKey(game, team, 1), participantKey(game, team, 2)];
  if (!allowed.includes(playerId)) {
    throw new LiveScoringError("Player is not part of that side in this frame.", 400, "INVALID_PLAYER");
  }
}

async function logActivity(client: PoolClient, personId: string, fixtureId: string, label: string, metadata: Record<string, unknown> = {}) {
  await client.query(
    `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
     values ($1, 'Match Action', '/fixtures', $2, $3::jsonb)`,
    [personId, label, JSON.stringify({ fixture_id: fixtureId, ...metadata })]
  );
}

function eventName(action: string) {
  const names: Record<string, string> = {
    pot: "Pot",
    foul: "Foul",
    endVisit: "EndVisit",
    selectPlayer: "SelectPlayer",
    undo: "Undo",
    correctBalls: "CorrectBalls",
    setState: "CorrectBalls",
    resetFrame: "ResetFrame",
    concede: "Complete",
    respotBlack: "CorrectBalls",
    takeover: "Takeover",
    handover: "Takeover",
    pause: "Pause",
    resume: "Resume",
    complete: "Complete",
    abandon: "Abandon"
  };
  return names[action] ?? "Start";
}

async function saveOfficialGameResult(client: PoolClient, input: Parameters<typeof recordOfficialGameResult>[1]) {
  try {
    return await recordOfficialGameResult(client, input);
  } catch (error) {
    if (error instanceof GameResultError) {
      throw new LiveScoringError(error.message, error.status, "INVALID_RESULT");
    }
    throw error;
  }
}

function eventState(state: LiveState) {
  const { history: _history, ...saved } = state;
  return saved;
}

async function appendEvent(client: PoolClient, session: SessionRow, action: string, personId: string, before: LiveState | null, after: LiveState, input: LiveScoringInput) {
  const teamId = input.team === "home" || input.awardedTo === "home"
    ? session.home_team_id
    : input.team === "away" || input.awardedTo === "away"
      ? session.away_team_id
      : null;
  const eventPlayerId = input.playerId ?? input.activePlayerId ?? null;
  await client.query(
    `insert into public.live_frame_event (
       session_id, sequence_number, event_type, team_id, player_id, ball_value, points,
       state_before, state_after, metadata, created_by
     )
     select $1, coalesce(max(sequence_number), 0) + 1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10
     from public.live_frame_event
     where session_id = $1`,
    [
      session.id,
      eventName(action),
      teamId,
      databasePersonId(eventPlayerId),
      input.value ?? null,
      input.points ?? null,
      before ? JSON.stringify(eventState(before)) : null,
      JSON.stringify(eventState(after)),
      JSON.stringify({ action, participant_key: eventPlayerId }),
      personId
    ]
  );
}

async function lockedSession(client: PoolClient, sessionId: string) {
  const result = await client.query<SessionRow>(
    `select lfs.id::text, lfs.fixture_id::text, lfs.game_id::text, lfs.status, lfs.state, lfs.version,
            lfs.scorer_person_id::text, lfs.lease_expires_at::text,
            f.home_team_id::text, f.away_team_id::text, g.winner_team_id::text as game_winner_team_id,
            g.home_player_1_id::text, g.home_player_2_id::text,
            g.away_player_1_id::text, g.away_player_2_id::text,
            g.home_player_1_guest_name, g.home_player_2_guest_name,
            g.away_player_1_guest_name, g.away_player_2_guest_name
     from public.live_frame_session lfs
     join public.fixture f on f.id = lfs.fixture_id
     join public.game g on g.id = lfs.game_id
     where lfs.id = $1
     limit 1
     for update`,
    [sessionId]
  );
  const session = result.rows[0];
  if (!session) throw new LiveScoringError("Live scoring session not found.", 404, "NOT_FOUND");
  return session;
}

function ensureVersionAndLease(session: SessionRow, input: LiveScoringInput, personId: string) {
  if (session.version !== input.version) {
    throw new LiveScoringError("Live scoring changed elsewhere. Reloading the latest score.", 409, "STALE_VERSION");
  }
  const leaseActive = session.lease_expires_at && new Date(session.lease_expires_at).getTime() > Date.now();
  if (session.scorer_person_id !== personId && leaseActive) {
    throw new LiveScoringError("Another League Chair is currently scoring this frame.", 423, "SCORER_LOCKED");
  }
  if (session.scorer_person_id !== personId) {
    throw new LiveScoringError("Take over scoring before making changes.", 423, "TAKEOVER_REQUIRED");
  }
}

async function saveSession(client: PoolClient, session: SessionRow, state: LiveState, personId: string, status = session.status) {
  const result = await client.query(
    `update public.live_frame_session
     set status = $3,
         home_score = $4,
         away_score = $5,
         active_team_id = case when $6 = 'home' then home_team.id else away_team.id end,
         active_player_id = $7,
         current_break = $8,
         reds_remaining = $9,
         phase = $10,
         state = $11::jsonb,
         version = version + 1,
         scorer_person_id = $12,
         lease_expires_at = now() + make_interval(secs => $13),
         updated_by = $12,
         updated_at = now()
     from public.fixture f
     join public.team home_team on home_team.id = f.home_team_id
     join public.team away_team on away_team.id = f.away_team_id
     where public.live_frame_session.id = $1
       and public.live_frame_session.version = $2
       and f.id = public.live_frame_session.fixture_id`,
    [session.id, session.version, status, state.homeScore, state.awayScore, state.activeTeam, databasePersonId(state.activePlayerId), state.currentBreak, state.redsRemaining, state.phase, JSON.stringify(state), personId, LEASE_SECONDS]
  );
  if (!result.rowCount) throw new LiveScoringError("Live scoring changed elsewhere. Reloading the latest score.", 409, "STALE_VERSION");
}

async function startSession(client: PoolClient, personId: string, input: LiveScoringInput) {
  if (!input.gameId) throw new LiveScoringError("Game is required.");
  const game = await gameContext(client, input.fixtureId, input.gameId);
  if (game.winner_team_id) throw new LiveScoringError("This frame already has a result.", 409, "FRAME_COMPLETED");
  const activeTeam = input.activeTeam ?? "home";
  let state: LiveState;
  try {
    state = createLiveFrameState({ activeTeam, activePlayerId: null });
  } catch (error) {
    throw new LiveScoringError(error instanceof Error ? error.message : "Invalid scoring action.", 400, "INVALID_ACTION");
  }
  try {
    const result = await client.query<SessionRow>(
      `insert into public.live_frame_session (
         fixture_id, game_id, state, active_team_id, active_player_id, scorer_person_id,
         lease_expires_at, started_by, updated_by
       )
       values ($1, $2, $3::jsonb, $4, $5, $6, now() + make_interval(secs => $7), $6, $6)
       returning id::text, fixture_id::text, game_id::text, status, state, version,
                 scorer_person_id::text, lease_expires_at::text,
                 $8::text as home_team_id, $9::text as away_team_id, null::text as game_winner_team_id`,
      [
        input.fixtureId,
        input.gameId,
        JSON.stringify(state),
        activeTeam === "home" ? game.home_team_id : game.away_team_id,
        null,
        personId,
        LEASE_SECONDS,
        game.home_team_id,
        game.away_team_id
      ]
    );
    const session = result.rows[0];
    await appendEvent(client, session, "start", personId, null, state, input);
    await logActivity(client, personId, input.fixtureId, "Started live scoring", { game_id: input.gameId, session_id: session.id });
    return session.id;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new LiveScoringError("A live session already exists for this frame.", 409, "SESSION_EXISTS");
    }
    throw error;
  }
}

async function persistBreaks(client: PoolClient, session: SessionRow, state: LiveState) {
  const breaks = [...(state.breaks ?? [])];
  if (state.currentBreak > 0 && state.activePlayerId) {
    breaks.push({ team: state.activeTeam, playerId: state.activePlayerId, value: state.currentBreak });
  }
  for (const [index, completedBreak] of breaks.entries()) {
    const breakValue = Number(completedBreak.value);
    const playerId = databasePersonId(completedBreak.playerId);
    if (!playerId || breakValue < 30) continue;
    const sourceKey = `live-session:${session.id}:break:${index}:${completedBreak.playerId}:${breakValue}`;
    await client.query(
      `insert into public.break (game_id, player_id, break_value, source_label, source_key)
       values ($1, $2, $3, 'live-scoring', $4)
       on conflict (source_key) do nothing`,
      [session.game_id, playerId, breakValue, sourceKey]
    );
  }
}

export async function performLiveScoringAction(personId: string, input: LiveScoringInput) {
  if (!input.fixtureId) throw new LiveScoringError("Fixture is required.");

  await withTransaction(async (client) => {
    if (input.action === "recordResult") {
      if (!input.gameId) throw new LiveScoringError("Game is required.");
      await saveOfficialGameResult(client, {
        fixtureId: input.fixtureId,
        gameId: input.gameId,
        winnerTeamId: input.winnerTeamId ?? null,
        actorPersonId: personId
      });
      await logActivity(client, personId, input.fixtureId, "Recorded League Chair game result", {
        game_id: input.gameId,
        winner_team_id: input.winnerTeamId ?? null
      });
      return;
    }
    if (input.action === "start") {
      await startSession(client, personId, input);
      return;
    }
    if (!input.sessionId || !Number.isInteger(input.version)) {
      throw new LiveScoringError("Session and version are required.");
    }

    const session = await lockedSession(client, input.sessionId);
    if (session.fixture_id !== input.fixtureId) throw new LiveScoringError("Live scoring session not found.", 404, "NOT_FOUND");
    if (input.action === "complete" && session.status === "Completed") return;
    if (session.status === "Completed" || session.status === "Abandoned") {
      throw new LiveScoringError("This live session is closed.", 409, "SESSION_CLOSED");
    }
    if (input.action === "takeover") {
      if (session.version !== input.version) {
        throw new LiveScoringError("Live scoring changed elsewhere. Reloading the latest score.", 409, "STALE_VERSION");
      }
      await client.query(
        `update public.live_frame_session
         set scorer_person_id = $3, lease_expires_at = now() + make_interval(secs => $4),
             version = version + 1, updated_by = $3, updated_at = now()
         where id = $1 and version = $2`,
        [session.id, session.version, personId, LEASE_SECONDS]
      );
      await appendEvent(client, session, "takeover", personId, session.state, session.state, input);
      await logActivity(client, personId, input.fixtureId, "Took over live scoring", { session_id: session.id, game_id: session.game_id });
      return;
    }

    if (input.action === "handover") {
      ensureVersionAndLease(session, input, personId);
      await client.query(
        `update public.live_frame_session
         set scorer_person_id = null, lease_expires_at = null,
             version = version + 1, updated_by = $3, updated_at = now()
         where id = $1 and version = $2`,
        [session.id, session.version, personId]
      );
      await appendEvent(client, session, "handover", personId, session.state, session.state, input);
      await logActivity(client, personId, input.fixtureId, "Released live scoring", { session_id: session.id, game_id: session.game_id });
      return;
    }

    ensureVersionAndLease(session, input, personId);
    const before = session.state;

    if (input.action === "abandon") {
      await client.query(
        `update public.live_frame_session
         set status = 'Abandoned', version = version + 1, abandoned_by = $3, abandoned_at = now(),
             lease_expires_at = null, updated_by = $3, updated_at = now()
         where id = $1 and version = $2`,
        [session.id, session.version, personId]
      );
      await appendEvent(client, session, "abandon", personId, before, before, input);
      await logActivity(client, personId, input.fixtureId, "Abandoned live scoring", { session_id: session.id, game_id: session.game_id });
      return;
    }

    if (input.action === "pause" || input.action === "resume") {
      const nextStatus = input.action === "pause" ? "Paused" : "Live";
      await saveSession(client, session, before, personId, nextStatus);
      if (nextStatus === "Paused") {
        await client.query(
          `update public.live_frame_session
           set lease_expires_at = null
           where id = $1`,
          [session.id]
        );
      }
      await appendEvent(client, session, input.action, personId, before, before, input);
      await logActivity(client, personId, input.fixtureId, input.action === "pause" ? "Paused live scoring" : "Resumed live scoring", { session_id: session.id, game_id: session.game_id });
      return;
    }

    if (session.status !== "Live") throw new LiveScoringError("Resume this session before scoring.", 409, "SESSION_PAUSED");
    if (input.action === "complete") {
      const state = before;
      if (state.status !== "Ready" || !state.winner) {
        throw new LiveScoringError("Finish the frame or record a concession before completing it.", 409, "FRAME_NOT_READY");
      }
      const winnerTeamId = state.winner === "home" ? session.home_team_id : session.away_team_id;
      await saveOfficialGameResult(client, {
        fixtureId: input.fixtureId,
        gameId: session.game_id,
        winnerTeamId,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        liveSessionId: session.id,
        actorPersonId: personId
      });
      await persistBreaks(client, session, state);
      await client.query(
        `update public.live_frame_session
         set status = 'Completed', version = version + 1, completed_by = $3, completed_at = now(),
             lease_expires_at = null, updated_by = $3, updated_at = now()
         where id = $1 and version = $2`,
        [session.id, session.version, personId]
      );
      await appendEvent(client, session, "complete", personId, before, before, input);
      await logActivity(client, personId, input.fixtureId, "Completed live-scored frame", { session_id: session.id, game_id: session.game_id, winner_team_id: winnerTeamId });
      return;
    }

    if ((input.action === "pot" || input.action === "selectPlayer") && input.team) {
      assertGamePlayer(session, input.team, input.playerId);
    }
    if (input.action === "setState" && input.activeTeam) {
      assertGamePlayer(session, input.activeTeam, input.activePlayerId);
    }

    const action = input.action === "setState"
      ? {
          type: "setState",
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          activeTeam: input.activeTeam,
          activePlayerId: input.activePlayerId,
          currentBreak: input.currentBreak,
          redsRemaining: input.redsRemaining,
          phase: input.phase,
          expectedBall: input.expectedBall,
          coloursRemaining: input.coloursRemaining
        }
      : input.action === "correctBalls"
      ? {
          type: "correctBalls",
          redsRemaining: input.redsRemaining,
          phase: input.phase,
          expectedBall: input.expectedBall,
          coloursRemaining: input.coloursRemaining
        }
      : input.action === "pot"
        ? { type: "pot", team: input.team, playerId: input.playerId, value: input.value }
        : input.action === "foul"
          ? { type: "foul", awardedTo: input.awardedTo, points: input.points }
          : input.action === "selectPlayer"
            ? { type: "selectPlayer", team: input.team, playerId: input.playerId }
            : input.action === "concede"
              ? { type: "concede", winner: input.winner }
              : input.action === "respotBlack"
                ? { type: "respotBlack" }
            : { type: input.action };
    let after: LiveState;
    try {
      after = applyLiveFrameAction(before, action);
    } catch (error) {
      throw new LiveScoringError(error instanceof Error ? error.message : "Invalid scoring action.", 400, "INVALID_ACTION");
    }
    await saveSession(client, session, after, personId);
    await appendEvent(client, session, input.action, personId, before, after, input);
  });

  return loadLiveScoringFixture(input.fixtureId, personId);
}
