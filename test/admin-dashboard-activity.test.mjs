import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminRoute = readFileSync(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("admin dashboard loads feature activity in its existing payload with club scoping", () => {
  for (const table of [
    "fixture_lineup",
    "cup_competition_tie",
    "club_ladder_challenge",
    "last_man_standing_entry",
    "live_frame_session"
  ]) {
    assert.match(adminRoute, new RegExp(`public\\.${table}`), `dashboard should count ${table}`);
  }

  assert.match(adminRoute, /\n\s+featureStats,/);
  assert.match(adminRoute, /\$1::boolean = true/);
  assert.match(adminRoute, /any\(\$2::uuid\[\]\)/);
  assert.doesNotMatch(adminConsole, /fetch\([^)]*dashboard-activity/, "activity stats should reuse the admin payload");
});

test("admin dashboard presents compact operational metrics for newer features", () => {
  for (const label of [
    "Platform activity",
    "Team selections",
    "Cup competitions",
    "Club ladders",
    "Last Man Standing",
    "Live scoring",
    "Cup ties played",
    "Cup frames played",
    "Challenges made",
    "Open challenges",
    "Still standing",
    "Live now"
  ]) {
    assert.match(adminConsole, new RegExp(label), `dashboard should show ${label}`);
  }
});
