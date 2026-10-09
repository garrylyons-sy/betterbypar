/**
 * @typedef {Object} AdminMatchStatsFixture
 * @property {string | null | undefined} [fixture_id]
 * @property {string | null | undefined} [league_name]
 * @property {string | null | undefined} [home_team_id]
 * @property {string | null | undefined} [home_team_name]
 * @property {string | null | undefined} [away_team_id]
 * @property {string | null | undefined} [away_team_name]
 * @property {string | null | undefined} [fixture_date]
 * @property {string | null | undefined} [week_starts_on]
 * @property {string | null | undefined} [status]
 * @property {number | string | null | undefined} [home_team_score]
 * @property {number | string | null | undefined} [away_team_score]
 */

/**
 * @typedef {Object} AdminMatchStatsAppearance
 * @property {string | null | undefined} [league_name]
 * @property {string | null | undefined} [team_id]
 * @property {string | null | undefined} [team_name]
 * @property {string | null | undefined} [person_id]
 * @property {string | null | undefined} [guest_name]
 */

function normaliseGuestName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function teamAppearanceKey(row) {
  if (row.person_id) return `person:${row.person_id}`;
  const guestName = normaliseGuestName(row.guest_name);
  return guestName ? `guest:${guestName}` : "";
}

function compareCountThenName(a, b, nameKey = "label") {
  return b.count - a.count || String(a[nameKey]).localeCompare(String(b[nameKey]));
}

function isCompletedStatus(status) {
  return status === "Completed" || status === "Complete";
}

function isPostponedFixture(fixture) {
  const fixtureDate = String(fixture.fixture_date ?? "").slice(0, 10);
  const weekDate = String(fixture.week_starts_on ?? "").slice(0, 10);
  return Boolean(fixtureDate && weekDate && fixtureDate !== weekDate && !isCompletedStatus(fixture.status));
}

/**
 * @param {{ fixtures?: AdminMatchStatsFixture[], appearances?: AdminMatchStatsAppearance[] }} input
 */
function calculateStats(fixtures, appearances) {
  const totals = {
    matches: fixtures.length,
    played: 0,
    scheduled: 0,
    postponed: 0,
    homeWins: 0,
    awayWins: 0,
    draws: 0,
    homeWinPct: 0,
    awayWinPct: 0,
    drawPct: 0
  };
  const leagueMap = new Map();
  const scorelineMap = new Map();
  const playerTeamMap = new Map();

  for (const fixture of fixtures) {
    const leagueName = fixture.league_name ?? "League";
    const status = fixture.status ?? "Scheduled";
    const league = leagueMap.get(leagueName) ?? {
      leagueName,
      matches: 0,
      played: 0,
      scheduled: 0,
      postponed: 0,
      completePct: 0
    };
    league.matches += 1;
    leagueMap.set(leagueName, league);

    if (isCompletedStatus(status)) {
      totals.played += 1;
      league.played += 1;
      const homeScore = Number(fixture.home_team_score ?? 0);
      const awayScore = Number(fixture.away_team_score ?? 0);
      const scoreline = `${homeScore}-${awayScore}`;
      const scorelineRow = scorelineMap.get(scoreline) ?? {
        scoreline,
        count: 0,
        homeWins: 0,
        awayWins: 0,
        draws: 0
      };
      scorelineRow.count += 1;
      if (homeScore > awayScore) {
        totals.homeWins += 1;
        scorelineRow.homeWins += 1;
      } else if (awayScore > homeScore) {
        totals.awayWins += 1;
        scorelineRow.awayWins += 1;
      } else {
        totals.draws += 1;
        scorelineRow.draws += 1;
      }
      scorelineMap.set(scoreline, scorelineRow);
    } else if (isPostponedFixture(fixture)) {
      totals.postponed += 1;
      league.postponed += 1;
    } else {
      totals.scheduled += 1;
      league.scheduled += 1;
    }
  }

  for (const row of appearances) {
    const teamId = row.team_id;
    const key = teamAppearanceKey(row);
    if (!teamId || !key) continue;
    const team = playerTeamMap.get(teamId) ?? {
      teamId,
      teamName: row.team_name ?? "Team",
      players: new Set()
    };
    team.players.add(key);
    playerTeamMap.set(teamId, team);
  }

  totals.homeWinPct = percent(totals.homeWins, totals.played);
  totals.awayWinPct = percent(totals.awayWins, totals.played);
  totals.drawPct = percent(totals.draws, totals.played);

  const leagues = Array.from(leagueMap.values())
    .map((row) => ({ ...row, completePct: percent(row.played, row.matches) }))
    .sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  const scorelines = Array.from(scorelineMap.values()).sort((a, b) => compareCountThenName(a, b, "scoreline"));
  const playersUsedByTeam = Array.from(playerTeamMap.values())
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      count: row.players.size
    }))
    .sort((a, b) => compareCountThenName(a, b, "teamName"));

  return {
    totals,
    leagues,
    scorelines,
    playersUsedByTeam,
    mostCommonScoreline: scorelines[0]?.scoreline ?? null,
    widestSquadUsage: playersUsedByTeam[0] ?? null,
    smallestSquadUsage: playersUsedByTeam.length ? playersUsedByTeam[playersUsedByTeam.length - 1] : null
  };
}

/**
 * @param {{ fixtures?: AdminMatchStatsFixture[], appearances?: AdminMatchStatsAppearance[] }} input
 */
export function buildAdminMatchStats({ fixtures = [], appearances = [] }) {
  const overall = calculateStats(fixtures, appearances);
  const leagueNames = Array.from(new Set(fixtures.map((fixture) => fixture.league_name ?? "League")))
    .sort((a, b) => a.localeCompare(b));
  const scopes = [
    { leagueName: "All leagues", ...overall },
    ...leagueNames.map((leagueName) => ({
      leagueName,
      ...calculateStats(
        fixtures.filter((fixture) => (fixture.league_name ?? "League") === leagueName),
        appearances.filter((appearance) => (appearance.league_name ?? "League") === leagueName)
      )
    }))
  ];

  return { ...overall, scopes };
}
