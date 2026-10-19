export const ladderMatchFormats = ["1 Frame", "Best of 3", "Best of 5"];
export const ladderInitialOrders = ["Surname", "Random"];
export const ladderRechallengeCooldownDays = 7;

export function normalizeLadderInitialOrder(value) {
  const initialOrder = String(value ?? "Surname").trim();
  if (!ladderInitialOrders.includes(initialOrder)) {
    throw new Error("Starting order must be Surname or Random.");
  }
  return initialOrder;
}

function boundedInteger(value, fallback, minimum, maximum, label) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function normalizeLadderSettings(input = {}) {
  const matchFormat = String(input.matchFormat ?? input.match_format ?? "Best of 3").trim();
  if (!ladderMatchFormats.includes(matchFormat)) {
    throw new Error("Match format must be 1 Frame, Best of 3 or Best of 5.");
  }

  return {
    name: String(input.name ?? "Club Ladder").trim() || "Club Ladder",
    matchFormat,
    challengeRange: boundedInteger(input.challengeRange ?? input.challenge_range, 3, 1, 10, "Challenge range"),
    responseHours: boundedInteger(input.responseHours ?? input.response_hours, 48, 12, 168, "Response time"),
    playWithinDays: boundedInteger(input.playWithinDays ?? input.play_within_days, 14, 1, 60, "Playing window"),
    useHandicap: input.useHandicap === undefined && input.use_handicap === undefined
      ? true
      : Boolean(input.useHandicap ?? input.use_handicap),
    active: input.active === undefined ? true : Boolean(input.active)
  };
}

export function requiredFrameWins(matchFormat) {
  if (matchFormat === "1 Frame") return 1;
  if (matchFormat === "Best of 3") return 2;
  if (matchFormat === "Best of 5") return 3;
  throw new Error("Unknown ladder match format.");
}

export function canChallengePosition(challengerPosition, challengedPosition, challengeRange) {
  const placesAbove = Number(challengerPosition) - Number(challengedPosition);
  return placesAbove >= 1 && placesAbove <= Number(challengeRange);
}

export function canRejectChallenge(previousRejections) {
  return Number(previousRejections) < 1;
}

export function rechallengeAvailableAt(rejectedAt) {
  if (!rejectedAt) return null;
  const rejected = new Date(rejectedAt);
  if (!Number.isFinite(rejected.getTime())) return null;
  return new Date(rejected.getTime() + ladderRechallengeCooldownDays * 24 * 60 * 60 * 1000);
}

export function canRechallenge(rejectedAt, now = new Date()) {
  const availableAt = rechallengeAvailableAt(rejectedAt);
  if (!availableAt) return true;
  const current = new Date(now);
  return Number.isFinite(current.getTime()) && current >= availableAt;
}

export function validateLadderResult(matchFormat, homeScore, awayScore) {
  const winsRequired = requiredFrameWins(matchFormat);
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    throw new Error("Frame scores must be whole numbers.");
  }
  if (home === away) throw new Error("A ladder match must have one winner.");
  const winnerScore = Math.max(home, away);
  const loserScore = Math.min(home, away);
  if (winnerScore !== winsRequired || loserScore >= winsRequired) {
    throw new Error(`The winning score for ${matchFormat} must be ${winsRequired}.`);
  }
  return { winner: home > away ? "home" : "away", loserScore };
}

export function resolveLadderResult(matchFormat, homeScore, awayScore, selectedWinner) {
  if (selectedWinner !== undefined && selectedWinner !== null && selectedWinner !== "") {
    if (selectedWinner !== "home" && selectedWinner !== "away") {
      throw new Error("Choose a valid ladder match winner.");
    }
    return { winner: selectedWinner, homeScore: null, awayScore: null };
  }

  const result = validateLadderResult(matchFormat, homeScore, awayScore);
  return {
    winner: result.winner,
    homeScore: Number(homeScore),
    awayScore: Number(awayScore)
  };
}
