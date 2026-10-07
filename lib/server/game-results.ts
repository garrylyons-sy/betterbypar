import type { PoolClient } from "pg";

export type OfficialGameResultInput = {
  fixtureId: string;
  gameId: string;
  winnerTeamId: string | null;
  homeScore?: number;
  awayScore?: number;
};

export async function recordOfficialGameResult(client: PoolClient, input: OfficialGameResultInput) {
  const result = await client.query<{ match_id: string; home_team_id: string; away_team_id: string }>(
    `select m.id as match_id,
            f.home_team_id,
            f.away_team_id
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
  if (!game) throw new Error("Game not found for this fixture.");
  if (input.winnerTeamId && input.winnerTeamId !== game.home_team_id && input.winnerTeamId !== game.away_team_id) {
    throw new Error("Winner must be one of the teams in this fixture.");
  }
  if (input.homeScore !== undefined && (!Number.isInteger(input.homeScore) || input.homeScore < 0)) {
    throw new Error("Home frame score must be a non-negative integer.");
  }
  if (input.awayScore !== undefined && (!Number.isInteger(input.awayScore) || input.awayScore < 0)) {
    throw new Error("Away frame score must be a non-negative integer.");
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
