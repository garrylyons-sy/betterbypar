const SIDES = new Set(["home", "away"]);
const COLOUR_NAMES = new Map([
  [2, "yellow"],
  [3, "green"],
  [4, "brown"],
  [5, "blue"],
  [6, "pink"],
  [7, "black"]
]);

function integer(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function side(value, label = "Team") {
  if (!SIDES.has(value)) throw new Error(`${label} must be home or away.`);
  return value;
}

function own(object, key, fallback) {
  return Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined ? object[key] : fallback;
}

function snapshot(state) {
  const { history: _history, ...rest } = state;
  return structuredClone(rest);
}

function withHistory(state, next) {
  return {
    ...next,
    history: [...state.history, snapshot(state)]
  };
}

function ensureLive(state) {
  if (state.status !== "Live") throw new Error("This frame is no longer live.");
}

function nextSide(team) {
  return team === "home" ? "away" : "home";
}

function completedBreaks(state) {
  const breaks = [...state.breaks];
  if (state.currentBreak > 0 && state.activePlayerId) {
    breaks.push({ team: state.activeTeam, playerId: state.activePlayerId, value: state.currentBreak });
  }
  return breaks;
}

function readyIfDecided(state) {
  if (state.homeScore === state.awayScore) {
    return { ...state, expectedBall: null, winner: null };
  }
  return {
    ...state,
    expectedBall: null,
    status: "Ready",
    winner: state.homeScore > state.awayScore ? "home" : "away"
  };
}

export function createLiveFrameState(input = {}) {
  const redsRemaining = integer(own(input, "redsRemaining", 15), "Reds remaining", 0, 15);
  const phase = own(input, "phase", redsRemaining ? "reds" : "colours");
  const coloursRemaining = [...own(input, "coloursRemaining", [2, 3, 4, 5, 6, 7])];
  const expectedBall = own(
    input,
    "expectedBall",
    phase === "reds" ? "red" : coloursRemaining[0] ?? null
  );

  return {
    homeScore: integer(own(input, "homeScore", 0), "Home score"),
    awayScore: integer(own(input, "awayScore", 0), "Away score"),
    activeTeam: side(own(input, "activeTeam", "home"), "Active team"),
    activePlayerId: own(input, "activePlayerId", null),
    currentBreak: integer(own(input, "currentBreak", 0), "Current break"),
    redsRemaining,
    phase,
    expectedBall,
    coloursRemaining,
    status: own(input, "status", "Live"),
    winner: own(input, "winner", null),
    breaks: [...own(input, "breaks", [])],
    history: []
  };
}

export function pointsRemaining(state) {
  if (state.phase === "reds") {
    return state.redsRemaining * 8 + 27 + (state.expectedBall === "colour" ? 7 : 0);
  }
  return state.coloursRemaining.reduce((total, value) => total + value, 0);
}

export function snookersRequired(state, team) {
  side(team);
  const ownScore = team === "home" ? state.homeScore : state.awayScore;
  const opponentScore = team === "home" ? state.awayScore : state.homeScore;
  const shortfall = opponentScore - ownScore - pointsRemaining(state);
  return shortfall > 0 ? Math.ceil(shortfall / 4) : 0;
}

export function applyLiveFrameAction(state, action) {
  if (!action || typeof action.type !== "string") throw new Error("A scoring action is required.");

  if (action.type === "undo") {
    const previous = state.history.at(-1);
    if (!previous) throw new Error("There is nothing to undo.");
    return {
      ...structuredClone(previous),
      history: state.history.slice(0, -1).map((item) => structuredClone(item))
    };
  }

  if (action.type === "resetFrame") {
    return {
      ...createLiveFrameState(),
      history: [...state.history, snapshot(state)]
    };
  }

  ensureLive(state);

  if (action.type === "selectPlayer") {
    if (state.activePlayerId) throw new Error("End the current visit before starting another player.");
    const team = side(action.team);
    if (team !== state.activeTeam) throw new Error("Select a player from the active side.");
    if (!action.playerId) throw new Error("Choose a player.");
    return withHistory(state, { ...snapshot(state), activePlayerId: String(action.playerId) });
  }

  if (action.type === "endVisit") {
    return withHistory(state, {
      ...snapshot(state),
      breaks: completedBreaks(state),
      activeTeam: nextSide(state.activeTeam),
      activePlayerId: null,
      currentBreak: 0
    });
  }

  if (action.type === "foul") {
    if (!state.activePlayerId) throw new Error("Start a player visit before recording a foul.");
    const awardedTo = side(action.awardedTo, "Foul recipient");
    const points = integer(action.points, "Foul points", 4, 7);
    return withHistory(state, {
      ...snapshot(state),
      breaks: completedBreaks(state),
      [`${awardedTo}Score`]: state[`${awardedTo}Score`] + points,
      activeTeam: awardedTo,
      activePlayerId: null,
      currentBreak: 0
    });
  }

  if (action.type === "concede") {
    const winner = side(action.winner, "Winner");
    return withHistory(state, { ...snapshot(state), status: "Ready", winner });
  }

  if (action.type === "respotBlack") {
    if (state.homeScore !== state.awayScore || state.redsRemaining !== 0 || state.coloursRemaining.length !== 0) {
      throw new Error("Black can only be re-spotted after a tied clearance.");
    }
    return withHistory(state, {
      ...snapshot(state),
      phase: "respotted-black",
      expectedBall: 7,
      coloursRemaining: [7],
      currentBreak: 0,
      activePlayerId: null
    });
  }

  if (action.type === "correctBalls") {
    const redsRemaining = integer(action.redsRemaining, "Reds remaining", 0, 15);
    const phase = action.phase;
    if (!["reds", "colours", "respotted-black"].includes(phase)) {
      throw new Error("Choose a valid table phase.");
    }
    const coloursRemaining = Array.isArray(action.coloursRemaining)
      ? action.coloursRemaining.map((value) => integer(value, "Colour value", 2, 7))
      : [...state.coloursRemaining];
    const expectedBall = own(
      action,
      "expectedBall",
      phase === "reds" ? (redsRemaining ? "red" : "colour") : coloursRemaining[0] ?? null
    );
    return withHistory(state, {
      ...snapshot(state),
      redsRemaining,
      phase,
      expectedBall,
      coloursRemaining
    });
  }

  if (action.type === "setState") {
    const homeScore = integer(action.homeScore, "Home score");
    const awayScore = integer(action.awayScore, "Away score");
    const activeTeam = side(action.activeTeam, "Active team");
    const activePlayerId = action.activePlayerId ? String(action.activePlayerId) : null;
    const currentBreak = integer(action.currentBreak, "Current break");
    const activeScore = activeTeam === "home" ? homeScore : awayScore;
    if (currentBreak > activeScore) throw new Error("Current break cannot exceed the active team's score.");
    if (currentBreak > 0 && !activePlayerId) throw new Error("Choose the active player for the current break.");

    const redsRemaining = integer(action.redsRemaining, "Reds remaining", 0, 15);
    const phase = action.phase;
    if (!["reds", "colours", "respotted-black"].includes(phase)) {
      throw new Error("Choose a valid table phase.");
    }
    const coloursRemaining = Array.isArray(action.coloursRemaining)
      ? Array.from(new Set(action.coloursRemaining.map((value) => integer(value, "Colour value", 2, 7)))).sort()
      : [...state.coloursRemaining];

    let expectedBall;
    if (phase === "reds") {
      if (!["red", "colour"].includes(action.expectedBall)) throw new Error("Choose whether a red or colour is next.");
      if (redsRemaining === 0 && action.expectedBall === "red") throw new Error("A red cannot be next when no reds remain.");
      expectedBall = action.expectedBall;
    } else if (phase === "colours") {
      if (redsRemaining !== 0) throw new Error("Set reds remaining to zero for the colour clearance.");
      expectedBall = coloursRemaining[0] ?? null;
    } else {
      if (redsRemaining !== 0) throw new Error("Set reds remaining to zero for a re-spotted black.");
      coloursRemaining.splice(0, coloursRemaining.length, 7);
      expectedBall = 7;
    }

    return withHistory(state, {
      ...snapshot(state),
      homeScore,
      awayScore,
      activeTeam,
      activePlayerId,
      currentBreak,
      redsRemaining,
      phase,
      expectedBall,
      coloursRemaining,
      status: "Live",
      winner: null
    });
  }

  if (action.type !== "pot") throw new Error(`Unsupported scoring action: ${action.type}.`);

  const team = side(action.team);
  if (team !== state.activeTeam) throw new Error("Only the active side can score a pot.");
  const value = integer(action.value, "Ball value", 1, 7);
  const playerId = action.playerId ? String(action.playerId) : state.activePlayerId;
  if (!state.activePlayerId || !playerId) {
    throw new Error("Start a player visit before recording a pot.");
  }
  if (state.activePlayerId && playerId !== state.activePlayerId) {
    throw new Error("Select the active player before recording their pot.");
  }

  let next = {
    ...snapshot(state),
    activePlayerId: playerId,
    [`${team}Score`]: state[`${team}Score`] + value,
    currentBreak: state.currentBreak + value
  };

  if (state.phase === "reds") {
    if (state.expectedBall === "red") {
      if (value !== 1) throw new Error("A red must be potted next.");
      next.redsRemaining = state.redsRemaining - 1;
      next.expectedBall = "colour";
    } else {
      if (value < 2) throw new Error("A colour must be potted next.");
      if (state.redsRemaining === 0) {
        next.phase = "colours";
        next.coloursRemaining = [2, 3, 4, 5, 6, 7];
        next.expectedBall = 2;
      } else {
        next.expectedBall = "red";
      }
    }
  } else {
    const expected = state.coloursRemaining[0];
    if (value !== expected) {
      const name = COLOUR_NAMES.get(expected) ?? "required colour";
      throw new Error(`${name[0].toUpperCase()}${name.slice(1)} is next in the clearance.`);
    }
    next.coloursRemaining = state.coloursRemaining.slice(1);
    next.expectedBall = next.coloursRemaining[0] ?? null;
    if (next.coloursRemaining.length === 0) next = readyIfDecided(next);
  }

  return withHistory(state, next);
}
