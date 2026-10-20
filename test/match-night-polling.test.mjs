import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const authGateway = readFileSync(new URL("../components/auth-gateway.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const authService = readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");
const liveDashboard = readFileSync(new URL("../components/live-scoring-dashboard.tsx", import.meta.url), "utf8");
const lastManStanding = readFileSync(new URL("../components/last-man-standing.tsx", import.meta.url), "utf8");
const clubLadder = readFileSync(new URL("../components/club-ladder.tsx", import.meta.url), "utf8");
const fixtureStatusRoute = readFileSync(new URL("../app/api/fixtures/status/route.ts", import.meta.url), "utf8");

test("maintenance is enforced on requests without client polling", () => {
  assert.doesNotMatch(rootLayout, /MaintenanceGate/);
  assert.doesNotMatch(rootLayout, /loadMaintenanceMode/);
});

test("focus and visibility events share a cooldown instead of duplicating refreshes", () => {
  assert.match(authGateway, /VISIBILITY_REFRESH_COOLDOWN_MS = 5 \* 60 \* 1000/);
  assert.match(authGateway, /now - lastRefreshAt < VISIBILITY_REFRESH_COOLDOWN_MS/);
  assert.doesNotMatch(lastManStanding, /window\.addEventListener\("focus"/);
  assert.doesNotMatch(clubLadder, /window\.addEventListener\("focus"/);
  assert.match(lastManStanding, /summaryCacheLifetimeMs = 5 \* 60 \* 1000/);
});

test("match night does not poll the complete session payload", () => {
  assert.doesNotMatch(authGateway, /session\?\.activeMatchCount[\s\S]{0,350}setInterval/);
  assert.match(authService, /f\.status <> 'Completed'/);
});

test("fixture and lineup polling is visible, adaptive and stops after completion", () => {
  assert.match(appShell, /settings\.matchActiveSeconds \* 1000/);
  assert.match(appShell, /settings\.matchIdleSeconds \* 1000/);
  assert.match(appShell, /fixtureWeekPollInterval\(currentWeek, pollingSettingsRef\.current\)/);
  assert.match(appShell, /fixtureWeekPollInterval/);
  assert.match(appShell, /managerLineupPollInterval/);
  assert.match(appShell, /document\.visibilityState !== "visible"/);
  assert.match(appShell, /fixture\.completedGames > 0/);
  assert.match(appShell, /payload\.fixture\.status === "Completed"/);
  assert.match(appShell, /\/api\/fixtures\/status\?fixtureIds=/);
  assert.match(appShell, /fixtureStatusSnapshot/);
  assert.match(fixtureStatusRoute, /currentUserFromRequest/);
  assert.match(fixtureStatusRoute, /count\(g\.id\) filter \(where g\.winner_team_id is not null\)/);
  assert.match(fixtureStatusRoute, /fixtureIds\.length > 50/);
});

test("read-only live indicators use a lower-frequency status poll", () => {
  assert.match(liveDashboard, /settings\.liveStatusSeconds \* 1000/);
  assert.match(liveDashboard, /settings\.liveDashboardSeconds \* 1000/);
});
