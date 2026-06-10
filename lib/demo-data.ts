import type { ClubTeamStructure, Fixture, PlayerGameResult, PlayerStat, Standing, TeamContext } from "@/lib/types";

export const teamContexts: TeamContext[] = [
  {
    id: "castle-a-player",
    name: "Castle A",
    club: "Castle Golf Club",
    logoPath: "/club-logos/castle.png",
    primaryColor: "#030E66",
    league: "A League",
    season: "2025/26",
    role: "Player",
    leaguePosition: 4,
    leagueMatchesPlayed: 16,
    matchesWon: 10,
    matchesLost: 6,
    pointsFor: 56,
    pointsAgainst: 56,
    leaguePoints: 56
  },
  {
    id: "castle-a-manager",
    name: "Castle A",
    club: "Castle Golf Club",
    logoPath: "/club-logos/castle.png",
    primaryColor: "#030E66",
    league: "A League",
    season: "2025/26",
    role: "Manager",
    leaguePosition: 4,
    leagueMatchesPlayed: 16,
    matchesWon: 10,
    matchesLost: 6,
    pointsFor: 56,
    pointsAgainst: 56,
    leaguePoints: 56
  }
];

export const recentResults: Fixture[] = [
  { id: "18", opponent: "Elm Park A", date: "Thu 05 Mar", venue: "Elm Park Golf Club", homeAway: "Away", status: "Completed", score: "4-3", result: "Won" },
  { id: "17", opponent: "Dun Laoghaire A", date: "Thu 26 Feb", venue: "Castle Golf Club", homeAway: "Home", status: "Completed", score: "4-3", result: "Won" },
  { id: "16", opponent: "Milltown A", date: "Thu 19 Feb", venue: "Milltown Golf Club", homeAway: "Away", status: "Completed", score: "4-3", result: "Won" },
  { id: "15", opponent: "Grange A", date: "Thu 05 Feb", venue: "Castle Golf Club", homeAway: "Home", status: "Completed", score: "2-5", result: "Lost" },
  { id: "13", opponent: "Stackstown A", date: "Thu 15 Jan", venue: "Stackstown Golf Club", homeAway: "Away", status: "Completed", score: "0-7", result: "Lost" }
];

export const playerGameResults: PlayerGameResult[] = [
  {
    gameId: "garry-v-john-flavin",
    playerId: "garry-lyons",
    opponentId: "john-flavin",
    opponentName: "John Flavin",
    result: "Won",
    sourceWeek: "Week 1",
    homeTeamName: "Castle A",
    awayTeamName: "Fitzwilliam A",
    matchScore: "6-1",
    gameNumber: 4,
    gameOrdinal: 5,
    isDoublesPartnerRow: false
  },
  {
    gameId: "jimmy-harlow-v-garry",
    playerId: "garry-lyons",
    opponentId: "jimmy-harlow",
    opponentName: "Jimmy Harlow",
    result: "Lost",
    sourceWeek: "Week 2",
    homeTeamName: "Newlands A",
    awayTeamName: "Castle A",
    matchScore: "2-5",
    gameNumber: 4,
    gameOrdinal: 5,
    isDoublesPartnerRow: false
  },
  {
    gameId: "garry-v-aidan-maher",
    playerId: "garry-lyons",
    opponentId: "aidan-maher",
    opponentName: "Aidan Maher",
    result: "Won",
    sourceWeek: "Week 5",
    homeTeamName: "Castle A",
    awayTeamName: "Elm Park A",
    matchScore: "4-3",
    gameNumber: 4,
    gameOrdinal: 5,
    isDoublesPartnerRow: false
  }
];

export const upcomingFixture: Fixture = {
  id: "season-complete",
  opponent: "2025/26 regular season",
  date: "Completed Thu 05 Mar",
  venue: "Castle finished 4th and qualified for the semi-finals",
  homeAway: "Home",
  status: "Completed",
  score: "56-56",
  result: "Won"
};

export const standings: Standing[] = [
  { position: 1, team: "Grange A", played: 16, won: 14, lost: 2, pointsFor: 84, pointsAgainst: 28, leaguePoints: 84 },
  { position: 2, team: "Stackstown A", played: 16, won: 11, lost: 5, pointsFor: 71, pointsAgainst: 41, leaguePoints: 71 },
  { position: 3, team: "Elm Park A", played: 16, won: 11, lost: 5, pointsFor: 62, pointsAgainst: 50, leaguePoints: 62 },
  { position: 4, team: "Castle A", played: 16, won: 10, lost: 6, pointsFor: 56, pointsAgainst: 56, leaguePoints: 56 },
  { position: 5, team: "Milltown A", played: 16, won: 4, lost: 12, pointsFor: 53, pointsAgainst: 59, leaguePoints: 53 },
  { position: 6, team: "Newlands A", played: 16, won: 6, lost: 10, pointsFor: 50, pointsAgainst: 62, leaguePoints: 50 },
  { position: 7, team: "Dun Laoghaire A", played: 16, won: 7, lost: 9, pointsFor: 47, pointsAgainst: 65, leaguePoints: 47 },
  { position: 8, team: "Woodbrook A", played: 16, won: 5, lost: 11, pointsFor: 44, pointsAgainst: 68, leaguePoints: 44 },
  { position: 9, team: "Fitzwilliam A", played: 16, won: 4, lost: 12, pointsFor: 37, pointsAgainst: 75, leaguePoints: 37 }
];

export const playerStats: PlayerStat[] = [
  { name: "John Murphy", played: 8, winPercentage: 75, highestBreak: 62, streak: "W3" },
  { name: "Aidan Kelly", played: 7, winPercentage: 71, highestBreak: 48, streak: "W1" },
  { name: "Mark Byrne", played: 8, winPercentage: 63, highestBreak: 55, streak: "L1" },
  { name: "Noel Dunne", played: 6, winPercentage: 50, highestBreak: 36, streak: "W2" }
];

export const managementModules = [
  { label: "Invitations", value: "14 pending", detail: "Code-based activation only" },
  { label: "Clubs", value: "9 active", detail: "Golf and tennis club venues" },
  { label: "Teams", value: "21 teams", detail: "A, B and C league entries" },
  { label: "People", value: "164 records", detail: "Role assignments live in memberships" }
];

export const clubTeamStructure: ClubTeamStructure[] = [
  { club: "Castle Golf Club", logoPath: "/club-logos/castle.png", primaryColor: "#030E66", teams: ["Castle A", "Castle B", "Castle C"] },
  { club: "Grange Golf Club", logoPath: "/club-logos/grange.png", primaryColor: "#006B3F", teams: ["Grange A", "Grange B", "Grange C"] },
  { club: "Milltown Golf Club", logoPath: "/club-logos/milltown.png", primaryColor: "#1B5E3A", teams: ["Milltown A", "Milltown B"] },
  { club: "Elm Park Golf Club", logoPath: "/club-logos/elm-park.png", primaryColor: "#B43C2B", teams: ["Elm Park A", "Elm Park B", "Elm Park C"] },
  { club: "Stackstown Golf Club", logoPath: "/club-logos/stackstown.png", primaryColor: "#1D7A43", teams: ["Stackstown A", "Stackstown B", "Stackstown C"] },
  { club: "Woodbrook Golf Club", logoPath: "/club-logos/woodbrook.jpg", primaryColor: "#193C64", teams: ["Woodbrook A"] },
  { club: "Newlands Golf Club", logoPath: "/club-logos/newlands.png", primaryColor: "#008E3A", teams: ["Newlands A", "Newlands B", "Newlands C"] },
  { club: "Dun Laoghaire Golf Club", logoPath: "/club-logos/dun-laoghaire.png", primaryColor: "#7A4A24", teams: ["Dun Laoghaire A"] },
  { club: "Fitzwilliam Lawn Tennis Club", logoPath: "/club-logos/fitzwilliam.png", primaryColor: "#6F4A1F", teams: ["Fitzwilliam A", "Fitzwilliam B"] }
];
