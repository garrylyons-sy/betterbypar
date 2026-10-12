export type Role = "Player" | "Manager" | "Club Member" | "Club Admin" | "League Chair";
export type AppearancePanelId =
  | "teamStats"
  | "leagueTableSnapshot"
  | "myStats"
  | "teamRecentForm"
  | "personalRecentForm"
  | "individualGames"
  | "lastManStanding"
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
  | "managerSnapshot";
export type AppearanceMenuId = "Home" | "Fixtures" | "Results" | "Table" | "Club" | "Bookings" | "Competitions" | "Friendlies" | "Contacts" | "Players" | "Stats" | "Messages" | "Interclub Leagues" | "Last Man Standing";
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
  hasLeagueChairAccess?: boolean;
  hasLiveScoringAccess?: boolean;
};

export type SponsorAd = {
  id: string;
  name: string;
  placement: "league-chair-banner";
  audience: "Everyone" | "League Chair";
  imagePath: string;
  linkUrl: string;
  affiliateCode?: string | null;
  altText: string;
};

export type PlayerGameResult = {
  gameId: string;
  season: string;
  league: "A League" | "B League" | "C League";
  playerId: string;
  opponentId: string;
  opponentName: string;
  opponentNames?: string[];
  partnerName?: string | null;
  result: "Won" | "Lost";
  sourceWeek: string;
  homeTeamName: string;
  awayTeamName: string;
  matchScore: string;
  gameNumber: number;
  gameOrdinal: number;
  gameType?: "Singles" | "Doubles" | null;
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
