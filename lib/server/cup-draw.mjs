function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function nextCupTieTarget(roundNumber, matchNumber) {
  return {
    roundNumber: roundNumber + 1,
    matchNumber: Math.ceil(matchNumber / 2),
    side: matchNumber % 2 === 1 ? "home" : "away"
  };
}

export function buildCupBracket({ teamIds, roundCount, random = Math.random }) {
  const uniqueTeamIds = Array.from(new Set(teamIds));
  if (uniqueTeamIds.length < 2) throw new Error("At least two teams are required.");
  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 6) {
    throw new Error("Round count must be between 1 and 6.");
  }

  const capacity = 2 ** roundCount;
  if (uniqueTeamIds.length > capacity) {
    throw new Error(`${uniqueTeamIds.length} teams need more than ${roundCount} rounds.`);
  }
  if (roundCount > 1 && uniqueTeamIds.length <= capacity / 2) {
    throw new Error(`${uniqueTeamIds.length} teams need fewer rounds.`);
  }

  const teams = shuffle(uniqueTeamIds, random);
  const firstRoundMatches = capacity / 2;
  const byeCount = capacity - teams.length;
  const ties = [];
  let teamIndex = 0;

  for (let matchNumber = 1; matchNumber <= firstRoundMatches; matchNumber += 1) {
    const homeTeamId = teams[teamIndex++] ?? null;
    const hasBye = matchNumber <= byeCount;
    const awayTeamId = hasBye ? null : teams[teamIndex++] ?? null;
    ties.push({
      roundNumber: 1,
      matchNumber,
      homeTeamId,
      awayTeamId,
      homeSourceMatchNumber: null,
      awaySourceMatchNumber: null,
      winnerTeamId: hasBye ? homeTeamId : null,
      status: hasBye ? "Bye" : "Scheduled"
    });
  }

  for (let roundNumber = 2; roundNumber <= roundCount; roundNumber += 1) {
    const matchCount = 2 ** (roundCount - roundNumber);
    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
      ties.push({
        roundNumber,
        matchNumber,
        homeTeamId: null,
        awayTeamId: null,
        homeSourceMatchNumber: matchNumber * 2 - 1,
        awaySourceMatchNumber: matchNumber * 2,
        winnerTeamId: null,
        status: "Awaiting Teams"
      });
    }
  }

  return ties;
}
