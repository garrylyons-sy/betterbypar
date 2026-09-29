import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest, testUserFromEmail } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AppUser = Awaited<ReturnType<typeof currentUserFromRequest>>;

async function requestUser(request: NextRequest, explicitTestUser?: unknown) {
  const testEmail = typeof explicitTestUser === "string"
    ? explicitTestUser
    : request.nextUrl.searchParams.get("testUser");
  return await testUserFromEmail(testEmail) ?? await currentUserFromRequest(request);
}

async function isAppOperator(personId: string) {
  const { rowCount } = await dbQuery(
    `select 1
     from public.app_operator ao
     where ao.person_id = $1
       and ao.active = true
     limit 1`,
    [personId]
  );
  return Boolean(rowCount);
}

async function teamAccess(personId: string, teamId: string) {
  if (await isAppOperator(personId)) {
    return { has_access: true, can_manage: true };
  }
  const result = await dbQuery<{ has_access: boolean; can_manage: boolean }>(
    `select
       exists (
         select 1
         from public.team target_team
         join public.person_team_role ptr
           on ptr.league_id = target_team.league_id
          and ptr.team_name = target_team.name
         join public.club_membership cm
           on cm.id = ptr.club_membership_id
          and cm.club_id = target_team.club_id
          and cm.active = true
         where target_team.id = $2
           and cm.person_id = $1
           and ptr.active = true
       ) or exists (
         select 1
         from public.team_membership tm
         where tm.person_id = $1
           and tm.team_id = $2
           and tm.active = true
       ) as has_access,
       exists (
         select 1
         from public.team target_team
         join public.person_team_role ptr
           on ptr.league_id = target_team.league_id
          and ptr.team_name = target_team.name
         join public.club_membership cm
           on cm.id = ptr.club_membership_id
          and cm.club_id = target_team.club_id
          and cm.active = true
         where target_team.id = $2
           and cm.person_id = $1
           and ptr.role in ('Manager', 'Assistant Manager')
           and ptr.active = true
       ) or exists (
         select 1
         from public.team_membership tm
         where tm.person_id = $1
           and tm.team_id = $2
           and tm.role in ('Manager', 'Assistant Manager')
           and tm.active = true
       ) as can_manage`,
    [personId, teamId]
  );
  return result.rows[0] ?? { has_access: false, can_manage: false };
}

function requireUser(user: AppUser): asserts user is NonNullable<AppUser> {
  if (!user) throw new Error("Sign in required.");
}

export async function GET(request: NextRequest) {
  try {
    const user = await requestUser(request);
    requireUser(user);

    const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
    if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });

    const access = await teamAccess(user.personId, teamId);
    if (!access.has_access) return NextResponse.json({ error: "Team access is required." }, { status: 403 });

    const teams = access.can_manage ? (await dbQuery<{
      id: string;
      name: string;
      club_name: string;
      league_name: string;
    }>(
      `select
         t.id,
         t.name,
         c.name as club_name,
         l.name as league_name
       from public.team t
       join public.club c on c.id = t.club_id
       join public.league l on l.id = t.league_id
       where t.active = true
         and t.id <> $1
         and t.season_id = (select season_id from public.team where id = $1)
       order by l.name, c.name, t.name`,
      [teamId]
    )).rows.map((row) => ({
      id: row.id,
      name: row.name,
      clubName: row.club_name,
      league: row.league_name
    })) : [];

    const friendlies = (await dbQuery<{
      id: string;
      fixture_date: string;
      status: "Scheduled" | "Completed";
      home_team_id: string;
      away_team_id: string;
      home_team_name: string;
      away_team_name: string;
      home_team_score: number | null;
      away_team_score: number | null;
      home_lineup_status: "Draft" | "Published" | null;
      away_lineup_status: "Draft" | "Published" | null;
      completed_games: string;
      total_games: string;
    }>(
      `select
         f.id,
         f.fixture_date::text,
         f.status::text as status,
         f.home_team_id,
         f.away_team_id,
         ht.name as home_team_name,
         at.name as away_team_name,
         m.home_team_score,
         m.away_team_score,
         hfl.status as home_lineup_status,
         afl.status as away_lineup_status,
         count(g.id) filter (where g.winner_team_id is not null)::text as completed_games,
         count(g.id)::text as total_games
       from public.fixture f
       join public.team ht on ht.id = f.home_team_id
       join public.team at on at.id = f.away_team_id
       left join public.match m on m.fixture_id = f.id
       left join public.game g on g.match_id = m.id
       left join public.fixture_lineup hfl on hfl.fixture_id = f.id and hfl.team_id = f.home_team_id
       left join public.fixture_lineup afl on afl.fixture_id = f.id and afl.team_id = f.away_team_id
       where coalesce(f.fixture_type, 'League') = 'Friendly'
         and (f.home_team_id = $1 or f.away_team_id = $1)
       group by f.id, ht.name, at.name, m.home_team_score, m.away_team_score, hfl.status, afl.status
       order by
         case when f.fixture_date::date >= (now() at time zone 'Europe/Dublin')::date then 0 else 1 end,
         f.fixture_date asc`,
      [teamId]
    )).rows.map((row) => ({
      id: row.id,
      fixtureDate: row.fixture_date,
      status: row.status,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeTeamName: row.home_team_name,
      awayTeamName: row.away_team_name,
      homeTeamScore: row.home_team_score === null ? null : Number(row.home_team_score),
      awayTeamScore: row.away_team_score === null ? null : Number(row.away_team_score),
      homeLineupStatus: row.home_lineup_status,
      awayLineupStatus: row.away_lineup_status,
      completedGames: Number(row.completed_games ?? 0),
      totalGames: Number(row.total_games ?? 0)
    }));

    return NextResponse.json({ canManage: access.can_manage, teams, friendlies }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Friendlies unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await requestUser(request, body.testUser);
    requireUser(user);

    const teamId = String(body.teamId ?? "").trim();
    const opponentTeamId = String(body.opponentTeamId ?? "").trim();
    const fixtureDate = String(body.fixtureDate ?? "").trim();
    if (!teamId || !opponentTeamId || !fixtureDate) {
      return NextResponse.json({ error: "Team, opponent and date are required." }, { status: 400 });
    }
    if (teamId === opponentTeamId) {
      return NextResponse.json({ error: "Choose two different teams." }, { status: 400 });
    }

    const access = await teamAccess(user.personId, teamId);
    if (!access.can_manage) return NextResponse.json({ error: "Manager access is required to create a friendly." }, { status: 403 });

    const created = await dbQuery<{ fixture_id: string }>(
      `with home_team as (
         select id, season_id, league_id
         from public.team
         where id = $1
           and active = true
       ),
       away_team as (
         select id, season_id
         from public.team
         where id = $2
           and active = true
       ),
       inserted_fixture as (
         insert into public.fixture (
           season_id, league_id, fixture_date, home_team_id, away_team_id, status, fixture_type
         )
         select
           home_team.season_id,
           home_team.league_id,
           $3::timestamptz,
           home_team.id,
           away_team.id,
           'Scheduled',
           'Friendly'
         from home_team
         join away_team on away_team.season_id = home_team.season_id
         returning id
       ),
       inserted_match as (
         insert into public.match (fixture_id, entered_by, entered_at)
         select id, $4, now()
         from inserted_fixture
         returning fixture_id
       )
       select fixture_id from inserted_match`,
      [teamId, opponentTeamId, fixtureDate, user.personId]
    );

    const fixtureId = created.rows[0]?.fixture_id;
    if (!fixtureId) {
      return NextResponse.json({ error: "Both teams must exist in the same season." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, fixtureId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create friendly." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
