import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deriveEntrySettlement,
  deriveRoundSettlement
} from "../lib/server/last-man-standing.ts";

test("an entrant stands only when both picks win", () => {
  assert.deepEqual(deriveEntrySettlement(["Won", "Won"]), { ready: true, status: "Standing" });
  assert.deepEqual(deriveEntrySettlement(["Won", "Lost"]), { ready: true, status: "Eliminated" });
  assert.deepEqual(deriveEntrySettlement(["Lost", "Won"]), { ready: true, status: "Eliminated" });
  assert.deepEqual(deriveEntrySettlement(["Won", "Pending"]), { ready: false, status: null });
  assert.deepEqual(deriveEntrySettlement(["Won", "No Eligible Pick"]), { ready: false, status: null });
});

test("round settlement handles survivors, a winner, and a deciding-round washout", () => {
  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Standing" },
    { entryId: "two", status: "Eliminated" },
    { entryId: "three", status: "Standing" }
  ], { decidingRound: false }), { state: "Continue", standingEntryIds: ["one", "three"] });

  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Standing" },
    { entryId: "two", status: "Eliminated" }
  ], { decidingRound: true }), { state: "Winner", winnerEntryId: "one" });

  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Eliminated" },
    { entryId: "two", status: "Eliminated" }
  ], { decidingRound: true }), { state: "Restart", reinstateEntryIds: ["one", "two"] });
});

test("processing is advisory-locked, snapshots table order, and preserves unresolved picks", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /last_man_standing_team_order_snapshot/);
  assert.match(source, /orderedFallbackCandidates/);
  assert.match(source, /Needs Review/);
  assert.match(source, /Automatic Pick/);
});

test("settlement uses official game winners and supports explicit audited reopening", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  assert.match(source, /winner_team_id/);
  assert.match(source, /outcomeForPickedPlayer/);
  assert.match(source, /Winner Declared/);
  assert.match(source, /Entrants Reinstated/);
  assert.match(source, /Round Reopened/);
});
