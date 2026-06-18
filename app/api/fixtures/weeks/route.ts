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
       join public.fixture f on f.season_id = fw.season_id
        and f.league_id = fw.league_id
        and f.fixture_date::date = fw.starts_on
       join public.team ht on ht.id = f.home_team_id
       join public.team at on at.id = f.away_team_id
       left join public.match m on m.fixture_id = f.id
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
        isOwnFixture: Boolean(teamId && (row.home_team_id === teamId || row.away_team_id === teamId))
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
