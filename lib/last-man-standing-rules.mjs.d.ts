export type LastManStandingTier = "A" | "B" | "C";

export type LastManStandingRole = {
  role: "Player" | "Manager";
  leagueName: string;
  teamId: string;
  teamName: string;
  active?: boolean;
};

export type LastManStandingTierOption = {
  tier: LastManStandingTier;
  sourceRole: "Player" | "Manager";
  teamId: string;
  teamName: string;
};

export function resolveEntryTierOptions(roles: LastManStandingRole[]): {
  options: LastManStandingTierOption[];
  defaultOption: LastManStandingTierOption | null;
};

export function deadlineForEntry(input: {
  ownFixtureDate?: string | null;
  defaultMatchDate: string;
  deadlineTime?: string;
}): Date;

export function canEditPicks(input: {
  ownFixtureDate?: string | null;
  defaultMatchDate: string;
  deadlineTime?: string;
  now: Date | string;
}): {
  allowed: boolean;
  code: "PICKS_LOCKED" | null;
  message: string;
  deadline: string;
};

export type LastManStandingCandidate = {
  id: string;
  name?: string;
  active: boolean;
  registered: boolean;
  typedGuest: boolean;
  tier: LastManStandingTier;
};

export function validateManualPicks(input: {
  playerIds: string[];
  candidates: LastManStandingCandidate[];
  consumedPlayerIds: string[];
  tier: LastManStandingTier;
}): { valid: boolean; code: string | null; message: string };

export type LastManStandingFallbackCandidate = {
  playerId: string;
  sourceTeamId: string;
  sourceFixtureId: string;
  sourceLineupSlotId: string;
  automaticReason: string;
};

export function orderedFallbackCandidates(input: {
  sourceTeamId: string;
  tier: LastManStandingTier;
  teamOrder: Array<{ teamId: string; position: number }>;
  fixtures: Array<{
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
    rescheduledOutsideRound: boolean;
  }>;
  lineupPlayers: Array<{
    playerId: string;
    teamId: string;
    fixtureId: string;
    lineupSlotId: string;
    slotNumber: number;
    playerOrder: number;
    active: boolean;
    registered: boolean;
    typedGuest: boolean;
    tier: LastManStandingTier;
  }>;
  consumedPlayerIds: string[];
  excludedPlayerIds: string[];
}): LastManStandingFallbackCandidate[];

export function outcomeForPickedPlayer(input: {
  playerId: string;
  game: {
    winnerTeamId: string | null;
    homeTeamId: string;
    awayTeamId: string;
    homePlayerIds: string[];
    awayPlayerIds: string[];
  };
}): "Won" | "Lost" | "Pending";
