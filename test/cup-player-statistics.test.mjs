import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const migration = source("../supabase/exclude_cup_player_statistics.sql");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const leagueStatsRoute = readFileSync(new URL("../app/api/league/player-stats/route.ts", import.meta.url), "utf8");
const teamStatsRoute = readFileSync(new URL("../app/api/team/player-stats/route.ts", import.meta.url), "utf8");

test("cup appearances and results are excluded from player statistics", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /create or replace view public\.player_statistics/);
    assert.match(source, /create or replace view public\.player_game_result_view/);
    assert.match(source, /coalesce\(f\.fixture_type, 'League'\) = 'League'/);
  }
});

test("cup breaks are excluded from every league and team player statistic", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /create or replace view public\.player_break_leaderboard_view/);
    assert.match(source, /where f\.id is null or coalesce\(f\.fixture_type, 'League'\) = 'League'/);
  }

  for (const source of [leagueStatsRoute, teamStatsRoute]) {
    assert.match(source, /join public\.game break_game on break_game\.id = b\.game_id/);
    assert.match(source, /join public\.match break_match on break_match\.id = break_game\.match_id/);
    assert.match(source, /join public\.fixture break_fixture on break_fixture\.id = break_match\.fixture_id/);
    assert.match(source, /coalesce\(break_fixture\.fixture_type, 'League'\) = 'League'/);
  }
});
