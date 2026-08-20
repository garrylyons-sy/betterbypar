import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

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
    const result = await withTransaction(async (client) => {
      const reset = await client.query<{
        breaks_deleted: string;
        player_results_deleted: string;
        match_lineups_deleted: string;
        fixture_lineups_deleted: string;
        games_deleted: string;
        matches_reset: string;
        fixtures_reset: string;
      }>(
        `with target_season as (
           select id
           from public.season
           where name = '2026/27'
         ),
         target_fixtures as materialized (
           select f.id as fixture_id, m.id as match_id
           from public.fixture f
           join target_season s on s.id = f.season_id
           left join public.match m on m.fixture_id = f.id
         ),
         deleted_breaks as (
           delete from public.break b
           using target_season s
           where b.season_id = s.id
              or exists (
                select 1
                from public.game g
                join public.match m on m.id = g.match_id
                join public.fixture f on f.id = m.fixture_id
                where g.id = b.game_id
                  and f.season_id = s.id
              )
           returning 1
         ),
         deleted_player_results as (
           delete from public.player_game_result pgr
           using target_season s
           where pgr.season_id = s.id
           returning 1
         ),
         deleted_match_lineups as (
           delete from public.match_lineup ml
           using target_fixtures tf
           where ml.match_id = tf.match_id
           returning 1
         ),
         deleted_fixture_lineups as (
           delete from public.fixture_lineup fl
           using target_fixtures tf
           where fl.fixture_id = tf.fixture_id
           returning 1
         ),
         deleted_games as (
           delete from public.game g
           using target_fixtures tf
           where g.match_id = tf.match_id
           returning 1
         ),
         updated_matches as (
           update public.match m
           set home_team_score = 0,
               away_team_score = 0,
               entered_by = null,
               entered_at = now()
           from target_fixtures tf
           where m.id = tf.match_id
             and (m.home_team_score <> 0 or m.away_team_score <> 0 or m.entered_by is not null)
           returning 1
         ),
         updated_fixtures as (
           update public.fixture f
           set status = 'Scheduled'
           from target_fixtures tf
           where f.id = tf.fixture_id
             and f.status <> 'Scheduled'
           returning 1
         )
         select
           (select count(*) from deleted_breaks) as breaks_deleted,
           (select count(*) from deleted_player_results) as player_results_deleted,
           (select count(*) from deleted_match_lineups) as match_lineups_deleted,
           (select count(*) from deleted_fixture_lineups) as fixture_lineups_deleted,
           (select count(*) from deleted_games) as games_deleted,
           (select count(*) from updated_matches) as matches_reset,
           (select count(*) from updated_fixtures) as fixtures_reset`
      );

      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_label, page_path, metadata)
         values ($1, 'Page Visit', 'Admin reset 2026/27 match data', '/admin', $2::jsonb)`,
        [user.personId, JSON.stringify({ season: "2026/27", reset: reset.rows[0] ?? {} })]
      );

      return reset.rows[0];
    });

    return NextResponse.json({ ok: true, reset: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset match data.";
    const status = message.includes("authenticated") ? 401 : message.includes("Administrator") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
