import { dbQuery } from "@/lib/server/db";

export type FixturePlayerWinPercentages = Map<string, number>;

function percentageKey(fixtureId: string, personId: string) {
  return `${fixtureId}:${personId}`;
}

export async function loadFixturePlayerWinPercentages(fixtureIds: string[]): Promise<FixturePlayerWinPercentages> {
  const ids = Array.from(new Set(fixtureIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const { rows } = await dbQuery<{
    fixture_id: string;
    person_id: string;
    win_percentage: number | null;
  }>(
    `with selected as (
       select distinct
         f.id as fixture_id,
         f.season_id,
         f.league_id,
         player.person_id
       from public.fixture f
       join public.match m on m.fixture_id = f.id
       join public.game g on g.match_id = m.id
       cross join lateral (
         values
           (g.home_player_1_id),
           (g.home_player_2_id),
           (g.away_player_1_id),
           (g.away_player_2_id)
       ) as player(person_id)
       where f.id = any($1::uuid[])
         and player.person_id is not null
     )
     select
       selected.fixture_id::text,
       selected.person_id::text,
       case
         when count(distinct pgr.game_id) > 0 then round(
           100.0 * count(distinct pgr.game_id) filter (where pgr.winner_player_id = selected.person_id)
           / count(distinct pgr.game_id)
         )::int
         else null
       end as win_percentage
     from selected
     left join public.player_game_result_view pgr
       on pgr.season_id = selected.season_id
      and pgr.league_id = selected.league_id
      and (pgr.player_1_id = selected.person_id or pgr.player_2_id = selected.person_id)
     group by selected.fixture_id, selected.person_id`,
    [ids]
  );

  return new Map(rows
    .filter((row): row is typeof row & { win_percentage: number } => row.win_percentage !== null)
    .map((row) => [percentageKey(row.fixture_id, row.person_id), Number(row.win_percentage)]));
}

export function fixturePlayerWinPercentage(
  percentages: FixturePlayerWinPercentages,
  fixtureId: string,
  personId: string | null | undefined
) {
  return personId ? percentages.get(percentageKey(fixtureId, personId)) ?? null : null;
}
