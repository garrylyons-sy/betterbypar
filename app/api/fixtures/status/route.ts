import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const user = await currentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const fixtureIds = Array.from(new Set(
    (request.nextUrl.searchParams.get("fixtureIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  ));
  if (!fixtureIds.length) return NextResponse.json({ fixtures: [] }, { headers: { "Cache-Control": "no-store" } });
  if (fixtureIds.length > 50 || fixtureIds.some((id) => !UUID_PATTERN.test(id))) {
    return NextResponse.json({ error: "Invalid fixture selection." }, { status: 400 });
  }

  const fixtures = (await dbQuery<{
    id: string;
    status: string;
    home_team_score: number | null;
    away_team_score: number | null;
    home_lineup_status: "Draft" | "Published" | null;
    away_lineup_status: "Draft" | "Published" | null;
    completed_games: string;
    total_games: string;
  }>(
    `select
       f.id::text,
       f.status::text,
       m.home_team_score,
       m.away_team_score,
       hfl.status::text as home_lineup_status,
       afl.status::text as away_lineup_status,
       count(g.id) filter (where g.winner_team_id is not null)::text as completed_games,
       count(g.id)::text as total_games
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     left join public.fixture_lineup hfl on hfl.fixture_id = f.id and hfl.team_id = f.home_team_id
     left join public.fixture_lineup afl on afl.fixture_id = f.id and afl.team_id = f.away_team_id
     left join public.game g on g.match_id = m.id
     where f.id = any($1::uuid[])
     group by f.id, f.status, m.home_team_score, m.away_team_score, hfl.status, afl.status
     order by f.id`,
    [fixtureIds]
  )).rows.map((fixture) => ({
    id: fixture.id,
    status: fixture.status,
    homeTeamScore: fixture.home_team_score,
    awayTeamScore: fixture.away_team_score,
    homeLineupStatus: fixture.home_lineup_status,
    awayLineupStatus: fixture.away_lineup_status,
    completedGames: Number(fixture.completed_games),
    totalGames: Number(fixture.total_games)
  }));

  return NextResponse.json({ fixtures }, { headers: { "Cache-Control": "no-store" } });
}
