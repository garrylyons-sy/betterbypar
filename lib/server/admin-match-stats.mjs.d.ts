export type AdminMatchStatsFixture = {
  fixture_id?: string | null;
  league_name?: string | null;
  home_team_id?: string | null;
  home_team_name?: string | null;
  away_team_id?: string | null;
  away_team_name?: string | null;
  fixture_date?: string | null;
  week_starts_on?: string | null;
  status?: string | null;
  home_team_score?: number | string | null;
  away_team_score?: number | string | null;
};

export type AdminMatchStatsAppearance = {
  league_name?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  person_id?: string | null;
  guest_name?: string | null;
};

export type AdminMatchStatsView = {
  totals: {
    matches: number;
    played: number;
    scheduled: number;
    postponed: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    homeWinPct: number;
    awayWinPct: number;
    drawPct: number;
  };
  leagues: Array<{ leagueName: string; matches: number; played: number; scheduled: number; postponed: number; completePct: number }>;
  scorelines: Array<{ scoreline: string; count: number; homeWins: number; awayWins: number; draws: number }>;
  playersUsedByTeam: Array<{ teamId: string; teamName: string; count: number }>;
  mostCommonScoreline: string | null;
  widestSquadUsage: { teamId: string; teamName: string; count: number } | null;
  smallestSquadUsage: { teamId: string; teamName: string; count: number } | null;
};

export type AdminMatchStats = AdminMatchStatsView & {
  scopes: Array<AdminMatchStatsView & { leagueName: string }>;
};

export function buildAdminMatchStats(input: {
  fixtures?: AdminMatchStatsFixture[];
  appearances?: AdminMatchStatsAppearance[];
}): AdminMatchStats;
