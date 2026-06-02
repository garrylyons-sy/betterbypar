import type { ClubTeamStructure, Fixture, PlayerStat, Standing, TeamContext } from "@/lib/types";

export const teamContexts: TeamContext[] = [
  {
    id: "castle-a-player",
    name: "Castle A",
    club: "Castle Golf Club",
    league: "A League",
    season: "2026/27",
    role: "Player",
    leaguePosition: 2
  },
  {
    id: "castle-b-manager",
    name: "Castle B",
    club: "Castle Golf Club",
    league: "B League",
    season: "2026/27",
    role: "Manager",
    leaguePosition: 1
  }
];

export const recentResults: Fixture[] = [
  { id: "1", opponent: "Grange A", date: "Thu 28 May", venue: "Castle Golf Club", homeAway: "Home", status: "Completed", score: "5-2", result: "Won" },
  { id: "2", opponent: "Milltown A", date: "Thu 21 May", venue: "Milltown Golf Club", homeAway: "Away", status: "Completed", score: "3-4", result: "Lost" },
  { id: "3", opponent: "Elm Park A", date: "Thu 14 May", venue: "Castle Golf Club", homeAway: "Home", status: "Completed", score: "6-1", result: "Won" }
];

export const upcomingFixture: Fixture = {
  id: "4",
  opponent: "Woodbrook A",
  date: "Thu 04 Jun, 19:30",
  venue: "Woodbrook Golf Club",
  homeAway: "Away",
  status: "Scheduled"
};

export const standings: Standing[] = [
  { position: 1, team: "Grange A", played: 8, won: 6, lost: 2, pointsFor: 41, pointsAgainst: 15, leaguePoints: 41 },
  { position: 2, team: "Castle A", played: 8, won: 6, lost: 2, pointsFor: 37, pointsAgainst: 19, leaguePoints: 37 },
  { position: 3, team: "Milltown A", played: 8, won: 5, lost: 3, pointsFor: 34, pointsAgainst: 22, leaguePoints: 34 },
  { position: 4, team: "Elm Park A", played: 8, won: 4, lost: 4, pointsFor: 29, pointsAgainst: 27, leaguePoints: 29 },
  { position: 5, team: "Stackstown A", played: 8, won: 4, lost: 4, pointsFor: 27, pointsAgainst: 29, leaguePoints: 27 },
  { position: 6, team: "Newlands A", played: 8, won: 3, lost: 5, pointsFor: 23, pointsAgainst: 33, leaguePoints: 23 },
  { position: 7, team: "Woodbrook A", played: 8, won: 3, lost: 5, pointsFor: 21, pointsAgainst: 35, leaguePoints: 21 },
  { position: 8, team: "Dun Laoghaire A", played: 8, won: 2, lost: 6, pointsFor: 18, pointsAgainst: 38, leaguePoints: 18 },
  { position: 9, team: "Fitzwilliam A", played: 8, won: 1, lost: 7, pointsFor: 14, pointsAgainst: 42, leaguePoints: 14 }
];

export const playerStats: PlayerStat[] = [
  { name: "John Murphy", played: 8, winPercentage: 75, highestBreak: 62, streak: "W3" },
  { name: "Aidan Kelly", played: 7, winPercentage: 71, highestBreak: 48, streak: "W1" },
  { name: "Mark Byrne", played: 8, winPercentage: 63, highestBreak: 55, streak: "L1" },
  { name: "Noel Dunne", played: 6, winPercentage: 50, highestBreak: 36, streak: "W2" }
];

export const adminModules = [
  { label: "Invitations", value: "14 pending", detail: "Code-based activation only" },
  { label: "Clubs", value: "9 active", detail: "Golf and tennis club venues" },
  { label: "Teams", value: "21 teams", detail: "A, B and C league entries" },
  { label: "People", value: "164 records", detail: "Role assignments live in memberships" }
];

export const clubTeamStructure: ClubTeamStructure[] = [
  { club: "Castle Golf Club", teams: ["Castle A", "Castle B", "Castle C"] },
  { club: "Grange Golf Club", teams: ["Grange A", "Grange B", "Grange C"] },
  { club: "Milltown Golf Club", teams: ["Milltown A", "Milltown B"] },
  { club: "Elm Park Golf Club", teams: ["Elm Park A", "Elm Park B", "Elm Park C"] },
  { club: "Stackstown Golf Club", teams: ["Stackstown A", "Stackstown B", "Stackstown C"] },
  { club: "Woodbrook Golf Club", teams: ["Woodbrook A"] },
  { club: "Newlands Golf Club", teams: ["Newlands A", "Newlands B", "Newlands C"] },
  { club: "Dun Laoghaire Golf Club", teams: ["Dun Laoghaire A"] },
  { club: "Fitzwilliam Lawn Tennis Club", teams: ["Fitzwilliam A", "Fitzwilliam B"] }
];
