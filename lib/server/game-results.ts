import type { PoolClient } from "pg";

export type OfficialGameResultInput = {
  fixtureId: string;
  gameId: string;
  winnerTeamId: string | null;
  homeScore?: number;
  awayScore?: number;
  liveSessionId?: string;
  actorPersonId?: string;
};

export class GameResultError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameResultError";
    this.status = status;
  }
}

export async function recordOfficialGameResult(client: PoolClient, input: OfficialGameResultInput) {
  const result = await client.query<{
    match_id: string;
    home_team_id: string;
    away_team_id: string;
    winner_team_id: string | null;
    home_score: number;
    away_score: number;
  }>(
    `select m.id as match_id,
            f.home_team_id,
            f.away_team_id,
            g.winner_team_id::text,
            g.home_score,
            g.away_score
     from public.match m
     join public.fixture f on f.id = m.fixture_id
     join public.game g on g.match_id = m.id
     where f.id = $1
       and g.id = $2
       and f.status <> 'Completed'
     limit 1
     for update of g`,
    [input.fixtureId, input.gameId]
  );
  const game = result.rows[0];
  if (!game) throw new GameResultError("Game not found for this fixture.", 404);
  if (input.winnerTeamId && input.winnerTeamId !== game.home_team_id && input.winnerTeamId !== game.away_team_id) {
    throw new GameResultError("Winner must be one of the teams in this fixture.");
  }
  if (input.homeScore !== undefined && (!Number.isInteger(input.homeScore) || input.homeScore < 0)) {
    throw new GameResultError("Home frame score must be a non-negative integer.");
  }
  if (input.awayScore !== undefined && (!Number.isInteger(input.awayScore) || input.awayScore < 0)) {
    throw new GameResultError("Away frame score must be a non-negative integer.");
  }

  const liveSession = (await client.query<{ id: string; status: "Live" | "Paused" | "Completed" }>(
    `select id::text, status
     from public.live_frame_session
     where game_id = $1
       and superseded_at is null
       and status in ('Live', 'Paused', 'Completed')
     order by started_at desc
     limit 1`,
    [input.gameId]
  )).rows[0];
  const resultChanged = input.winnerTeamId !== game.winner_team_id
    || (input.homeScore !== undefined && input.homeScore !== game.home_score)
    || (input.awayScore !== undefined && input.awayScore !== game.away_score);

  if (liveSession && liveSession.id !== input.liveSessionId && resultChanged) {
    if (liveSession.status === "Live" || liveSession.status === "Paused") {
      throw new GameResultError("A live scorer is active for this frame. Finish or abandon it before changing the result.", 409);
    }
    await client.query(
      `update public.live_frame_session
       set superseded_at = now(), superseded_by = $2, updated_at = now()
       where id = $1 and superseded_at is null`,
      [liveSession.id, input.actorPersonId ?? null]
    );
    await client.query(
      `delete from public.break
       where source_label = 'live-scoring'
         and source_key like 'live-session:' || $1 || ':break:%'`,
      [liveSession.id]
    );
  }

  await client.query(
    `update public.game
     set home_score = coalesce($3, home_score),
         away_score = coalesce($4, away_score),
         winner_team_id = $5
     where id = $2`,
    [input.fixtureId, input.gameId, input.homeScore ?? null, input.awayScore ?? null, input.winnerTeamId]
  );
  await client.query("select public.refresh_match_team_points($1)", [game.match_id]);
  return game;
}
