import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const page = source("../app/livescoring/page.tsx");
const layout = source("../app/livescoring/layout.tsx");
const dashboard = source("../components/live-scoring-dashboard.tsx");
const dashboardRoute = source("../app/api/league-chair/live-scoring/dashboard/route.ts");
const service = source("../lib/server/live-scoring.ts");
const controls = source("../components/league-chair-live-scoring.tsx");
const appShell = source("../components/app-shell.tsx");

test("standalone live scoring is server-protected for League Chairs", () => {
  assert.match(page, /currentUser\(\)/, "the page should use the signed-in cookie session");
  assert.match(page, /requireLeagueChairScoringAccess\(user\.personId\)/);
  assert.match(page, /redirect\("\/"\)/, "unauthorised users should leave before live data renders");
  assert.match(page, /LiveScoringDashboard/);

  assert.match(dashboardRoute, /currentUser\(\)/);
  assert.doesNotMatch(dashboardRoute, /currentUserFromRequest|testUser/, "the dashboard must not support impersonation");
  assert.match(dashboardRoute, /requireLeagueChairScoringAccess\(user\.personId\)/);
  assert.match(dashboardRoute, /League Chair access required[\s\S]*status: 403/);
});

test("live scoring has its own favicon and signals active scoring", () => {
  assert.match(layout, /live-scoring-icon\.svg/);
  assert.match(dashboard, /LiveScoringFavicon/);
  assert.match(dashboard, /live-scoring-live-icon\.svg/);
  assert.match(dashboard, /status\.status === "Live"/);
  assert.match(dashboard, /document\.title = active/);
});

test("dashboard selects current fixtures and reuses the established scorer", () => {
  assert.match(service, /export async function loadLiveScoringDashboard/);
  assert.match(service, /s\.active = true/);
  assert.match(service, /f\.status <> 'Completed'/);
  assert.match(service, /f\.fixture_date at time zone 'Europe\/Dublin'[\s\S]*now\(\) at time zone 'Europe\/Dublin'/, "the dashboard query should only load today's Dublin fixtures");
  assert.match(service, /order by[\s\S]*has_live_session desc[\s\S]*fixture_date/);
  assert.match(dashboardRoute, /loadLiveScoringDashboard/);
  assert.match(dashboard, /LeagueChairMatchControls/);
  assert.match(dashboard, /defaultOpen/);
  assert.match(dashboard, /All leagues/);
  assert.doesNotMatch(dashboard, /type="date"/, "today-only live scoring should not offer a date picker");
  assert.match(dashboard, /Live now/);
});

test("desktop dashboard keeps the compact mobile scoring hierarchy", () => {
  assert.match(dashboard, /max-w-3xl/, "the standalone dashboard should remain comfortably narrow on desktop");
  assert.doesNotMatch(dashboard, /max-w-5xl/, "desktop should not stretch the scorer into a wide dashboard");
  assert.doesNotMatch(controls, /lg:grid-cols-\[minmax\(0,1fr\)_auto\]/, "game details and controls should stay stacked at desktop widths");
});

test("dashboard shows each team's compact lineup state", () => {
  assert.match(service, /hfl\.status::text as home_lineup_status/);
  assert.match(service, /afl\.status::text as away_lineup_status/);
  assert.match(service, /left join public\.fixture_lineup hfl[\s\S]*left join public\.fixture_lineup afl/);
  assert.match(dashboard, /TeamSelectionIndicator/);
  for (const status of ["TB", "DS", "TP", "To be picked", "Draft saved", "Team published"]) {
    assert.match(dashboard, new RegExp(status), `dashboard should expose ${status}`);
  }
  assert.match(dashboard, /home_lineup_status/);
  assert.match(dashboard, /away_lineup_status/);
});

test("League Chair observers see meaningful frame state without controlling it", () => {
  assert.match(controls, /liveFrameStatusLabel/);
  for (const wording of ["reds left", "Red next", "Colour next", "Re-spotted black", "Current break"]) {
    assert.match(controls, new RegExp(wording, "i"), `observer summary should include ${wording}`);
  }
  assert.match(controls, /scorer_name/);
  assert.match(controls, /activePlayerName/);
  assert.match(controls, /selectedSessionCanControl \? 2000 : 10000/, "observers should poll more slowly than the active scorer");
});

test("normal fixtures show a small League Chair-only live indicator", () => {
  assert.match(appShell, /activeTeam\.hasLiveScoringAccess[\s\S]*LeagueChairLiveIndicator/);
  assert.match(dashboard, /fixtureIds/);
  assert.match(dashboard, /document\.visibilityState === "visible"/);
  assert.match(dashboard, /LIVE_STATUS_POLL_MS = 20_000/, "compact status polling should be slower than the active scorer");
  assert.match(dashboardRoute, /loadLiveScoringStatuses/);
  assert.match(service, /status in \('Live', 'Paused'\)/, "fixture indicators should omit closed sessions");
  assert.match(service, /join public\.fixture f on f\.id = lfs\.fixture_id[\s\S]*join public\.season s on s\.id = f\.season_id/);
  assert.match(service, /s\.active = true[\s\S]*f\.status <> 'Completed'[\s\S]*f\.fixture_type = 'League'[\s\S]*f\.fixture_date >= current_date/);
});

test("the main app shows only read-only live state for League Chair access", () => {
  assert.match(dashboard, /export function LeagueChairLiveStatusList/);
  assert.match(appShell, /LeagueChairLiveStatusList/);
  assert.match(appShell, /fixtureLiveStatuses\.length/);
  assert.match(appShell, /LeagueChairLiveStatusList statuses=\{fixtureLiveStatuses\} showScorer=\{false\}/, "the main app should omit scorer attribution");
  assert.match(dashboard, /showScorer = true/, "the dedicated live-scoring dashboard should retain scorer attribution by default");
  assert.doesNotMatch(appShell, /LeagueChairMatchControls/, "full scoring controls belong only on the standalone live-scoring route");
});

test("the standalone route remains intentionally absent from normal navigation", () => {
  assert.doesNotMatch(appShell, /href=["']\/livescoring["']/);
  assert.doesNotMatch(appShell, /menuEntry\(["']\/livescoring["']\)/);
});
