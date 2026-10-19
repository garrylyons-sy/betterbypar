import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("completed fixtures remain clickable without an Open match prompt", () => {
  assert.match(appShell, /const canOpenRow = Boolean\(hasVisibleLiveScoring \|\| canManage \|\| canInspect\)/);
  assert.match(appShell, /\{canManage && fixture\.status !== "Completed" \? \(/);
  assert.match(appShell, /fixtureHasStarted\(fixture\) \? "Open match" : "Pick team"/);
});
