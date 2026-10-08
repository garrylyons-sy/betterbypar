import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("saving a manager game result immediately refreshes the fixture score", () => {
  const recordResult = appShell.match(
    /async function recordGameWinner[\s\S]*?async function completeMatch/
  )?.[0] ?? "";

  assert.match(recordResult, /if \(!response\.ok\) throw new Error/);
  assert.match(recordResult, /setPayload\(data\)[\s\S]*window\.dispatchEvent\(new Event\("interclub:refresh-panels"\)\)/);
});
