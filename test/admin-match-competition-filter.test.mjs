import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("admin matches can filter all matches, leagues, cups, or a specific competition", () => {
  const panel = read("../components/admin-console.tsx");
  const route = read("../app/api/admin/matches/route.ts");

  assert.match(panel, /All matches/);
  assert.match(panel, /All leagues/);
  assert.match(panel, /All cups/);
  assert.match(panel, /league:\$\{item\.id\}/);
  assert.match(panel, /cup:\$\{item\.id\}/);
  assert.match(panel, /competition: competitionFilter/);
  assert.match(panel, /setSeason\(value\); setCompetitionFilter\("all"\)/);
  assert.match(route, /cup_competition_id/);
  assert.match(route, /cup_competition_name/);
  assert.match(route, /\$2 = 'league'/);
  assert.match(route, /\$2 = 'cup'/);
  assert.match(route, /cups: cups\.rows/);
});

test("cup fixtures expose their competition name in the admin match list", () => {
  const panel = read("../components/admin-console.tsx");
  assert.match(panel, /match\.cup_competition_name \?\? match\.league_name/);
});
