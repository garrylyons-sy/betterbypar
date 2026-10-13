import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Last Man Standing admin APIs are platform-only and support management actions", () => {
  const routes = [
    "../app/api/admin/last-man-standing/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/override/route.ts",
    "../app/api/admin/last-man-standing/[competitionId]/new-cycle/route.ts",
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
  assert.doesNotMatch(read("../app/api/admin/last-man-standing/[competitionId]/route.ts"), /group by c\.id for update/);
  assert.match(source, /Admin Override/);
  assert.match(source, /startNextLastManStandingCycle/);
  const override = read("../app/api/admin/last-man-standing/[competitionId]/override/route.ts");
  assert.match(override, /p\.state = 'Needs Review'/);
  assert.match(override, /r\.status = 'Needs Review'/);
  assert.match(override, /already used by this entrant/);
  assert.match(override, /then 'Needs Review' else 'Locked'/);
  assert.match(read("../app/api/admin/last-man-standing/route.ts"), /candidate_lineup\.status = 'Published'/);
  assert.match(read("../app/api/admin/last-man-standing/route.ts"), /l\.name = \$3/);
  const createRoute = read("../app/api/admin/last-man-standing/route.ts");
  assert.match(createRoute, /'Open'/);
  assert.match(createRoute, /now\(\)/);
  assert.match(createRoute, /lower\(fw\.week_label\) not like '%break%'/i);
  assert.match(createRoute, /original_fixture_date is null/i);
  assert.ok((createRoute.match(/f\.original_fixture_date is null/gi) ?? []).length >= 2, "both the week picker and competition creation must exclude rescheduled-only weeks");
  assert.ok((createRoute.match(/between fw\.starts_on and fw\.starts_on \+ 6/gi) ?? []).length >= 2, "eligible fixtures must still be played inside their mapped week");
  assert.match(createRoute, /at time zone 'Europe\/Dublin'/i);
  assert.match(createRoute, /body\.league/);
  assert.match(createRoute, /body\.firstRoundWeekId/);
  assert.match(createRoute, /body\.processingTime/);
  assert.match(createRoute, /processing_time/);
  assert.doesNotMatch(createRoute, /body\.entryOpensAt/);
  assert.doesNotMatch(createRoute, /body\.entryClosesAt/);
  assert.doesNotMatch(createRoute, /body\.rounds/);
  assert.doesNotMatch(createRoute, /for \(const tier of \["A", "B", "C"\]/);
  const adminPanel = read("../components/admin-last-man-standing.tsx");
  assert.match(adminPanel, /Audience/);
  assert.match(adminPanel, /Selected team/);
  assert.match(adminPanel, /Everyone/);
  assert.match(adminPanel, /audienceTeamId/);
  assert.match(createRoute, /body\.audience/);
  assert.match(createRoute, /body\.audienceTeamId/);
  assert.match(createRoute, /audience_team_id/);
  assert.match(read("../app/api/admin/last-man-standing/\[competitionId\]/route.ts"), /Changed audience/);
  assert.match(read("../app/api/admin/last-man-standing/\[competitionId\]/route.ts"), /VALID_STATUS_TRANSITIONS/);
  assert.match(read("../app/api/admin/last-man-standing/\[competitionId\]/route.ts"), /hashtext\('lifecycle'\)/);
  assert.match(read("../app/api/admin/last-man-standing/\[competitionId\]/route.ts"), /export async function DELETE/);
  assert.match(read("../app/api/admin/last-man-standing/\[competitionId\]/route.ts"), /delete from public\.last_man_standing_competition/);
});

test("Last Man Standing admin ignores postponed fixtures and their lineups", () => {
  const route = read("../app/api/admin/last-man-standing/route.ts");
  assert.match(route, /candidate_fixture\.status not in \('Cancelled', 'Postponed'\)/);
  assert.ok((route.match(/f\.status not in \('Cancelled', 'Completed', 'Postponed'\)/g) ?? []).length >= 2);
});

test("admin navigation exposes a lazy standalone Last Man Standing section only to platform admins", () => {
  const consoleSource = read("../components/admin-console.tsx");
  const panelSource = read("../components/admin-last-man-standing.tsx");
  assert.match(consoleSource, /"last-man-standing"/);
  assert.match(consoleSource, /Last Man Standing/);
  assert.doesNotMatch(consoleSource.match(/const clubAdminTabs[\s\S]*?\];/)?.[0] ?? "", /last-man-standing/);
  assert.match(consoleSource, /className="grid min-w-0 self-start content-start gap-4"/);
  assert.match(panelSource, /\/api\/admin\/last-man-standing/);
  assert.match(panelSource, /expandedCompetitionId/);
  assert.match(panelSource, /firstRoundWeekId/);
  assert.doesNotMatch(panelSource, /firstRoundWeeks/);
  assert.match(panelSource, /Needs Review/);
  assert.match(panelSource, /Fallback tools/);
  assert.match(panelSource, /Process now/);
  assert.match(panelSource, /Processing time/);
  assert.match(panelSource, /Delete competition/);
  assert.doesNotMatch(panelSource, />Archive</);
  assert.match(panelSource, /Reopen/);
  assert.match(panelSource, /Resolve pick/);
  assert.match(panelSource, /Unresolved picks/);
  assert.match(panelSource, /Start next cycle/);
  assert.match(panelSource, /Entrants and picks/);
  assert.doesNotMatch(panelSource, /Entries open/);
  assert.doesNotMatch(panelSource, /Add round/);
  assert.match(panelSource, /First round/);
  assert.match(panelSource, /Entries close at noon/);
  assert.match(panelSource, /className="grid self-start content-start gap-3"/);
});
