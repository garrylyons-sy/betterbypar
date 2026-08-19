export type Role = "Player" | "Manager" | "Assistant Manager" | "Club Member" | "Club Admin";
export type AppearancePanelId =
  | "teamStats"
  | "leagueTableSnapshot"
  | "myStats"
  | "teamRecentForm"
  | "personalRecentForm"
  | "individualGames"
  | "memberActions"
  | "clubAccess"
  | "interclubLeagues"
  | "openCompetitions"
  | "myCompetitionMatches"
  | "competitionDraws"
  | "clubCompetitionAdmin"
  | "messages"
  | "matchPlanning"
  | "managerActions"
  | "seasonComplete"
  | "squadManagement"
  | "managerSnapshot"
  | "assistantHub";
export type AppearanceMenuId = "Home" | "Fixtures" | "Results" | "Table" | "Club" | "Bookings" | "Competitions" | "Players" | "Stats" | "Messages" | "Interclub Leagues";
export type RoleAppearance = {
  role: Role;
  panels: AppearancePanelId[];
  menuItems: AppearanceMenuId[];
};
export type AppearanceConfig = Record<Role, RoleAppearance>;

export type TeamContext = {
  id: string;
  personId?: string;
  teamId?: string;
  name: string;
  club: string;
  logoPath: string;
  primaryColor: string;
  accentColor: string;
  league: "A League" | "B League" | "C League";
  season: string;
  role: Role;
  leaguePosition: number;
  leagueMatchesPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  leaguePoints?: number;
};

export type PlayerGameResult = {
  gameId: string;
  season: string;
  league: "A League" | "B League" | "C League";
  playerId: string;
  opponentId: string;
  opponentName: string;
  result: "Won" | "Lost";
  sourceWeek: string;
  homeTeamName: string;
  awayTeamName: string;
  matchScore: string;
  gameNumber: number;
  gameOrdinal: number;
  isDoublesPartnerRow: boolean;
};

export type PlayerBreakStat = {
  season: string;
  league: "A League" | "B League" | "C League";
  highestBreak: number;
  totalBreaks: number;
  fiftyPlusBreaks: number;
  centuryBreaks: number;
};

export type MatchResult = {
  id: string;
  league: "A League" | "B League" | "C League";
  season: string;
  weekId?: string;
  weekNumber?: number;
  weekLabel?: string;
  fixtureDate: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamScore: number;
  awayTeamScore: number;
  status: "Scheduled" | "Completed";
};

export type Fixture = {
  id: string;
  opponent: string;
  date: string;
  venue: string;
  homeAway: "Home" | "Away";
  status: "Scheduled" | "Completed";
  score?: string;
  result?: "Won" | "Lost";
};

export type Standing = {
  position: number;
  team: string;
  league?: "A League" | "B League" | "C League";
  season?: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  leaguePoints: number;
};

export type PlayerStat = {
  name: string;
  played: number;
  winPercentage: number;
  highestBreak: number;
  streak: string;
};

export type ClubTeamStructure = {
  club: string;
  logoPath: string;
  primaryColor: string;
  accentColor: string;
  teams: string[];
};
