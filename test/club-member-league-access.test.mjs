import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appearanceSource = readFileSync(new URL("../lib/appearance.ts", import.meta.url), "utf8");
const appShellSource = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");

test("club members are configured to access fixtures and tables for the active season", () => {
  const fixturesMenuLine = appearanceSource.split("\n").find((line) => line.includes('id: "Fixtures"')) ?? "";
  assert.match(fixturesMenuLine, /"Club Member"/, "Fixtures must be an allowed Club Member menu item");
  assert.match(fixturesMenuLine, /"Club Admin"/, "Fixtures must be an allowed Club Admin menu item");
  assert.match(
    appearanceSource,
    /"Club Member":\s*\{[\s\S]*menuItems:\s*\[[^\]]*"Fixtures"[^\]]*"Table"/,
    "Club Member default menu should include Fixtures and Tables"
  );
  assert.match(
    appShellSource,
    /if \(role === "Club Member"\) \{\s*return \[[^\]]*"Fixtures"[^\]]*"Table"/,
    "Club Member fixed menu should include Fixtures and Tables"
  );
  assert.doesNotMatch(
    appShellSource,
    /memberRestrictedPages:[^=]*=\s*\[[^\]]*"Fixtures"/,
    "Fixtures must not be restricted for Club Members"
  );
  assert.match(
    authSource,
    /activeSeasonName/,
    "Club-only contexts should use the active season rather than the literal Club season"
  );
});

test("platform operator contexts receive League Chair pilot access", () => {
  assert.match(authSource, /isAppOperator[\s\S]*hasLeagueChairAccess: true/);
});
