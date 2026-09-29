import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type LeagueBreakRow = {
  id: string;
  break_value: number;
  recorded_at: string | null;
  fixture_date: string | null;
  player_name: string;
  player_email: string | null;
  team_name: string | null;
  opponent_team_name: string | null;
  game_number: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const league = request.nextUrl.searchParams.get("league")?.trim();
    const season = request.nextUrl.searchParams.get("season")?.trim();
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 50) : 10;

    if (!league || !season) {
      return NextResponse.json({ error: "league and season are required." }, { status: 400 });
    }

    const { rows } = await dbQuery<LeagueBreakRow>(
      `with target as (
         select l.id as league_id, s.id as season_id
         from public.league l
         cross join public.season s
         where l.name = $1
           and s.name = $2
         limit 1
       )
       select
         b.id,
         b.break_value,
         b.recorded_at::text as recorded_at,
         f.fixture_date::text as fixture_date,
         concat_ws(' ', p.first_name, p.last_name) as player_name,
         p.email as player_email,
         case
           when b.player_id in (g.home_player_1_id, g.home_player_2_id) then home_team.name
           when b.player_id in (g.away_player_1_id, g.away_player_2_id) then away_team.name
           else null
         end as team_name,
         case
           when b.player_id in (g.home_player_1_id, g.home_player_2_id) then away_team.name
           when b.player_id in (g.away_player_1_id, g.away_player_2_id) then home_team.name
           else null
         end as opponent_team_name,
         g.game_number
       from public.break b
       join public.person p on p.id = b.player_id and p.active = true
       join public.game g on g.id = b.game_id
       join public.match m on m.id = g.match_id
       join public.fixture f on f.id = m.fixture_id
       join public.team home_team on home_team.id = f.home_team_id
       join public.team away_team on away_team.id = f.away_team_id
       join target t on t.season_id = f.season_id and t.league_id = f.league_id
       where coalesce(f.fixture_type, 'League') = 'League'
       order by b.break_value desc, coalesce(f.fixture_date, b.recorded_at) desc, p.last_name, p.first_name
       limit $3`,
      [league, season, limit]
    );

    return NextResponse.json({
      league,
      season,
      breaks: rows.map((row) => ({
        id: row.id,
        breakValue: Number(row.break_value),
        recordedAt: row.recorded_at,
        fixtureDate: row.fixture_date,
        playerName: row.player_name,
        playerEmail: row.player_email,
        teamName: row.team_name,
        opponentTeamName: row.opponent_team_name,
        gameNumber: row.game_number === null ? null : Number(row.game_number)
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "League breaks unavailable." },
      { status: 500 }
    );
  }
}
