import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get("host") ?? "";
    const isLocal = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
    const isLiveDomain = host === "interclubsnooker.com" || host === "www.interclubsnooker.com";

    if (!isLocal && !isLiveDomain) {
      return NextResponse.json({ error: "Lineup test reset is not available on this host." }, { status: 403 });
    }

    if (isLiveDomain) {
      const user = await currentUser();
      if (!user) return NextResponse.json({ error: "Sign in is required to reset the lineup test." }, { status: 401 });
      const { rowCount } = await dbQuery(
        "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
        [user.personId]
      );
      if (!rowCount) {
        return NextResponse.json({ error: "Administrator access is required to reset the lineup test." }, { status: 403 });
      }
    }

    const result = await withTransaction(async (client) => {
      const fixtures = await client.query<{ id: string }>(
        `select f.id
         from public.fixture f
         join public.season s on s.id = f.season_id
         join public.league l on l.id = f.league_id
         join public.fixture_week fw
           on fw.season_id = f.season_id
          and fw.league_id = f.league_id
          and fw.starts_on = f.fixture_date::date
         where s.name = '2026/27'
           and l.name = 'A League'
           and fw.week_number = 1
         order by f.fixture_date`
      );
      const fixtureIds = fixtures.rows.map((fixture) => fixture.id);
      if (!fixtureIds.length) throw new Error("2026/27 A League Week 1 fixtures were not found.");

      await client.query(
        `insert into public.match (fixture_id, home_team_score, away_team_score)
         select f.id, 0, 0
         from public.fixture f
         where f.id = any($1::uuid[])
         on conflict (fixture_id) do update
         set home_team_score = 0,
             away_team_score = 0,
             entered_by = null`,
        [fixtureIds]
      );
      await client.query(
        `insert into public.fixture_week_match (week_id, match_id)
         select fw.id, m.id
         from public.fixture f
         join public.match m on m.fixture_id = f.id
         join public.fixture_week fw
           on fw.season_id = f.season_id
          and fw.league_id = f.league_id
          and fw.starts_on = f.fixture_date::date
         where f.id = any($1::uuid[])
         on conflict (match_id) do update
         set week_id = excluded.week_id`,
        [fixtureIds]
      );
      const deletedLineups = await client.query(
        `delete from public.fixture_lineup
         where fixture_id = any($1::uuid[])`,
        [fixtureIds]
      );
      const deletedGames = await client.query(
        `delete from public.game
         where match_id in (
           select id from public.match where fixture_id = any($1::uuid[])
         )`,
        [fixtureIds]
      );
      await client.query(
        `update public.match
         set home_team_score = 0,
             away_team_score = 0,
             entered_by = null
         where fixture_id = any($1::uuid[])`,
        [fixtureIds]
      );
      await client.query(
        `update public.fixture
         set status = 'Scheduled'
         where id = any($1::uuid[])`,
        [fixtureIds]
      );

      return {
        fixtureCount: fixtureIds.length,
        lineupsDeleted: deletedLineups.rowCount ?? 0,
        gamesDeleted: deletedGames.rowCount ?? 0
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reset lineup test match." },
      { status: 400 }
    );
  }
}
