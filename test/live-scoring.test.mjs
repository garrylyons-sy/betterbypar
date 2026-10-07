import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLiveFrameAction,
  createLiveFrameState,
  pointsRemaining,
  snookersRequired
} from "../lib/live-scoring.mjs";

test("creates a standard frame with fifteen reds and 147 available", () => {
  const state = createLiveFrameState({ activeTeam: "home", activePlayerId: "home-1" });

  assert.equal(state.redsRemaining, 15);
  assert.equal(state.phase, "reds");
  assert.equal(state.expectedBall, "red");
  assert.equal(state.currentBreak, 0);
  assert.equal(pointsRemaining(state), 147);
});

test("requires alternating reds and colours while reds remain", () => {
  const start = createLiveFrameState({ activeTeam: "home", activePlayerId: "home-1" });
  const afterRed = applyLiveFrameAction(start, { type: "pot", team: "home", playerId: "home-1", value: 1 });
  const afterBlack = applyLiveFrameAction(afterRed, { type: "pot", team: "home", playerId: "home-1", value: 7 });

  assert.equal(afterRed.redsRemaining, 14);
  assert.equal(afterRed.expectedBall, "colour");
  assert.equal(afterRed.currentBreak, 1);
  assert.equal(pointsRemaining(afterRed), 146);
  assert.equal(afterBlack.expectedBall, "red");
  assert.equal(afterBlack.homeScore, 8);
  assert.equal(afterBlack.currentBreak, 8);
  assert.throws(
    () => applyLiveFrameAction(afterBlack, { type: "pot", team: "home", playerId: "home-1", value: 5 }),
    /red must be potted/i
  );
});

test("moves from the final red colour into ordered colour clearance", () => {
  const state = createLiveFrameState({
    activeTeam: "away",
    activePlayerId: "away-1",
    redsRemaining: 1
  });
  const red = applyLiveFrameAction(state, { type: "pot", team: "away", playerId: "away-1", value: 1 });
  const finalRedColour = applyLiveFrameAction(red, { type: "pot", team: "away", playerId: "away-1", value: 6 });
  const yellow = applyLiveFrameAction(finalRedColour, { type: "pot", team: "away", playerId: "away-1", value: 2 });

  assert.equal(red.redsRemaining, 0);
  assert.equal(red.phase, "reds");
  assert.equal(red.expectedBall, "colour");
  assert.equal(finalRedColour.phase, "colours");
  assert.equal(finalRedColour.expectedBall, 2);
  assert.deepEqual(finalRedColour.coloursRemaining, [2, 3, 4, 5, 6, 7]);
  assert.equal(yellow.expectedBall, 3);
  assert.deepEqual(yellow.coloursRemaining, [3, 4, 5, 6, 7]);
  assert.throws(
    () => applyLiveFrameAction(yellow, { type: "pot", team: "away", playerId: "away-1", value: 5 }),
    /green.*next/i
  );
});

test("awards foul points and moves the visit to the receiving side", () => {
  const start = createLiveFrameState({ activeTeam: "home", activePlayerId: "home-1" });
  const scored = applyLiveFrameAction(start, { type: "pot", team: "home", playerId: "home-1", value: 1 });
  const foul = applyLiveFrameAction(scored, { type: "foul", awardedTo: "away", points: 6 });

  assert.equal(foul.awayScore, 6);
  assert.equal(foul.activeTeam, "away");
  assert.equal(foul.activePlayerId, null);
  assert.equal(foul.currentBreak, 0);
  assert.throws(() => applyLiveFrameAction(start, { type: "foul", awardedTo: "away", points: 3 }), /between 4 and 7/i);
});

test("ends a visit and allows a doubles player to be selected", () => {
  const start = createLiveFrameState({ activeTeam: "home", activePlayerId: "home-1" });
  const ended = applyLiveFrameAction(start, { type: "endVisit" });
  const selected = applyLiveFrameAction(ended, { type: "selectPlayer", team: "away", playerId: "away-2" });

  assert.equal(ended.activeTeam, "away");
  assert.equal(ended.currentBreak, 0);
  assert.equal(selected.activePlayerId, "away-2");
  assert.throws(
    () => applyLiveFrameAction(ended, { type: "selectPlayer", team: "home", playerId: "home-2" }),
    /active side/i
  );
});

test("undo restores the complete prior scoring state", () => {
  const start = createLiveFrameState({ activeTeam: "home", activePlayerId: "home-1" });
  const red = applyLiveFrameAction(start, { type: "pot", team: "home", playerId: "home-1", value: 1 });
  const undone = applyLiveFrameAction(red, { type: "undo" });

  assert.equal(undone.homeScore, 0);
  assert.equal(undone.redsRemaining, 15);
  assert.equal(undone.expectedBall, "red");
  assert.equal(undone.history.length, 0);
  assert.throws(() => applyLiveFrameAction(start, { type: "undo" }), /nothing to undo/i);
});

test("supports concession and a tied re-spotted black", () => {
  const conceded = applyLiveFrameAction(
    createLiveFrameState({ activeTeam: "home", homeScore: 20, awayScore: 50 }),
    { type: "concede", winner: "away" }
  );
  assert.equal(conceded.status, "Ready");
  assert.equal(conceded.winner, "away");

  const tiedClearance = createLiveFrameState({
    activeTeam: "away",
    homeScore: 60,
    awayScore: 60,
    redsRemaining: 0,
    phase: "colours",
    expectedBall: null,
    coloursRemaining: []
  });
  const respotted = applyLiveFrameAction(tiedClearance, { type: "respotBlack" });
  const black = applyLiveFrameAction(respotted, { type: "pot", team: "away", playerId: "away-1", value: 7 });

  assert.equal(respotted.phase, "respotted-black");
  assert.deepEqual(respotted.coloursRemaining, [7]);
  assert.equal(pointsRemaining(respotted), 7);
  assert.equal(black.status, "Ready");
  assert.equal(black.winner, "away");
});

test("calculates snookers required from the trailing score and available points", () => {
  const state = createLiveFrameState({
    homeScore: 30,
    awayScore: 40,
    redsRemaining: 0,
    phase: "colours",
    expectedBall: 7,
    coloursRemaining: [7]
  });

  assert.equal(pointsRemaining(state), 7);
  assert.equal(snookersRequired(state, "home"), 1);
  assert.equal(snookersRequired(state, "away"), 0);
});
