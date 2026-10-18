export type LadderMatchFormat = "1 Frame" | "Best of 3" | "Best of 5";
export type LadderSettings = {
  name: string;
  matchFormat: LadderMatchFormat;
  challengeRange: number;
  responseHours: number;
  playWithinDays: number;
  active: boolean;
};

export const ladderMatchFormats: LadderMatchFormat[];
export const ladderRechallengeCooldownDays: number;
export function normalizeLadderSettings(input?: Record<string, unknown>): LadderSettings;
export function requiredFrameWins(matchFormat: LadderMatchFormat): number;
export function canChallengePosition(challengerPosition: number, challengedPosition: number, challengeRange: number): boolean;
export function canRejectChallenge(previousRejections: number): boolean;
export function rechallengeAvailableAt(rejectedAt: string | Date | null | undefined): Date | null;
export function canRechallenge(rejectedAt: string | Date | null | undefined, now?: string | Date): boolean;
export function validateLadderResult(matchFormat: LadderMatchFormat, homeScore: number, awayScore: number): { winner: "home" | "away"; loserScore: number };
