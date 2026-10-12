import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  participantAccessDecision,
  presentLastManStandingEntries,
  summarizeLastManStandingCompetitions
} from "../lib/server/last-man-standing.ts";

test("participant access distinguishes authentication, League Chair pilot access, and audience", () => {
  assert.deepEqual(participantAccessDecision({ authenticated: false, hasLeagueChairAccess: false, audience: "League Chair" }), {
    allowed: false,
    status: 401,
    error: "Sign in required."
  });
  assert.deepEqual(participantAccessDecision({ authenticated: true, hasLeagueChairAccess: false, audience: "League Chair" }), {
    allowed: false,
    status: 403,
    error: "League Chair access required."
  });
  assert.equal(participantAccessDecision({ authenticated: true, hasLeagueChairAccess: true, audience: "League Chair" }).allowed, true);
  assert.equal(participantAccessDecision({ authenticated: true, hasLeagueChairAccess: false, audience: "Everyone" }).allowed, false, "Everyone is stored but not enabled during the pilot");
});

test("competition summaries keep concurrent competitions separate and provide panel state", () => {
  const summaries = summarizeLastManStandingCompetitions([
    { id: "one", name: "Autumn LMS", status: "Open", entrantCount: 12, standingCount: 9, entryId: "entry-1", entryStatus: "Standing", roundId: "round-1", roundName: "Round 2", cycleNumber: 1, roundNumber: 2, deadlineAt: "2026-10-15T11:00:00.000Z", pickOneName: "A Player", pickTwoName: "B Player" },
    { id: "two", name: "Christmas LMS", status: "Open", entrantCount: 8, standingCount: 8, entryId: null, entryStatus: null, roundId: "round-2", roundName: "Round 1", cycleNumber: 1, roundNumber: 1, deadlineAt: "2026-12-03T12:00:00.000Z", pickOneName: null, pickTwoName: null }
  ]);

  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries[0].panel, {
    roundLabel: "Cycle 1 · Round 2",
    picks: ["A Player", "B Player"],
    entrantStatus: "Standing",
    remainingLabel: "9 of 12 standing",
    deadlineAt: "2026-10-15T11:00:00.000Z"
  });
  assert.equal(summaries[1].isEntered, false);
  assert.equal(summaries[1].currentRound.id, "round-2");
});

test("current picks are private until each owner deadline but always visible to their owner", () => {
  const entries = [
    { id: "mine", personName: "Me", status: "Standing", deadlineAt: "2026-10-15T11:00:00.000Z", picks: [{ slotNumber: 1, playerName: "Mine One" }, { slotNumber: 2, playerName: "Mine Two" }] },
    { id: "other", personName: "Other", status: "Standing", deadlineAt: "2026-10-15T11:00:00.000Z", picks: [{ slotNumber: 1, playerName: "Other One" }, { slotNumber: 2, playerName: "Other Two" }] }
  ];

  const before = presentLastManStandingEntries(entries, { viewerEntryId: "mine", now: new Date("2026-10-15T10:59:59.000Z") });
  assert.deepEqual(before[0].picks.map((pick) => pick.playerName), ["Mine One", "Mine Two"]);
  assert.deepEqual(before[1].picks, []);
  assert.equal(before[1].picksHidden, true);

  const atDeadline = presentLastManStandingEntries(entries, { viewerEntryId: "mine", now: new Date("2026-10-15T11:00:00.000Z") });
  assert.deepEqual(atDeadline[1].picks.map((pick) => pick.playerName), ["Other One", "Other Two"]);
  assert.equal(atDeadline[1].picksHidden, false);
});

test("participant routes authenticate and delegate to the Last Man Standing service", () => {
  const routeFiles = [
    "../app/api/last-man-standing/route.ts",
    "../app/api/last-man-standing/[competitionId]/route.ts"
  ];
  for (const path of routeFiles) {
    const url = new URL(path, import.meta.url);
    assert.equal(existsSync(url), true, `${path} should exist`);
    const source = readFileSync(url, "utf8");
    assert.match(source, /currentUserFromRequest/);
    assert.match(source, /hasLastManStandingPilotAccess/);
  }
});

test("entry and pick routes keep pilot authorization at the HTTP boundary", () => {
  const routes = [
    ["../app/api/last-man-standing/[competitionId]/entries/route.ts", /enterLastManStandingCompetition/],
    ["../app/api/last-man-standing/[competitionId]/picks/route.ts", /saveLastManStandingPicks/]
  ];
  for (const [path, delegate] of routes) {
    const url = new URL(path, import.meta.url);
    assert.equal(existsSync(url), true, `${path} should exist`);
    const source = readFileSync(url, "utf8");
    assert.match(source, /currentUserFromRequest/);
    assert.match(source, /hasLastManStandingPilotAccess/);
    assert.match(source, delegate);
  }
});

test("entry derives its tier and fixed source team from active roles", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  assert.match(source, /resolveEntryTierOptions/);
  assert.match(source, /roleOptions\.defaultOption/);
  assert.match(source, /source_team_id\)/);
  assert.match(source, /ALREADY_ENTERED/);
  assert.match(source, /event_type, payload/);
  assert.match(source, /'Entry Created'/);
});

test("pick saves lock rows and enforce deadline, versions, distinct picks, and consumed history", () => {
  const source = readFileSync(new URL("../lib/server/last-man-standing.ts", import.meta.url), "utf8");
  assert.match(source, /for update of e, r/i);
  assert.match(source, /order by slot_number for update/i);
  assert.match(source, /canEditPicks/);
  assert.match(source, /validateManualPicks/);
  assert.match(source, /cycle_number = \$2 and p\.round_id <> \$3/);
  assert.match(source, /VERSION_CONFLICT/);
  assert.match(source, /VERSIONS_REQUIRED/);
  assert.match(source, /version = public\.last_man_standing_pick\.version \+ 1/);
  assert.match(source, /'Pick Saved'/);
  assert.match(source, /previousPlayerId/);
});

test("manual picks with the selected player as the effective player are valid persistence", () => {
  for (const path of ["../supabase/last_man_standing.sql", "../supabase/schema.sql"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /selected_player_id = effective_player_id/);
  }
});
