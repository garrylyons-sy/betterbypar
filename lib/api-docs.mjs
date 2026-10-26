export const developerDocsAuthModel = {
  title: "Authentication",
  summary:
    "Better By Par APIs currently use the same authenticated app session as the web app. Partner API keys are not yet available.",
  notes: [
    "Send requests from a signed-in browser session or same-origin integration.",
    "Unauthenticated requests return 401 with an error message.",
    "A future partner API should use scoped API keys before broad third-party access."
  ]
};

export const developerDocsMeta = {
  updatedAt: "2026-10-16",
  version: "2026-10"
};

export const apiDocSections = [
  {
    id: "fixtures",
    title: "Fixtures",
    description: "Read league weeks and cup rounds, including postponements, scores, lineup publication state, and frame details.",
    endpoints: [
      {
        method: "GET",
        path: "/api/fixtures/weeks",
        summary: "List league fixture weeks and visible cup rounds for a league and season, with postponed matches moved to their rescheduled date.",
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
      "competitionType": "League",
      "postponedFixtures": [],
      "cupPlaceholders": [],
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
          "fixtureType": "League",
          "games": []
        }
      ]
    },
    {
      "weekNumber": null,
      "weekLabel": "Paddy O'Brien Test Cup · Quarter Final",
      "startsOn": "2026-12-08",
      "competitionType": "Cup",
      "postponedFixtures": [
        {
          "fixtureId": "7d91...",
          "homeTeamName": "Castle A",
          "awayTeamName": "Milltown B",
          "postponedTo": "2026-12-15"
        }
      ],
      "cupPlaceholders": []
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
      },
      {
        method: "GET",
        path: "/api/team/player-stats",
        summary: "List season statistics for players on one team.",
        auth: "App session with team access",
        query: [
          { name: "teamId", required: true, example: "uuid", description: "Active team identifier." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/team/player-stats?teamId=f5b1...' -b cookie.txt",
        exampleResponse: `{
  "teamId": "f5b1...",
  "players": [
    {
      "personId": "c2f9...",
      "name": "Example Player",
      "played": 3,
      "won": 2,
      "lost": 1,
      "winPercentage": 67,
      "highestBreak": 35
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
      },
      {
        method: "GET",
        path: "/api/club/ladder",
        summary: "List the club ladders the signed-in member is eligible to enter, with positions, recent form, and their own challenges.",
        auth: "App session with club membership",
        query: [
          { name: "club", required: true, example: "Castle Golf Club", description: "Exact active club name." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/club/ladder?club=Castle%20Golf%20Club' -b cookie.txt",
        exampleResponse: `{
  "configured": true,
  "clubName": "Castle Golf Club",
  "ladders": [
    {
      "available": true,
      "ladder": {
        "id": "81e2...",
        "name": "Castle A and B Ladder",
        "matchFormat": "Best of 3",
        "challengeRange": 3,
        "responseHours": 48,
        "playWithinDays": 14,
        "useHandicap": true
      },
      "me": { "entryId": "534b...", "position": 6, "status": "Active" },
      "entries": [
        { "id": "534b...", "name": "Example Player", "handicap": 12, "recentForm": ["W", "L", "W"], "position": 6 }
      ],
      "challenges": []
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
  },
  {
    id: "last-man-standing",
    title: "Last Man Standing",
    description: "Read eligible competitions, current rounds, picks, progress, contestants, and winner state.",
    endpoints: [
      {
        method: "GET",
        path: "/api/last-man-standing",
        summary: "List competitions the signed-in person may enter or has entered previously.",
        auth: "App session with competition eligibility",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/last-man-standing' -b cookie.txt",
        exampleResponse: `{
  "competitions": [
    {
      "id": "7be4...",
      "name": "A League LMS",
      "status": "In Progress",
      "isEntered": true,
      "currentRound": {
        "id": "275d...",
        "name": "Round 2",
        "status": "Open",
        "cycleNumber": 1,
        "roundNumber": 2,
        "deadlineAt": "2026-10-22T12:00:00.000Z"
      },
      "panel": {
        "picks": ["Player One", "Player Two"],
        "pickOutcomes": ["Pending", "Pending"],
        "remainingLabel": "18 of 24 standing"
      }
    }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/last-man-standing/[competitionId]",
        summary: "Read one eligible competition, including entry options, progress, candidates, picks, contestants, and pick history.",
        auth: "App session with competition eligibility",
        query: [
          { name: "competitionId", required: true, example: "uuid", description: "Path parameter identifying the competition." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/last-man-standing/7be4...' -b cookie.txt",
        exampleResponse: `{
  "competition": { "id": "7be4...", "name": "A League LMS", "status": "In Progress" },
  "entry": { "id": "45c1...", "status": "Standing", "tier": "A", "sourceTeamId": "f5b1..." },
  "currentRound": { "id": "275d...", "name": "Round 2", "cycleNumber": 1, "roundNumber": 2, "status": "Open" },
  "progress": { "roundsPlayed": 1, "entrantCount": 24, "standingCount": 18, "winnerName": null },
  "candidates": [],
  "picks": [],
  "entries": [],
  "history": []
}`
      }
    ]
  },
  {
    id: "live-scoring",
    title: "Live Scoring",
    description: "Read today's League Chair live-scoring dashboard or poll active frame status for known fixtures.",
    endpoints: [
      {
        method: "GET",
        path: "/api/league-chair/live-scoring/dashboard",
        summary: "List today's fixtures and active live-scoring sessions. Supply fixtureIds to return only live statuses for those fixtures.",
        auth: "League Chair or platform administrator session",
        query: [
          { name: "fixtureIds", required: false, example: "uuid,uuid", description: "Comma-separated fixture IDs, limited to 50 valid UUIDs." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/league-chair/live-scoring/dashboard?fixtureIds=4e4e...' -b cookie.txt",
        exampleResponse: `{
  "statuses": [
    {
      "fixture_id": "4e4e...",
      "game_id": "5ac8...",
      "game_number": 3,
      "game_type": "Doubles",
      "status": "Live",
      "state": { "homeScore": 28, "awayScore": 19, "redsRemaining": 8 },
      "scorer_name": "Example Scorer",
      "active_player_name": "Example Player"
    }
  ]
}`
      }
    ]
  },
  {
    id: "member-services",
    title: "Member Services",
    description: "Read products and table availability where the signed-in person's role and club permit access.",
    endpoints: [
      {
        method: "GET",
        path: "/api/shop",
        summary: "List active shop products, prices, and selectable options.",
        auth: "League Chair session",
        query: [],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/shop' -b cookie.txt",
        exampleResponse: `{
  "products": [
    {
      "id": "996a...",
      "productName": "Foul and a Miss T-Shirt",
      "description": "A soft cotton snooker tee.",
      "imagePath": "/api/assets/product/996a...",
      "priceEuros": 25,
      "optionName": "Size",
      "optionValues": ["S", "M", "L", "XL"]
    }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/table-bookings",
        summary: "Read active club tables, available hours, and bookings for a date.",
        auth: "App session with supported club membership",
        query: [
          { name: "date", required: true, example: "2026-10-17", description: "Booking date in YYYY-MM-DD format; today or later in Europe/Dublin." }
        ],
        exampleRequest: "curl 'https://www.interclubsnooker.com/api/table-bookings?date=2026-10-17' -b cookie.txt",
        exampleResponse: `{
  "clubId": "8b4f...",
  "clubName": "Castle Golf Club",
  "bookingDate": "2026-10-17",
  "slotHours": [11, 12, 13, 14],
  "tables": [
    { "tableId": "table-1", "tableName": "Table 1", "tableDescription": "Main room" }
  ],
  "bookings": [
    { "id": "4f15...", "tableId": "table-1", "bookedBy": "Example Member", "startTime": "19:00", "endTime": "20:00", "canCancel": false }
  ]
}`
      }
    ]
  }
];
