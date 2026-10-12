import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditPicks,
  deadlineForEntry,
  orderedFallbackCandidates,
  outcomeForPickedPlayer,
  resolveEntryTierOptions,
  validateManualPicks
} from "../lib/last-man-standing-rules.mjs";

const role = (value, leagueName, teamId, teamName = teamId) => ({
  role: value,
  leagueName,
  teamId,
  teamName,
  active: true
});

test("player roles take priority over manager roles when resolving entry tiers", () => {
  const result = resolveEntryTierOptions([
    role("Manager", "A League", "castle-a"),
    role("Player", "B League", "castle-b")
  ]);

  assert.deepEqual(result.options.map((option) => option.tier), ["B"]);
  assert.equal(result.defaultOption.sourceRole, "Player");
  assert.equal(result.defaultOption.teamId, "castle-b");
});

test("C and D team roles map into the C player pool", () => {
  const result = resolveEntryTierOptions([
    role("Player", "C League", "castle-c", "Castle C"),
    role("Player", "C League", "castle-d", "Castle D")
  ]);

  assert.deepEqual(result.options.map((option) => [option.tier, option.teamName]), [
    ["C", "Castle C"],
    ["C", "Castle D"]
  ]);
});

test("multiple player tiers are offered with the highest as default", () => {
  const result = resolveEntryTierOptions([
    role("Player", "C League", "castle-c"),
    role("Player", "A League", "castle-a"),
    role("Manager", "B League", "castle-b")
  ]);

  assert.deepEqual(result.options.map((option) => option.tier), ["A", "C"]);
  assert.equal(result.defaultOption.tier, "A");
});

test("manager roles are used only when no active player role exists", () => {
  const result = resolveEntryTierOptions([
    role("Manager", "C League", "castle-c"),
    role("Manager", "B League", "castle-b"),
    { ...role("Player", "A League", "castle-a"), active: false }
  ]);

  assert.deepEqual(result.options.map((option) => option.tier), ["B", "C"]);
  assert.equal(result.defaultOption.sourceRole, "Manager");
});

test("a League Chair without a player or manager role has no entry tier", () => {
  assert.deepEqual(resolveEntryTierOptions([]), { options: [], defaultOption: null });
});

test("entry deadlines use noon Europe Dublin during summer time", () => {
  assert.equal(
    deadlineForEntry({ ownFixtureDate: "2026-10-15", defaultMatchDate: "2026-10-15" }).toISOString(),
    "2026-10-15T11:00:00.000Z"
  );
});

test("entry deadlines follow Europe Dublin when daylight saving has ended", () => {
  assert.equal(
    deadlineForEntry({ ownFixtureDate: "2026-11-05", defaultMatchDate: "2026-11-05" }).toISOString(),
    "2026-11-05T12:00:00.000Z"
  );
});

test("an entrant's own fixture date overrides another date in the fixture week", () => {
  assert.equal(
    deadlineForEntry({ ownFixtureDate: "2026-10-13", defaultMatchDate: "2026-10-15" }).toISOString(),
    "2026-10-13T11:00:00.000Z"
  );
});

test("picks are editable before noon but not at or after noon", () => {
  const input = { ownFixtureDate: "2026-10-15", defaultMatchDate: "2026-10-15" };

  assert.deepEqual(canEditPicks({ ...input, now: new Date("2026-10-15T10:59:59.999Z") }).allowed, true);
  assert.deepEqual(canEditPicks({ ...input, now: new Date("2026-10-15T11:00:00.000Z") }), {
    allowed: false,
    code: "PICKS_LOCKED",
    message: "Selections closed at 12:00 on the match day.",
    deadline: "2026-10-15T11:00:00.000Z"
  });
  assert.equal(canEditPicks({ ...input, now: new Date("2026-10-15T12:00:00.000Z") }).allowed, false);
});

const selectablePlayers = [
  { id: "a1", name: "A One", active: true, registered: true, typedGuest: false, tier: "A" },
  { id: "a2", name: "A Two", active: true, registered: true, typedGuest: false, tier: "A" },
  { id: "b1", name: "B One", active: true, registered: true, typedGuest: false, tier: "B" },
  { id: "guest", name: "Guest", active: true, registered: false, typedGuest: true, tier: "A" }
];

test("manual picks reject duplicate, consumed, inactive, guest, and out-of-tier players", () => {
  const base = { candidates: selectablePlayers, consumedPlayerIds: [], tier: "A" };

  assert.equal(validateManualPicks({ ...base, playerIds: ["a1", "a1"] }).code, "DUPLICATE_PICK");
  assert.equal(validateManualPicks({ ...base, playerIds: ["a1", "a2"], consumedPlayerIds: ["a2"] }).code, "PLAYER_ALREADY_USED");
  assert.equal(validateManualPicks({ ...base, playerIds: ["a1", "guest"] }).code, "PLAYER_INELIGIBLE");
  assert.equal(validateManualPicks({ ...base, playerIds: ["a1", "b1"] }).code, "PLAYER_INELIGIBLE");
  assert.equal(validateManualPicks({
    ...base,
    playerIds: ["a1", "a2"],
    candidates: selectablePlayers.map((player) => player.id === "a2" ? { ...player, active: false } : player)
  }).code, "PLAYER_INELIGIBLE");
  assert.deepEqual(validateManualPicks({ ...base, playerIds: ["a1", "a2"] }), { valid: true, code: null, message: "" });
});

const fixtures = [
  { id: "fixture-source", homeTeamId: "source", awayTeamId: "top", status: "Scheduled", rescheduledOutsideRound: false },
  { id: "fixture-next", homeTeamId: "next", awayTeamId: "other", status: "Scheduled", rescheduledOutsideRound: false }
];

const lineupPlayers = [
  { playerId: "source-2", teamId: "source", fixtureId: "fixture-source", lineupSlotId: "s2", slotNumber: 2, playerOrder: 1, active: true, registered: true, typedGuest: false, tier: "A" },
  { playerId: "source-1", teamId: "source", fixtureId: "fixture-source", lineupSlotId: "s1", slotNumber: 1, playerOrder: 1, active: true, registered: true, typedGuest: false, tier: "A" },
  { playerId: "source-guest", teamId: "source", fixtureId: "fixture-source", lineupSlotId: "sg", slotNumber: 1, playerOrder: 2, active: true, registered: false, typedGuest: true, tier: "A" },
  { playerId: "source-lower", teamId: "source", fixtureId: "fixture-source", lineupSlotId: "sl", slotNumber: 3, playerOrder: 1, active: true, registered: true, typedGuest: false, tier: "B" },
  { playerId: "next-1", teamId: "next", fixtureId: "fixture-next", lineupSlotId: "n1", slotNumber: 1, playerOrder: 1, active: true, registered: true, typedGuest: false, tier: "A" },
  { playerId: "top-1", teamId: "top", fixtureId: "fixture-source", lineupSlotId: "t1", slotNumber: 1, playerOrder: 1, active: true, registered: true, typedGuest: false, tier: "A" }
];

test("fallback starts with the entrant team and preserves lineup order", () => {
  const candidates = orderedFallbackCandidates({
    sourceTeamId: "source",
    tier: "A",
    teamOrder: [{ teamId: "top", position: 1 }, { teamId: "source", position: 2 }, { teamId: "next", position: 3 }, { teamId: "other", position: 4 }],
    fixtures,
    lineupPlayers,
    consumedPlayerIds: [],
    excludedPlayerIds: []
  });

  assert.deepEqual(candidates.map((candidate) => candidate.playerId), ["source-1", "source-2", "next-1", "top-1"]);
  assert.deepEqual(candidates[0], {
    playerId: "source-1",
    sourceTeamId: "source",
    sourceFixtureId: "fixture-source",
    sourceLineupSlotId: "s1",
    automaticReason: "Automatic replacement from published lineup"
  });
});

test("fallback continues for a second pick, skips used players, and wraps from bottom to top", () => {
  const candidates = orderedFallbackCandidates({
    sourceTeamId: "other",
    tier: "A",
    teamOrder: [{ teamId: "top", position: 1 }, { teamId: "source", position: 2 }, { teamId: "next", position: 3 }, { teamId: "other", position: 4 }],
    fixtures,
    lineupPlayers,
    consumedPlayerIds: ["source-1"],
    excludedPlayerIds: ["top-1"]
  });

  assert.deepEqual(candidates.map((candidate) => candidate.playerId), ["source-2", "next-1"]);
});

test("fallback ignores cancelled and out-of-round rescheduled fixtures", () => {
  assert.deepEqual(orderedFallbackCandidates({
    sourceTeamId: "source",
    tier: "A",
    teamOrder: [{ teamId: "source", position: 1 }, { teamId: "next", position: 2 }],
    fixtures: fixtures.map((fixture) => fixture.id === "fixture-source" ? { ...fixture, rescheduledOutsideRound: true } : { ...fixture, status: "Cancelled" }),
    lineupPlayers,
    consumedPlayerIds: [],
    excludedPlayerIds: []
  }), []);
});

test("picked-player outcomes include singles and doubles and remain pending without a winner", () => {
  const singles = {
    winnerTeamId: "home",
    homeTeamId: "home",
    awayTeamId: "away",
    homePlayerIds: ["home-1"],
    awayPlayerIds: ["away-1"]
  };
  const doubles = { ...singles, homePlayerIds: ["home-1", "home-2"], awayPlayerIds: ["away-1", "away-2"] };

  assert.equal(outcomeForPickedPlayer({ playerId: "home-1", game: singles }), "Won");
  assert.equal(outcomeForPickedPlayer({ playerId: "away-1", game: singles }), "Lost");
  assert.equal(outcomeForPickedPlayer({ playerId: "home-2", game: doubles }), "Won");
  assert.equal(outcomeForPickedPlayer({ playerId: "away-2", game: doubles }), "Lost");
  assert.equal(outcomeForPickedPlayer({ playerId: "away-2", game: { ...doubles, winnerTeamId: null } }), "Pending");
  assert.equal(outcomeForPickedPlayer({ playerId: "unknown", game: doubles }), "Pending");
});
