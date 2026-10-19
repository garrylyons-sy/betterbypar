import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");
const authGateway = readFileSync(new URL("../components/auth-gateway.tsx", import.meta.url), "utf8");

test("admin restores the last successful session before refreshing silently", () => {
  assert.match(adminConsole, /ADMIN_SESSION_CACHE_KEY/);
  assert.match(adminConsole, /readAdminSessionCache\(\)/);
  assert.match(adminConsole, /applyAdminData\(cached\.data\)/);
  assert.match(adminConsole, /refreshAdminData\(\{ silent: true \}\)/);
  assert.match(adminConsole, /writeAdminSessionCache\(data\)/);
});

test("admin remembers its selected section and clears cached data when access ends", () => {
  assert.match(adminConsole, /readAdminSessionTab\(\)/);
  assert.match(adminConsole, /writeAdminSessionTab\(nextTab\)/);
  assert.match(adminConsole, /clearAdminSessionCache\(\)/);
  assert.match(adminConsole, /window\.sessionStorage\.removeItem\(ADMIN_SESSION_CACHE_KEY\)/);
  assert.match(adminConsole, /window\.sessionStorage\.removeItem\(ADMIN_SESSION_TAB_KEY\)/);
  assert.match(authGateway, /sessionStorage\.removeItem\("interclub:admin-session-data:v1"\)/);
  assert.match(authGateway, /sessionStorage\.removeItem\("interclub:admin-session-tab:v1"\)/);
});
