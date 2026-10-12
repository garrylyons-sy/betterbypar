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
  const panel = read("../components/last-man-standing.tsx");
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /interclub:refresh-panels/);
  assert.match(panel, /window\.addEventListener\("focus"/);
});

test("participant UI exposes deadline, primary action, and automatic replacement reasons", () => {
  const source = readFileSync(new URL("../components/last-man-standing.tsx", import.meta.url), "utf8");
  assert.match(source, /Deadline/);
  assert.match(source, /Enter now|Make picks|Change picks/);
  assert.match(source, /automaticReason/);
  assert.match(source, /Automatic replacement/);
  assert.match(source, /View competition/);
  assert.match(source, /message \|\| "No competition is currently available\."/);
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
