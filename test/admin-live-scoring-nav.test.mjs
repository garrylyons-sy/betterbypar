import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("platform admin navigation opens an integrated live-scoring panel immediately after matches", () => {
  assert.match(adminConsole, /label: "Matches"[\s\S]*label: "Live Scoring"/);
  assert.match(adminConsole, /type AdminTab = [^;]*"live-scoring"/);
  assert.match(adminConsole, /props\.tab === "live-scoring"[\s\S]*<LiveScoringDashboard embedded/);
  assert.doesNotMatch(adminConsole, /href: "\/livescoring"/);
});

test("club admins do not receive the platform live-scoring navigation item", () => {
  assert.doesNotMatch(adminConsole, /const clubAdminTabs:[^=]*= \[[^\]]*"live-scoring"/);
});
