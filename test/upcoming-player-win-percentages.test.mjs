import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const appShell = source("../components/app-shell.tsx");
const fixtureWeeks = source("../app/api/fixtures/weeks/route.ts");
const managerLineup = source("../app/api/manager/lineup/route.ts");
const percentageService = source("../lib/server/player-win-percentages.ts");

test("upcoming match game payloads use canonical season and league win percentages", () => {
  assert.match(percentageService, /player_game_result_view/);
  assert.match(percentageService, /pgr\.season_id = selected\.season_id/);
  assert.match(percentageService, /pgr\.league_id = selected\.league_id/);
  assert.match(fixtureWeeks, /loadFixturePlayerWinPercentages/);
  assert.match(managerLineup, /loadFixturePlayerWinPercentages/);
  assert.match(fixtureWeeks, /home_player_1_win_percentage/);
  assert.match(managerLineup, /away_player_2_win_percentage/);
});

test("only League Chairs see percentages and completed matches always suppress them", () => {
  assert.match(appShell, /activeTeam\.hasLeagueChairAccess/);
  assert.match(appShell, /showWinPercentages && fixture\.status !== "Completed"/);
  assert.match(appShell, /Math\.round\(player\.winPercentage\)/);
  assert.match(appShell, /text-\[10px\]/);
  assert.match(appShell, /GeneratedMatchCard[\s\S]*showWinPercentages/);
  assert.match(appShell, /ReadOnlyFixtureDetails[\s\S]*showWinPercentages/);
});
