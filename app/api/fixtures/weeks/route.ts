import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const leagueName = request.nextUrl.searchParams.get("league")?.trim() || "A League";
    const seasonName = request.nextUrl.searchParams.get("season")?.trim() || "2026/27";
    const teamId = request.nextUrl.searchParams.get("teamId")?.trim() || "";
    const rows = await dbQuery<{
      week_id: string;
      week_number: number;
      week_label: string;
      starts_on: string;
      fixture_id: string;
      fixture_date: string;
      status: string;
      home_team_id: string;
      away_team_id: string;
      home_team_name: string;
      away_team_name: string;
      match_id: string | null;
      home_team_score: number | null;
      away_team_score: number | null;
      home_lineup_status: "Draft" | "Published" | null;
      away_lineup_status: "Draft" | "Published" | null;
      completed_games: string;
      total_games: string;
    }>(
      `select
         fw.id as week_id,
         fw.week_number,
         fw.week_label,
         fw.starts_on::text,
         f.id as fixture_id,
         f.fixture_date,
         f.status::text,
         f.home_team_id,
         f.away_team_id,
         ht.name as home_team_name,
         at.name as away_team_name,
         m.id as match_id,
         m.home_team_score,
         m.away_team_score,
         hfl.status as home_lineup_status,
         afl.status as away_lineup_status,
         count(g.id) filter (where g.winner_team_id is not null)::text as completed_games,
         count(g.id)::text as total_games
       from public.fixture_week fw
       join public.season s on s.id = fw.season_id
       join public.league l on l.id = fw.league_id
       join public.fixture_week_match fwm on fwm.week_id = fw.id
       join public.match m on m.id = fwm.match_id
       join public.fixture f on f.id = m.fixture_id
       join public.team ht on ht.id = f.home_team_id
       join public.team at on at.id = f.away_team_id
       left join public.fixture_lineup hfl on hfl.fixture_id = f.id and hfl.team_id = f.home_team_id
       left join public.fixture_lineup afl on afl.fixture_id = f.id and afl.team_id = f.away_team_id
       left join public.game g on g.match_id = m.id
       where l.name = $1
         and s.name = $2
       group by
         fw.id,
         fw.week_number,
         fw.week_label,
         fw.starts_on,
         f.id,
         f.fixture_date,
         f.status,
         f.home_team_id,
         f.away_team_id,
         ht.name,
         at.name,
         m.id,
         m.home_team_score,
         m.away_team_score,
         hfl.status,
         afl.status
       order by fw.week_number, f.fixture_date, ht.name`,
      [leagueName, seasonName]
    );
    const fixtureIds = rows.rows.map((row) => row.fixture_id);
    const gameRows = fixtureIds.length ? (await dbQuery<{
      fixture_id: string;
      id: string;
      game_number: number;
      game_type: "Singles" | "Doubles";
      points_awarded: number;
      winner_team_id: string | null;
      home_player_1_id: string | null;
      home_player_1_name: string;
      home_player_2_id: string | null;
      home_player_2_name: string | null;
      away_player_1_id: string | null;
      away_player_1_name: string;
      away_player_2_id: string | null;
      away_player_2_name: string | null;
    }>(
      `select
         f.id as fixture_id,
         g.id,
         g.game_number,
         g.game_type::text as game_type,
         g.points_awarded,
         g.winner_team_id,
         hp1.id as home_player_1_id,
         concat_ws(' ', hp1.first_name, hp1.last_name) as home_player_1_name,
         hp2.id as home_player_2_id,
         concat_ws(' ', hp2.first_name, hp2.last_name) as home_player_2_name,
         ap1.id as away_player_1_id,
         concat_ws(' ', ap1.first_name, ap1.last_name) as away_player_1_name,
         ap2.id as away_player_2_id,
         concat_ws(' ', ap2.first_name, ap2.last_name) as away_player_2_name
       from public.fixture f
       join public.match m on m.fixture_id = f.id
       join public.game g on g.match_id = m.id
       left join public.person hp1 on hp1.id = g.home_player_1_id
       left join public.person hp2 on hp2.id = g.home_player_2_id
       left join public.person ap1 on ap1.id = g.away_player_1_id
       left join public.person ap2 on ap2.id = g.away_player_2_id
       where f.id = any($1::uuid[])
       order by f.fixture_date, g.game_number`,
      [fixtureIds]
    )).rows : [];
    const gameIds = gameRows.map((game) => game.id);
    const breakRows = gameIds.length ? (await dbQuery<{
      id: string;
      game_id: string;
      player_id: string;
      player_name: string;
      break_value: number;
      recorded_at: string;
    }>(
      `select
         b.id,
         b.game_id,
         b.player_id,
         concat_ws(' ', p.first_name, p.last_name) as player_name,
         b.break_value,
         b.recorded_at::text
       from public.break b
       join public.person p on p.id = b.player_id
       where b.game_id = any($1::uuid[])
       order by b.break_value desc, b.recorded_at asc`,
      [gameIds]
    )).rows : [];
    const breaksForGame = (gameId: string) => breakRows
      .filter((row) => row.game_id === gameId)
      .map((row) => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        breakValue: Number(row.break_value),
        recordedAt: row.recorded_at
      }));

    const weeks = new Map<string, {
      id: string;
      weekNumber: number;
      weekLabel: string;
      startsOn: string;
      fixtures: Array<{
        id: string;
        fixtureDate: string;
        status: string;
        homeTeamId: string;
        awayTeamId: string;
        homeTeamName: string;
        awayTeamName: string;
        matchId: string | null;
        homeTeamScore: number | null;
        awayTeamScore: number | null;
        homeLineupStatus: "Draft" | "Published" | null;
        awayLineupStatus: "Draft" | "Published" | null;
        completedGames: number;
        totalGames: number;
        isOwnFixture: boolean;
        games: Array<{
          id: string;
          game_number: number;
          game_type: "Singles" | "Doubles";
          points_awarded: number;
          winner_team_id: string | null;
          home_player_1_id: string | null;
          home_player_1_name: string;
          home_player_2_id: string | null;
          home_player_2_name: string | null;
          away_player_1_id: string | null;
          away_player_1_name: string;
          away_player_2_id: string | null;
          away_player_2_name: string | null;
          breaks: Array<{ id: string; playerId: string; playerName: string; breakValue: number; recordedAt: string }>;
        }>;
      }>;
    }>();

    for (const row of rows.rows) {
      const week = weeks.get(row.week_id) ?? {
        id: row.week_id,
        weekNumber: row.week_number,
        weekLabel: row.week_label,
        startsOn: row.starts_on,
        fixtures: []
      };
      week.fixtures.push({
        id: row.fixture_id,
        fixtureDate: row.fixture_date,
        status: row.status,
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeTeamName: row.home_team_name,
        awayTeamName: row.away_team_name,
        matchId: row.match_id,
        homeTeamScore: row.home_team_score,
        awayTeamScore: row.away_team_score,
        homeLineupStatus: row.home_lineup_status,
        awayLineupStatus: row.away_lineup_status,
        completedGames: Number(row.completed_games ?? 0),
        totalGames: Number(row.total_games ?? 0),
        isOwnFixture: Boolean(teamId && (row.home_team_id === teamId || row.away_team_id === teamId)),
        games: gameRows
          .filter((game) => game.fixture_id === row.fixture_id)
          .map((game) => ({
            id: game.id,
            game_number: game.game_number,
            game_type: game.game_type,
            points_awarded: Number(game.points_awarded),
            winner_team_id: game.winner_team_id,
            home_player_1_id: game.home_player_1_id,
            home_player_1_name: game.home_player_1_name,
            home_player_2_id: game.home_player_2_id,
            home_player_2_name: game.home_player_2_name,
            away_player_1_id: game.away_player_1_id,
            away_player_1_name: game.away_player_1_name,
            away_player_2_id: game.away_player_2_id,
            away_player_2_name: game.away_player_2_name,
            breaks: breaksForGame(game.id)
          }))
      });
      weeks.set(row.week_id, week);
    }

    return NextResponse.json({ weeks: Array.from(weeks.values()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fixtures unavailable." },
      { status: 500 }
    );
  }
}
