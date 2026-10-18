import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");
const lineupRoute = readFileSync(new URL("../app/api/manager/lineup/route.ts", import.meta.url), "utf8");

test("admin team selection requests the lower-player eligibility override", () => {
  assert.match(adminConsole, /URLSearchParams\(\{[\s\S]*adminOverride: "true"[\s\S]*teamId: target\.teamId[\s\S]*fixtureId: target\.fixtureId/);
  assert.match(adminConsole, /adminOverride: true/, "admin saves should retain the authenticated override flag");
});

test("only an app operator can bypass the once-per-team play-up rule", () => {
  assert.match(lineupRoute, /requestedAdminOverride[\s\S]*isAppOperator\(user\.personId\)/);
  assert.match(lineupRoute, /loadEligibleGuestPlayerAccess\(client, teamId, fixtureId, \{ ignorePlayUpLimit: adminOverride \}\)/);
  assert.match(lineupRoute, /ignorePlayUpLimit \? result\.rows : result\.rows\.filter/);
  assert.match(lineupRoute, /ignorePlayUpLimit \? new Map\(\) : new Map/);
  assert.match(lineupRoute, /Guest Player already played for/, "manager saves should still enforce the normal restriction");
});

test("an administrator can unpublish a lineup without removing its selections", () => {
  assert.match(lineupRoute, /action === "unpublish"/);
  assert.match(lineupRoute, /if \(!adminOverride\)[\s\S]*Only an administrator can unpublish a lineup/);
  assert.match(lineupRoute, /set status = 'Draft',[\s\S]*published_at = null/);
  assert.match(lineupRoute, /Unpublished lineup/);
  assert.match(lineupRoute, /Frame scoring has already started/);
  assert.match(adminConsole, /Unpublish lineup/);
  assert.match(adminConsole, /saveLineup\("unpublish"\)/);
});
