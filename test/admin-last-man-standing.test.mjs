import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Last Man Standing admin APIs are platform-only and support management actions", () => {
  const routes = [
    "../app/api/admin/last-man-standing/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/process/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/reopen/route.ts"
  ];
  for (const path of routes) assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} should exist`);
  const source = routes.map(read).join("\n");
  assert.match(source, /app_operator/);
  assert.match(source, /entry_closes_at/);
  assert.match(source, /last_man_standing_round_schedule/);
  assert.match(source, /processDueLastManStandingWork/);
  assert.match(source, /reopenLastManStandingRound/);
  assert.match(source, /user_activity_log/);
});

test("admin navigation exposes a lazy standalone Last Man Standing section only to platform admins", () => {
  const consoleSource = read("../components/admin-console.tsx");
  const panelSource = read("../components/admin-last-man-standing.tsx");
  assert.match(consoleSource, /"last-man-standing"/);
  assert.match(consoleSource, /Last Man Standing/);
  assert.doesNotMatch(consoleSource.match(/const clubAdminTabs[\s\S]*?\];/)?.[0] ?? "", /last-man-standing/);
  assert.match(panelSource, /\/api\/admin\/last-man-standing/);
  assert.match(panelSource, /expandedCompetitionId/);
  assert.match(panelSource, /A League/);
  assert.match(panelSource, /B League/);
  assert.match(panelSource, /C League/);
  assert.match(panelSource, /Needs Review/);
  assert.match(panelSource, /Process now/);
  assert.match(panelSource, /Reopen/);
});
