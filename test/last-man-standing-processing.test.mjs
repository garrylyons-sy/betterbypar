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

test("round settlement continues with survivors and ends with either a winner or nobody standing", () => {
  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Standing" },
    { entryId: "two", status: "Eliminated" },
    { entryId: "three", status: "Standing" }
  ]), { state: "Continue", standingEntryIds: ["one", "three"] });

  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Standing" },
    { entryId: "two", status: "Eliminated" }
  ]), { state: "Winner", winnerEntryId: "one" });

  assert.deepEqual(deriveRoundSettlement([
    { entryId: "one", status: "Eliminated" },
    { entryId: "two", status: "Eliminated" }
  ]), { state: "No Winner", eliminatedEntryIds: ["one", "two"] });
});

test("processing is advisory-locked, snapshots table order, and preserves unresolved picks", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /last_man_standing_team_order_snapshot/);
  assert.match(source, /orderedFallbackCandidates/);
  assert.match(source, /Needs Review/);
  assert.match(source, /Automatic Pick/);
  assert.match(source, /processing_time/);
  assert.match(source, /processingTime/);
});

test("settlement uses official game winners, stops on no winner, and supports audited reopening", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  const settle = source.slice(source.indexOf("export async function settleLastManStandingRound"), source.indexOf("export async function startNextLastManStandingCycle"));
  assert.match(source, /winner_team_id/);
  assert.match(source, /outcomeForPickedPlayer/);
  assert.match(source, /Winner Declared/);
  assert.match(source, /roundDecision\.state === "No Winner"/);
  assert.match(source, /Round Reopened/);
  assert.match(source, /openNextLastManStandingRound/);
  assert.match(source, /createNextLastManStandingCycle/);
  assert.match(source, /startNextLastManStandingCycle/);
  assert.match(source, /eliminated_round_id = \$1/);
  assert.match(source, /join public\.person_team_role ptr/);
  assert.doesNotMatch(source, /where round_id = \$1;\s*update public\.last_man_standing_entry/);
  assert.doesNotMatch(source, /where id = \$1;\s*update public\.last_man_standing_competition/);
  assert.match(source, /f\.original_fixture_date is not null/);
  assert.match(source, /sourceFixture.*rescheduledOutsideRound/s);
  assert.match(source, /table_order_snapshot/);
  assert.match(source, /LATER_ROUND_ACTIVE/);
  assert.match(source, /between mapped_week\.starts_on and mapped_week\.starts_on \+ 6/);
  assert.ok((source.match(/hashtext\('lifecycle'\)/g) ?? []).length >= 4);
  assert.match(source, /c\.status in \('Open', 'In Progress'\)/);
  assert.match(settle, /incompleteRoundFixtures/);
  assert.match(settle, /eliminated_round_id = case when \$2 = 'Eliminated' then \$3::uuid else null end/);
  assert.match(settle, /f\.original_fixture_date is null/);
  assert.doesNotMatch(source, /status not in \([^)]*'Postponed'/);
  assert.match(source, /lower\(fw\.week_label\) not like '%break%'/i);
  assert.match(source, /original_fixture_date is null/i);
  assert.match(source, /currentScheduleCount/);
  assert.doesNotMatch(source, /schedules\.rows\.length !== 3/);
  assert.doesNotMatch(settle, /set status = 'Standing', winner = false, eliminated_round_id = null/);
  const newCycle = source.slice(source.indexOf("export async function startNextLastManStandingCycle"), source.indexOf("export async function reopenLastManStandingRound"));
  assert.match(newCycle, /set status = 'Standing', winner = false, eliminated_round_id = null/);
  const followingRound = source.slice(source.indexOf("async function createFollowingLastManStandingRound"), source.indexOf("async function openNextLastManStandingRound"));
  const scheduleLookup = followingRound.slice(followingRound.indexOf("const schedules"), followingRound.indexOf("if (!currentScheduleCount"));
  assert.doesNotMatch(scheduleLookup, /\$3/);
  assert.match(scheduleLookup, /f\.original_fixture_date is null/i);
  assert.match(scheduleLookup, /between fw\.starts_on and fw\.starts_on \+ 6/i);
});

test("completing a match immediately asks Last Man Standing to settle due rounds", () => {
  const route = readFileSync(new URL("../app/api/manager/lineup/route.ts", import.meta.url), "utf8");
  const completion = route.slice(route.indexOf('if (action === "completeMatch")'), route.indexOf('if (action === "recordBreak")'));
  assert.match(completion, /processDueLastManStandingWork/);
  assert.ok(completion.indexOf("completeMatch") < completion.indexOf("processDueLastManStandingWork"));
});

test("settlement calculates every result before mutating picks", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  const settle = source.slice(source.indexOf("export async function settleLastManStandingRound"), source.indexOf("export async function reopenLastManStandingRound"));
  assert.ok(settle.indexOf("const calculatedPicks") < settle.indexOf("set source_game_id"));
  assert.ok(settle.indexOf("if (calculatedPicks.some") < settle.indexOf("set source_game_id"));
});
