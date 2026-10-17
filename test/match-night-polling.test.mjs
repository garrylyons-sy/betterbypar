import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const maintenanceGate = readFileSync(new URL("../components/maintenance-gate.tsx", import.meta.url), "utf8");
const authGateway = readFileSync(new URL("../components/auth-gateway.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const authService = readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");

test("maintenance checks are infrequent and pause while the app is hidden", () => {
  assert.match(maintenanceGate, /MAINTENANCE_POLL_MS = 5 \* 60 \* 1000/);
  assert.match(maintenanceGate, /document\.visibilityState !== "visible"/);
  assert.doesNotMatch(maintenanceGate, /setInterval\(refresh, 30000\)/);
});

test("match night does not poll the complete session payload", () => {
  assert.doesNotMatch(authGateway, /session\?\.activeMatchCount[\s\S]{0,350}setInterval/);
  assert.match(authService, /f\.status <> 'Completed'/);
});

test("fixture and lineup polling is visible, adaptive and stops after completion", () => {
  assert.match(appShell, /MATCH_POLL_ACTIVE_MS = 15_000/);
  assert.match(appShell, /MATCH_POLL_IDLE_MS = 60_000/);
  assert.match(appShell, /fixtureWeekPollInterval/);
  assert.match(appShell, /managerLineupPollInterval/);
  assert.match(appShell, /document\.visibilityState !== "visible"/);
  assert.match(appShell, /fixture\.completedGames > 0/);
  assert.match(appShell, /payload\.fixture\.status === "Completed"/);
});
