import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../app/api/admin/matches/route.ts", import.meta.url), "utf8");
const consoleSource = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("admin matches API includes frame details for expanded completed matches", () => {
  assert.match(routeSource, /frame_details/, "admin matches response should include frame details");
  assert.match(routeSource, /home_player_1_name/, "frame details should include home player names");
  assert.match(routeSource, /away_player_1_name/, "frame details should include away player names");
  assert.match(routeSource, /winner_team_id/, "frame details should include the winning team");
});

test("admin matches UI renders frame winners when a match is expanded", () => {
  assert.match(consoleSource, /AdminMatchFrameDetails/, "expanded admin matches should render frame details");
  assert.match(consoleSource, /Frame details/, "frame details should have a visible section heading");
  assert.match(consoleSource, /winner_team_id/, "frame details renderer should use the winning team");
});
