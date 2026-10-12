import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { canSignInDuringMaintenance, shouldShowMaintenance } from "../lib/maintenance-policy.mjs";

test("maintenance mode has a dedicated access policy and database migration", () => {
  assert.equal(existsSync(new URL("../lib/maintenance-policy.mjs", import.meta.url)), true);
  assert.equal(existsSync(new URL("../supabase/maintenance_mode.sql", import.meta.url)), true);
});

test("maintenance blocks ordinary pages but leaves its own page and admin reachable", () => {
  assert.equal(shouldShowMaintenance("/", true), true);
  assert.equal(shouldShowMaintenance("/fixtures", true), true);
  assert.equal(shouldShowMaintenance("/livescoring", true), true);
  assert.equal(shouldShowMaintenance("/admin", true), false);
  assert.equal(shouldShowMaintenance("/admin/people", true), false);
  assert.equal(shouldShowMaintenance("/maintenance", true), false);
  assert.equal(shouldShowMaintenance("/fixtures", false), false);
});

test("maintenance sign-in requires both admin intent and platform operator access", () => {
  assert.equal(canSignInDuringMaintenance({ maintenanceEnabled: false, adminIntent: false, platformAdmin: false }), true);
  assert.equal(canSignInDuringMaintenance({ maintenanceEnabled: true, adminIntent: false, platformAdmin: true }), false);
  assert.equal(canSignInDuringMaintenance({ maintenanceEnabled: true, adminIntent: true, platformAdmin: false }), false);
  assert.equal(canSignInDuringMaintenance({ maintenanceEnabled: true, adminIntent: true, platformAdmin: true }), true);
});

test("maintenance migration creates one off-by-default global setting", () => {
const sql = readFileSync(new URL("../supabase/maintenance_mode.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.maintenance_mode/i);
  assert.match(sql, /enabled boolean not null default false/i);
  assert.match(sql, /check \(singleton = true\)/i);
  assert.match(sql, /on conflict \(singleton\) do nothing/i);
});

test("the root layout gates normal pages and exposes a maintenance status endpoint", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const publicRoute = readFileSync(new URL("../app/api/maintenance/route.ts", import.meta.url), "utf8");
  assert.match(middleware, /x-interclub-pathname/);
  assert.match(layout, /loadMaintenanceMode/);
  assert.match(layout, /MaintenanceGate/);
  assert.match(publicRoute, /loadMaintenanceMode/);
});

test("password and Google sign-in independently enforce maintenance access", () => {
  const passwordRoute = readFileSync(new URL("../app/api/login/route.ts", import.meta.url), "utf8");
  const googleRoute = readFileSync(new URL("../app/auth/google/route.ts", import.meta.url), "utf8");
  const googleCallback = readFileSync(new URL("../app/auth/google/callback/route.ts", import.meta.url), "utf8");
  const authControls = readFileSync(new URL("../components/auth-controls.tsx", import.meta.url), "utf8");
  const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

  assert.match(passwordRoute, /canSignInDuringMaintenance/);
  assert.match(passwordRoute, /isPlatformOperator/);
  assert.match(googleRoute, /nextPath !== "\/admin"/);
  assert.match(googleCallback, /isPlatformOperator/);
  assert.match(authControls, /adminIntent/);
  assert.match(adminConsole, /adminIntent/);
});

test("existing non-admin sessions are withheld while maintenance is enabled", () => {
  const sessionRoute = readFileSync(new URL("../app/api/session/route.ts", import.meta.url), "utf8");
  assert.match(sessionRoute, /maintenance/);
  assert.match(sessionRoute, /isPlatformOperator/);
  assert.match(sessionRoute, /status: 503/);
});

test("platform administrators receive a dedicated maintenance control", () => {
  const endpoint = readFileSync(new URL("../app/api/admin/maintenance/route.ts", import.meta.url), "utf8");
  const adminRoute = readFileSync(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
  const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

  assert.match(endpoint, /isPlatformOperator/);
  assert.match(endpoint, /setMaintenanceMode/);
  assert.match(endpoint, /status: 403/);
  assert.match(adminRoute, /maintenance/);
  assert.match(adminConsole, /Maintenance mode/);
  assert.match(adminConsole, /\/api\/admin\/maintenance/);
  assert.match(adminConsole, /adminMode === "platform"/);
});
