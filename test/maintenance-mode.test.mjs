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
