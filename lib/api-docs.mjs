export const developerDocsAuthModel = {
  title: "Authentication",
  summary:
    "Interclub Snooker APIs currently use the same authenticated app session as the web app. Partner API keys are not yet available.",
  notes: [
    "Send requests from a signed-in browser session or same-origin integration.",
    "Unauthenticated requests return 401 with an error message.",
    "A future partner API should use scoped API keys before broad third-party access."
  ]
};

export const apiDocSections = [
  {
    id: "fixtures",
    title: "Fixtures",
    description: "Read fixture weeks, match status, scores, lineup publication state, and frame details.",
    endpoints: [
      {
        method: "GET",
        path: "/api/fixtures/weeks",
        summary: "List fixture weeks for a league and season.",
        auth: "App session",
        query: [
          { name: "league", required: false, example: "A League", description: "A League, B League, or C League. Defaults to A League." },
          { name: "season", required: false, example: "2026/27", description: "Season label. Defaults to 2026/27." },
          { name: "teamId", required: false, example: "uuid", description: "Marks fixtures for a user team when supplied." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/fixtures/weeks?league=A%20League&season=2026/27' -b cookie.txt",
        exampleResponse: `{
  "weeks": [
    {
      "weekNumber": 2,
      "weekLabel": "Week 2",
      "startsOn": "2026-10-08",
      "fixtures": [
        {
          "fixtureId": "4e4e...",
          "homeTeamName": "Castle A",
          "awayTeamName": "Milltown A",
          "status": "Scheduled",
          "homeTeamScore": 0,
          "awayTeamScore": 0,
          "homeLineupStatus": "Published",
          "awayLineupStatus": "Draft",
          "games": []
        }
      ]
    }
  ]
}`
      }
    ]
  },
  {
    id: "tables",
    title: "Tables and Results",
    description: "Use the app data payloads for tables, recent results, and league snapshots.",
    endpoints: [
      {
        method: "GET",
        path: "/api/session",
        summary: "Return the signed-in user context, team roles, league tables, match results, and app appearance data.",
        auth: "App session",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/session' -b cookie.txt",
        exampleResponse: `{
  "authenticated": true,
  "user": { "email": "manager@example.com", "name": "Example Manager" },
  "contexts": [
    {
      "teamId": "f5b1...",
      "name": "Castle A",
      "club": "Castle Golf Club",
      "league": "A League",
      "role": "Manager",
      "season": "2026/27"
    }
  ],
  "standings": [
    {
      "team": "Newlands A",
      "league": "A League",
      "played": 1,
      "won": 1,
      "points": 7
    }
  ],
  "matchResults": []
}`
      }
    ]
  },
  {
    id: "player-stats",
    title: "Player Stats",
    description: "Read individual player records and high breaks for league tables and stats pages.",
    endpoints: [
      {
        method: "GET",
        path: "/api/league/player-stats",
        summary: "List player standings for a league and season.",
        auth: "App session with league access",
        query: [
          { name: "league", required: true, example: "C League", description: "League name." },
          { name: "season", required: true, example: "2026/27", description: "Season label." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/league/player-stats?league=C%20League&season=2026/27' -b cookie.txt",
        exampleResponse: `{
  "league": "C League",
  "season": "2026/27",
  "players": [
    {
      "playerId": "c2f9...",
      "playerName": "Eddie McCarron",
      "teamName": "Fitzwilliam C",
      "played": 2,
      "won": 2,
      "lost": 0,
      "winPercentage": 100,
      "highestBreak": null
    }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/league/breaks",
        summary: "List high breaks of 30 or more for a league and season.",
        auth: "App session",
        query: [
          { name: "league", required: true, example: "A League", description: "League name." },
          { name: "season", required: true, example: "2026/27", description: "Season label." },
          { name: "limit", required: false, example: "10", description: "1 to 50. Defaults to 10." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/league/breaks?league=A%20League&season=2026/27&limit=5' -b cookie.txt",
        exampleResponse: `{
  "league": "A League",
  "season": "2026/27",
  "breaks": [
    {
      "id": "9aa1...",
      "breakValue": 44,
      "playerName": "Aidan Maher",
      "teamName": "Elm Park A",
      "opponentTeamName": "Grange A",
      "venueSide": "A",
      "gameNumber": 6
    }
  ]
}`
      }
    ]
  },
  {
    id: "clubs",
    title: "Clubs and Contacts",
    description: "Read club/team information and contact directory data where the signed-in user has access.",
    endpoints: [
      {
        method: "GET",
        path: "/api/club/teams",
        summary: "List teams, managers, players, and next fixtures for the signed-in user's club.",
        auth: "App session",
        query: [
          { name: "club", required: false, example: "Castle", description: "Optional club name filter when supported by the active session." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/club/teams' -b cookie.txt",
        exampleResponse: `{
  "clubName": "Castle Golf Club",
  "teams": [
    {
      "teamName": "Castle A",
      "leagueName": "A League",
      "players": [{ "name": "Stephen Finlan", "handicap": 12 }],
      "managers": [{ "name": "Stephen Finlan" }],
      "nextFixture": { "opponent": "Milltown A", "homeAway": "Home" }
    }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/contacts",
        summary: "List league and manager contacts for users with contacts access.",
        auth: "App session with contacts access",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/contacts' -b cookie.txt",
        exampleResponse: `{
  "contacts": [
    {
      "clubName": "Grange",
      "teamName": "Grange C",
      "contactName": "Mick Collins",
      "phone": "0872055302",
      "contactType": "Team Manager"
    }
  ]
}`
      }
    ]
  },
  {
    id: "competitions",
    title: "Competitions",
    description: "Read club competition entries, rounds, and match status for signed-in users.",
    endpoints: [
      {
        method: "GET",
        path: "/api/competitions",
        summary: "List competitions visible to the signed-in user.",
        auth: "App session",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/competitions' -b cookie.txt",
        exampleResponse: `{
  "competitions": [
    {
      "id": "b77d...",
      "name": "Castle Singles",
      "competitionType": "Singles",
      "status": "Open",
      "entryClosesAt": "2026-12-01",
      "entrantCount": 24
    }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/competitions/[id]",
        summary: "Read one competition, including entries, rounds, and draw information.",
        auth: "App session",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/competitions/b77d...' -b cookie.txt",
        exampleResponse: `{
  "competition": {
    "id": "b77d...",
    "name": "Castle Singles",
    "status": "In Progress",
    "entries": [],
    "rounds": [],
    "matches": []
  }
}`
      }
    ]
  }
];
