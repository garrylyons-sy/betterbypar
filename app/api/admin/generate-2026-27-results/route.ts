import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, getPool } from "@/lib/server/db";

export const runtime = "nodejs";

async function assertAdministrator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Administrator access is required.");
  return user;
}

export async function POST() {
  try {
    const user = await assertAdministrator();
    const sqlPath = path.join(process.cwd(), "supabase", "simulate_2026_27_results.sql");
    const sql = await readFile(sqlPath, "utf8");
    const client = await getPool().connect();

    try {
      await client.query(sql);
    } finally {
      client.release();
    }

    const summary = await dbQuery<{
      fixtures_completed: string;
      matches: string;
      games: string;
      breaks: string;
      fixture_lineups: string;
    }>(
      `with target_season as (
         select id from public.season where name = '2026/27'
       ),
       target_fixtures as (
         select f.id as fixture_id
         from public.fixture f
         join target_season s on s.id = f.season_id
       ),
       target_matches as (
         select m.id as match_id
         from public.match m
         join target_fixtures tf on tf.fixture_id = m.fixture_id
       )
       select
         (select count(*) from public.fixture f join target_fixtures tf on tf.fixture_id = f.id where f.status = 'Completed')::text as fixtures_completed,
         (select count(*) from target_matches)::text as matches,
         (select count(*) from public.game g join target_matches tm on tm.match_id = g.match_id)::text as games,
         (select count(*) from public.break b join public.game g on g.id = b.game_id join target_matches tm on tm.match_id = g.match_id)::text as breaks,
         (select count(*) from public.fixture_lineup fl join target_fixtures tf on tf.fixture_id = fl.fixture_id)::text as fixture_lineups`
    );

    const result = summary.rows[0] ?? {};
    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_label, page_path, metadata)
       values ($1, 'Page Visit', 'Admin generated 2026/27 results', '/admin', $2::jsonb)`,
      [user.personId, JSON.stringify({ season: "2026/27", sql_file: "supabase/simulate_2026_27_results.sql", result })]
    );

    return NextResponse.json({ ok: true, result, sqlFile: "supabase/simulate_2026_27_results.sql" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate 2026/27 results.";
    const status = message.includes("authenticated") ? 401 : message.includes("Administrator") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
