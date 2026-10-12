import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("League Chair access adds the Last Man Standing page and home panel", () => {
  assert.equal(existsSync(new URL("../components/last-man-standing.tsx", import.meta.url)), true);
  const shell = read("../components/app-shell.tsx");
  assert.match(shell, /Last Man Standing/);
  assert.match(shell, /hasLeagueChairAccess/);
  assert.match(shell, /LastManStandingHomePanel/);
  assert.match(shell, /LastManStandingPage/);
});

test("competition UI handles concurrent competitions, entry, privacy and noon locking", () => {
  const source = read("../components/last-man-standing.tsx");
  assert.match(source, /competitions\.map/);
  assert.match(source, /Enter competition/);
  assert.match(source, /Choose first player/);
  assert.match(source, /Choose second player/);
  assert.match(source, /Already picked/);
  assert.match(source, /Selections closed/);
  assert.match(source, /picksHidden/);
  assert.match(source, /Automatic/);
  assert.match(source, /History/);
});

test("appearance identities include Last Man Standing without adding it to ordinary defaults", () => {
  const types = read("../lib/types.ts");
  const appearance = read("../lib/appearance.ts");
  assert.match(types, /"Last Man Standing"/);
  assert.match(appearance, /id: "Last Man Standing"/);
  const playerDefault = appearance.match(/Player:\s*\{[\s\S]*?\n  \},/)?.[0] ?? "";
  assert.doesNotMatch(playerDefault, /Last Man Standing/);
});
