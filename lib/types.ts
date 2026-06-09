export type Role = "Player" | "Manager" | "Assistant Manager";

export type TeamContext = {
  id: string;
  personId?: string;
  name: string;
  club: string;
  logoPath: string;
  primaryColor: string;
  league: "A League" | "B League" | "C League";
  season: string;
  role: Role;
  leaguePosition: number;
};

export type PlayerGameResult = {
  gameId: string;
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
  teams: string[];
};
