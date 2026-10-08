import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("platform admin navigation links to live scoring immediately after matches", () => {
  assert.match(adminConsole, /label: "Matches"[\s\S]*label: "Live Scoring"/);
  assert.match(adminConsole, /id: "live-scoring"[\s\S]*href: "\/livescoring"/);
  assert.match(adminConsole, /href=\{item\.href\}/);
});

test("club admins do not receive the platform live-scoring navigation item", () => {
  assert.doesNotMatch(adminConsole, /const clubAdminTabs:[^=]*= \[[^\]]*"live-scoring"/);
});
