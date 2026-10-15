export type CupBracketTie = {
  roundNumber: number;
  matchNumber: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSourceMatchNumber: number | null;
  awaySourceMatchNumber: number | null;
  winnerTeamId: string | null;
  status: "Awaiting Teams" | "Scheduled" | "Bye";
};

export function nextCupTieTarget(roundNumber: number, matchNumber: number): {
  roundNumber: number;
  matchNumber: number;
  side: "home" | "away";
};

export function buildCupBracket(options: {
  teamIds: string[];
  roundCount: number;
  random?: () => number;
}): CupBracketTie[];
