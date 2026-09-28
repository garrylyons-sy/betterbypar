import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

const fixtureStatuses = new Set(["Scheduled", "Completed", "Cancelled"]);

async function requireAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false };
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return { user, administrator: Boolean(rowCount) };
}

export async function GET(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const season = request.nextUrl.searchParams.get("season")?.trim() || "2026/27";
    const league = request.nextUrl.searchParams.get("league")?.trim() || "all";
    const status = request.nextUrl.searchParams.get("status")?.trim() || "all";
    const type = request.nextUrl.searchParams.get("type")?.trim() || "League";

    const [matches, teams, seasons, leagues] = await Promise.all([
      dbQuery(
        `select
           f.id as fixture_id,
           f.fixture_date::text,
           f.status::text,
           coalesce(f.fixture_type, 'League') as fixture_type,
           f.season_id,
           s.name as season_name,
           f.league_id,
           l.name as league_name,
           f.home_team_id,
           ht.name as home_team_name,
           f.away_team_id,
           at.name as away_team_name,
           m.id as match_id,
           m.home_team_score,
           m.away_team_score,
           count(distinct fl.id)::int as lineup_count,
           count(distinct g.id)::int as game_count,
           count(distinct g.id) filter (where g.winner_team_id is not null)::int as completed_game_count
         from public.fixture f
         join public.season s on s.id = f.season_id
         join public.league l on l.id = f.league_id
         join public.team ht on ht.id = f.home_team_id
         join public.team at on at.id = f.away_team_id
         left join public.match m on m.fixture_id = f.id
         left join public.fixture_lineup fl on fl.fixture_id = f.id
         left join public.game g on g.match_id = m.id
         where s.name = $1
           and ($2 = 'all' or l.name = $2)
           and ($3 = 'all' or f.status::text = $3)
           and ($4 = 'all' or coalesce(f.fixture_type, 'League') = $4)
         group by f.id, s.name, l.name, ht.name, at.name, m.id
         order by f.fixture_date, l.name, ht.name`,
        [season, league, status, type]
      ),
      dbQuery(
        `select
           t.id,
           t.name,
           t.season_id,
           s.name as season_name,
           t.league_id,
           l.name as league_name,
           t.club_id,
           c.name as club_name
         from public.team t
         join public.season s on s.id = t.season_id
         join public.league l on l.id = t.league_id
         join public.club c on c.id = t.club_id
         where t.active = true
         order by s.name desc, l.name, t.name`
      ),
      dbQuery("select id, name from public.season order by name desc"),
      dbQuery("select id, name from public.league order by name")
    ]);

    return NextResponse.json({
      matches: matches.rows,
      teams: teams.rows,
      seasons: seasons.rows,
      leagues: leagues.rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load matches." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const fixtureId = String(body.fixtureId ?? "").trim();
    const homeTeamId = String(body.homeTeamId ?? "").trim();
    const awayTeamId = String(body.awayTeamId ?? "").trim();
    const fixtureDate = String(body.fixtureDate ?? "").trim();
    const status = String(body.status ?? "").trim();
    const homeScore = body.homeTeamScore === "" || body.homeTeamScore == null ? null : Number(body.homeTeamScore);
    const awayScore = body.awayTeamScore === "" || body.awayTeamScore == null ? null : Number(body.awayTeamScore);

    if (!fixtureId) return NextResponse.json({ error: "Fixture is required." }, { status: 400 });
    if (status && !fixtureStatuses.has(status)) return NextResponse.json({ error: "Invalid fixture status." }, { status: 400 });
    if ((homeScore != null || awayScore != null) && (!Number.isInteger(homeScore) || !Number.isInteger(awayScore))) {
      return NextResponse.json({ error: "Both scores must be whole numbers." }, { status: 400 });
    }
    if (homeScore != null && awayScore != null && (homeScore < 0 || awayScore < 0 || homeScore + awayScore > 7)) {
      return NextResponse.json({ error: "Scores must be between 0 and 7 and total no more than 7." }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const existing = await client.query<{
        season_id: string;
        league_id: string;
        home_team_id: string;
        away_team_id: string;
        match_id: string | null;
        lineup_count: number;
        game_count: number;
      }>(
        `select
           f.season_id,
           f.league_id,
           f.home_team_id,
           f.away_team_id,
           m.id as match_id,
           coalesce(fl.lineup_count, 0) as lineup_count,
           coalesce(g.game_count, 0) as game_count
         from public.fixture f
         left join public.match m on m.fixture_id = f.id
         left join lateral (
           select count(*)::int as lineup_count
           from public.fixture_lineup fl
           where fl.fixture_id = f.id
         ) fl on true
         left join lateral (
           select count(*)::int as game_count
           from public.game g
           where g.match_id = m.id
         ) g on true
         where f.id = $1
         for update of f`,
        [fixtureId]
      );
      const fixture = existing.rows[0];
      if (!fixture) throw new Error("Fixture not found.");

      const nextHomeTeamId = homeTeamId || fixture.home_team_id;
      const nextAwayTeamId = awayTeamId || fixture.away_team_id;
      const teamsChanged = nextHomeTeamId !== fixture.home_team_id || nextAwayTeamId !== fixture.away_team_id;
      if (nextHomeTeamId === nextAwayTeamId) throw new Error("Home and away teams must be different.");

      if (teamsChanged && (fixture.lineup_count > 0 || fixture.game_count > 0)) {
        throw new Error("Teams cannot be changed after lineups or frame details have been created.");
      }

      if (teamsChanged) {
        const validTeams = await client.query<{ id: string }>(
          `select id
           from public.team
           where id = any($1::uuid[])
             and season_id = $2
             and league_id = $3
             and active = true`,
          [[nextHomeTeamId, nextAwayTeamId], fixture.season_id, fixture.league_id]
        );
        if (validTeams.rowCount !== 2) throw new Error("Teams must belong to the same season and league as the fixture.");
      }

      await client.query(
        `update public.fixture
         set fixture_date = coalesce($2::timestamptz, fixture_date),
             home_team_id = $3,
             away_team_id = $4,
             status = coalesce($5::fixture_status, status)
         where id = $1`,
        [fixtureId, fixtureDate || null, nextHomeTeamId, nextAwayTeamId, status || null]
      );

      let matchId = fixture.match_id;
      if (homeScore != null && awayScore != null) {
        const matchResult = await client.query<{ id: string }>(
          `insert into public.match (fixture_id, home_team_score, away_team_score, entered_by, entered_at)
           values ($1, $2, $3, $4, now())
           on conflict (fixture_id) do update
           set home_team_score = excluded.home_team_score,
               away_team_score = excluded.away_team_score,
               entered_by = excluded.entered_by,
               entered_at = now()
           returning id`,
          [fixtureId, homeScore, awayScore, user.personId]
        );
        matchId = matchResult.rows[0].id;
      }

      return { matchId };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update match." },
      { status: 400 }
    );
  }
}
