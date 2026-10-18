const terminalStatuses = new Set(["Complete", "No Winner"]);
const finishedHomeLifetimeMs = 48 * 60 * 60 * 1000;

export function shouldShowLastManStandingOnHome(competition, now = new Date()) {
  if (!terminalStatuses.has(competition.status)) return true;
  if (!competition.finishedAt) return false;

  const finishedAt = new Date(competition.finishedAt).getTime();
  const age = now.getTime() - finishedAt;
  return Number.isFinite(finishedAt) && age >= 0 && age < finishedHomeLifetimeMs;
}
