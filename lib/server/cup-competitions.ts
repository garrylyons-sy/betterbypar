import type { PoolClient } from "pg";

import { buildCupBracket } from "@/lib/server/cup-draw.mjs";

export function cupRoundName(roundNumber: number, totalRounds: number) {
  const teamsAtStart = 2 ** (totalRounds - roundNumber + 1);
  if (teamsAtStart === 2) return "Final";
  if (teamsAtStart === 4) return "Semi Final";
  if (teamsAtStart === 8) return "Quarter Final";
  return `Round of ${teamsAtStart}`;
}

export async function materializeCupTieFixture(client: PoolClient, tieId: string, actorPersonId: string) {
  const result = await client.query<{
    tie_id: string;
    fixture_id: string | null;
    fixture_date: string;
    season_id: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_league_id: string | null;
  }>(
    `select
       ct.id as tie_id,
       ct.fixture_id,
       cr.fixture_date::text,
       cc.season_id,
       ct.home_team_id,
       ct.away_team_id,
       ht.league_id as home_league_id
     from public.cup_competition_tie ct
     join public.cup_competition_round cr on cr.id = ct.competition_round_id
     join public.cup_competition cc on cc.id = cr.competition_id
     left join public.team ht on ht.id = ct.home_team_id
     where ct.id = $1
     for update of ct`,
    [tieId]
  );
  const tie = result.rows[0];
  if (!tie || tie.fixture_id || !tie.home_team_id || !tie.away_team_id || !tie.home_league_id) return tie?.fixture_id ?? null;

  const fixture = await client.query<{ id: string }>(
    `insert into public.fixture (
       season_id, league_id, fixture_date, home_team_id, away_team_id, status, fixture_type
     )
     values (
       $1, $2, ($3::date + time '19:30') at time zone 'Europe/Dublin', $4, $5, 'Scheduled', 'Cup'
     )
     returning id`,
    [tie.season_id, tie.home_league_id, tie.fixture_date, tie.home_team_id, tie.away_team_id]
  );
  const fixtureId = fixture.rows[0].id;
  await client.query(
    `insert into public.match (fixture_id, entered_by, entered_at)
     values ($1, $2, now())`,
    [fixtureId, actorPersonId]
  );
  await client.query(
    `update public.cup_competition_tie
     set fixture_id = $2, status = 'Scheduled', updated_at = now()
     where id = $1`,
    [tieId, fixtureId]
  );
  return fixtureId;
}

async function placeCupWinner(client: PoolClient, sourceTieId: string, winnerTeamId: string, actorPersonId: string) {
  const target = await client.query<{ id: string }>(
    `update public.cup_competition_tie
     set home_team_id = case when home_source_tie_id = $1 then $2 else home_team_id end,
         away_team_id = case when away_source_tie_id = $1 then $2 else away_team_id end,
         updated_at = now()
     where home_source_tie_id = $1 or away_source_tie_id = $1
     returning id`,
    [sourceTieId, winnerTeamId]
  );
  for (const row of target.rows) {
    await materializeCupTieFixture(client, row.id, actorPersonId);
  }
}

export async function performCupDraw(client: PoolClient, competitionId: string, actorPersonId: string) {
  const competitionResult = await client.query<{ round_count: number; status: string }>(
    `select round_count, status
     from public.cup_competition
     where id = $1
     for update`,
    [competitionId]
  );
  const competition = competitionResult.rows[0];
  if (!competition) throw new Error("Cup competition not found.");
  if (competition.status !== "Draft") throw new Error("This cup draw has already been performed.");

  const teamIds = (await client.query<{ team_id: string }>(
    `select team_id
     from public.cup_competition_entry
     where competition_id = $1
     order by created_at, team_id`,
    [competitionId]
  )).rows.map((row) => row.team_id);
  const bracket = buildCupBracket({ teamIds, roundCount: competition.round_count });
  const rounds = (await client.query<{ id: string; round_number: number }>(
    `select id, round_number
     from public.cup_competition_round
     where competition_id = $1
     order by round_number`,
    [competitionId]
  )).rows;
  if (rounds.length !== competition.round_count) throw new Error("Cup round dates are incomplete.");

  const tieIds = new Map<string, string>();
  for (const tie of bracket) {
    const round = rounds.find((item) => item.round_number === tie.roundNumber);
    if (!round) throw new Error("Cup round not found.");
    const previousRound = tie.roundNumber - 1;
    const homeSourceTieId = tie.homeSourceMatchNumber ? tieIds.get(`${previousRound}:${tie.homeSourceMatchNumber}`) ?? null : null;
    const awaySourceTieId = tie.awaySourceMatchNumber ? tieIds.get(`${previousRound}:${tie.awaySourceMatchNumber}`) ?? null : null;
    const inserted = await client.query<{ id: string }>(
      `insert into public.cup_competition_tie (
         competition_round_id, match_number, home_team_id, away_team_id,
         home_source_tie_id, away_source_tie_id, winner_team_id, status
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        round.id,
        tie.matchNumber,
        tie.homeTeamId,
        tie.awayTeamId,
        homeSourceTieId,
        awaySourceTieId,
        tie.winnerTeamId,
        tie.status
      ]
    );
    tieIds.set(`${tie.roundNumber}:${tie.matchNumber}`, inserted.rows[0].id);
  }

  for (const tie of bracket.filter((item) => item.status === "Bye" && item.winnerTeamId)) {
    const tieId = tieIds.get(`${tie.roundNumber}:${tie.matchNumber}`);
    if (tieId) await placeCupWinner(client, tieId, tie.winnerTeamId!, actorPersonId);
  }
  for (const tie of bracket.filter((item) => item.status === "Scheduled")) {
    const tieId = tieIds.get(`${tie.roundNumber}:${tie.matchNumber}`);
    if (tieId) await materializeCupTieFixture(client, tieId, actorPersonId);
  }

  await client.query(
    `update public.cup_competition
     set status = 'In Progress', updated_at = now()
     where id = $1`,
    [competitionId]
  );
}

export async function advanceCupFixture(client: PoolClient, fixtureId: string, actorPersonId: string) {
  const result = await client.query<{
    tie_id: string;
    competition_id: string;
    round_number: number;
    round_count: number;
    home_team_id: string;
    away_team_id: string;
    home_team_score: number;
    away_team_score: number;
    current_winner_team_id: string | null;
  }>(
    `select
       ct.id as tie_id,
       cc.id as competition_id,
       cr.round_number,
       cc.round_count,
       f.home_team_id,
       f.away_team_id,
       m.home_team_score,
       m.away_team_score,
       ct.winner_team_id as current_winner_team_id
     from public.cup_competition_tie ct
     join public.cup_competition_round cr on cr.id = ct.competition_round_id
     join public.cup_competition cc on cc.id = cr.competition_id
     join public.fixture f on f.id = ct.fixture_id
     join public.match m on m.fixture_id = f.id
     where ct.fixture_id = $1
       and f.fixture_type = 'Cup'
       and f.status = 'Completed'
     for update of ct`,
    [fixtureId]
  );
  const tie = result.rows[0];
  if (!tie) return null;
  if (tie.home_team_score === tie.away_team_score) throw new Error("A cup tie cannot finish level.");
  const winnerTeamId = tie.home_team_score > tie.away_team_score ? tie.home_team_id : tie.away_team_id;
  if (tie.current_winner_team_id === winnerTeamId) return winnerTeamId;

  await client.query(
    `update public.cup_competition_tie
     set winner_team_id = $2, status = 'Completed', updated_at = now()
     where id = $1`,
    [tie.tie_id, winnerTeamId]
  );

  if (tie.round_number === tie.round_count) {
    await client.query(
      `update public.cup_competition
       set status = 'Complete', updated_at = now()
       where id = $1`,
      [tie.competition_id]
    );
  } else {
    await placeCupWinner(client, tie.tie_id, winnerTeamId, actorPersonId);
  }
  return winnerTeamId;
}
