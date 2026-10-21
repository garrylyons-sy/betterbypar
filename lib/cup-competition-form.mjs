export function cupTeamCountError({ teamCount, roundCount }) {
  const capacity = 2 ** roundCount;
  const minimum = roundCount === 1 ? 2 : capacity / 2 + 1;

  if (teamCount > capacity) {
    const excess = teamCount - capacity;
    return `A ${roundCount}-round cup can include no more than ${capacity} teams. Remove ${excess} team${excess === 1 ? "" : "s"}.`;
  }
  if (teamCount < minimum) {
    return `A ${roundCount}-round cup needs between ${minimum} and ${capacity} teams.`;
  }
  return "";
}

export function toggleCupTeamSelection({ teamIds, teamId, capacity }) {
  if (teamIds.includes(teamId)) return teamIds.filter((id) => id !== teamId);
  if (teamIds.length >= capacity) return teamIds;
  return [...teamIds, teamId];
}
