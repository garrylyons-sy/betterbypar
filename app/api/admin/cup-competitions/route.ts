import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { cupRoundDateError } from "@/lib/cup-round-dates.mjs";
import { cupRoundName } from "@/lib/server/cup-competitions";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function requireAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false };
  const result = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  return { user, administrator: Boolean(result.rowCount) };
}

function validDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

async function loadAdminCupData() {
  const [competitions, formats, entries, visibilityLeagues, rounds, ties, seasons, teams, leagues] = await Promise.all([
    dbQuery(`select id, season_id, name, round_count, status, audience, created_at::text from public.cup_competition order by created_at desc`),
    dbQuery(`select competition_id, slot_number, game_type::text, points_awarded from public.cup_competition_format_slot order by competition_id, slot_number`),
    dbQuery(`select ce.competition_id, ce.team_id, t.name as team_name from public.cup_competition_entry ce join public.team t on t.id = ce.team_id order by t.name`),
    dbQuery(`select competition_id, league_id from public.cup_competition_visibility_league order by competition_id, league_id`),
    dbQuery(`select id, competition_id, round_number, name, fixture_date::text from public.cup_competition_round order by competition_id, round_number`),
    dbQuery(
      `select
         ct.id, cr.competition_id, cr.round_number, ct.match_number, ct.home_team_id, ht.name as home_team_name,
         ct.away_team_id, at.name as away_team_name, ct.fixture_id, ct.winner_team_id, wt.name as winner_team_name,
         ct.status, hs.match_number as home_source_match_number, aws.match_number as away_source_match_number,
         m.home_team_score, m.away_team_score
       from public.cup_competition_tie ct
       join public.cup_competition_round cr on cr.id = ct.competition_round_id
       left join public.team ht on ht.id = ct.home_team_id
       left join public.team at on at.id = ct.away_team_id
       left join public.team wt on wt.id = ct.winner_team_id
       left join public.cup_competition_tie hs on hs.id = ct.home_source_tie_id
       left join public.cup_competition_tie aws on aws.id = ct.away_source_tie_id
       left join public.match m on m.fixture_id = ct.fixture_id
       order by cr.competition_id, cr.round_number, ct.match_number`
    ),
    dbQuery(`select id, name from public.season order by name desc`),
    dbQuery(
      `select t.id, t.name, t.season_id, s.name as season_name, t.league_id, l.name as league_name, c.name as club_name
       from public.team t
       join public.season s on s.id = t.season_id
       join public.league l on l.id = t.league_id
       join public.club c on c.id = t.club_id
       where t.active = true
       order by s.name desc, l.name, t.name`
    ),
    dbQuery(`select id, name from public.league order by name`)
  ]);

  return {
    competitions: competitions.rows.map((competition: Record<string, unknown>) => ({
      ...competition,
      format: formats.rows.filter((row: Record<string, unknown>) => row.competition_id === competition.id),
      entries: entries.rows.filter((row: Record<string, unknown>) => row.competition_id === competition.id),
      visibilityLeagueIds: visibilityLeagues.rows
        .filter((row: Record<string, unknown>) => row.competition_id === competition.id)
        .map((row: Record<string, unknown>) => row.league_id),
      rounds: rounds.rows
        .filter((row: Record<string, unknown>) => row.competition_id === competition.id)
        .map((round: Record<string, unknown>) => ({
          ...round,
          ties: ties.rows.filter((tie: Record<string, unknown>) => tie.competition_id === competition.id && tie.round_number === round.round_number)
        }))
    })),
    seasons: seasons.rows,
    teams: teams.rows,
    leagues: leagues.rows
  };
}

export async function GET() {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json(await loadAdminCupData(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cup competitions unavailable." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const seasonId = String(body.seasonId ?? "").trim();
    const roundCount = Number(body.roundCount);
    const teamIds = Array.from(new Set((Array.isArray(body.teamIds) ? body.teamIds : []).map((value: unknown) => String(value).trim()).filter(Boolean)));
    const format = Array.isArray(body.format) ? body.format : [];
    const roundDates = Array.isArray(body.roundDates) ? body.roundDates.map(validDate) : [];
    const audience = String(body.audience ?? "All Players").trim();
    const visibilityLeagueIds = Array.from(new Set((Array.isArray(body.visibilityLeagueIds) ? body.visibilityLeagueIds : []).map((value: unknown) => String(value).trim()).filter(Boolean)));

    if (!name || !seasonId) return NextResponse.json({ error: "Name and season are required." }, { status: 400 });
    if (!["Everyone", "All Players", "All Managers", "All Players and Managers", "Specific Leagues", "League Chairs"].includes(audience)) return NextResponse.json({ error: "Choose a valid audience." }, { status: 400 });
    if (audience === "Specific Leagues" && !visibilityLeagueIds.length) return NextResponse.json({ error: "Choose at least one visible league." }, { status: 400 });
    if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 6) return NextResponse.json({ error: "Choose between 1 and 6 rounds." }, { status: 400 });
    const capacity = 2 ** roundCount;
    if (teamIds.length < 2 || teamIds.length > capacity || (roundCount > 1 && teamIds.length <= capacity / 2)) {
      return NextResponse.json({ error: `${teamIds.length} teams do not fit an exact ${roundCount}-round knockout.` }, { status: 400 });
    }
    if (!format.length || format.length > 15 || format.length % 2 === 0) {
      return NextResponse.json({ error: "Cup format must contain an odd number of 1 to 15 matches." }, { status: 400 });
    }
    const roundDateError = cupRoundDateError(roundDates, roundCount);
    if (roundDateError) return NextResponse.json({ error: roundDateError }, { status: 400 });
    const gameTypes = format.map((slot: Record<string, unknown>) => String(slot.gameType ?? ""));
    if (gameTypes.some((type: string) => type !== "Singles" && type !== "Doubles")) {
      return NextResponse.json({ error: "Every format row must be Singles or Doubles." }, { status: 400 });
    }

    const competitionId = await withTransaction(async (client) => {
      const validTeams = await client.query<{ id: string }>(
        `select id from public.team where id = any($1::uuid[]) and season_id = $2 and active = true`,
        [teamIds, seasonId]
      );
      if (validTeams.rowCount !== teamIds.length) throw new Error("Every selected team must be active in the selected season.");

      const competition = await client.query<{ id: string }>(
        `insert into public.cup_competition (season_id, name, round_count, status, audience, created_by)
         values ($1, $2, $3, 'Draft', $4, $5)
         returning id`,
        [seasonId, name, roundCount, audience, user.personId]
      );
      const id = competition.rows[0].id;
      for (let index = 0; index < format.length; index += 1) {
        await client.query(
          `insert into public.cup_competition_format_slot (competition_id, slot_number, game_type, points_awarded)
           values ($1, $2, $3, 1)`,
          [id, index + 1, gameTypes[index]]
        );
      }
      for (const teamId of teamIds) {
        await client.query(`insert into public.cup_competition_entry (competition_id, team_id) values ($1, $2)`, [id, teamId]);
      }
      if (audience === "Specific Leagues") {
        const validLeagues = await client.query<{ id: string }>(`select id from public.league where id = any($1::uuid[])`, [visibilityLeagueIds]);
        if (validLeagues.rowCount !== visibilityLeagueIds.length) throw new Error("One or more selected leagues are invalid.");
        for (const leagueId of visibilityLeagueIds) {
          await client.query(`insert into public.cup_competition_visibility_league (competition_id, league_id) values ($1, $2)`, [id, leagueId]);
        }
      }
      for (let index = 0; index < roundCount; index += 1) {
        await client.query(
          `insert into public.cup_competition_round (competition_id, round_number, name, fixture_date)
           values ($1, $2, $3, $4::date)`,
          [id, index + 1, cupRoundName(index + 1, roundCount), roundDates[index]]
        );
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/cup-competitions', 'Created cup competition', $2::jsonb)`,
        [user.personId, JSON.stringify({ competition_id: id, name, season_id: seasonId, team_count: teamIds.length, round_count: roundCount, format: gameTypes, audience, visibility_league_ids: visibilityLeagueIds })]
      );
      return id;
    });

    return NextResponse.json({ ok: true, competitionId, ...(await loadAdminCupData()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create cup competition." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const competitionId = String(body.competitionId ?? "").trim();
    const audience = String(body.audience ?? "").trim();
    const visibilityLeagueIds = Array.from(new Set((Array.isArray(body.visibilityLeagueIds) ? body.visibilityLeagueIds : []).map((value: unknown) => String(value).trim()).filter(Boolean)));
    if (!competitionId) return NextResponse.json({ error: "Competition is required." }, { status: 400 });
    if (!["Everyone", "All Players", "All Managers", "All Players and Managers", "Specific Leagues", "League Chairs"].includes(audience)) return NextResponse.json({ error: "Choose a valid audience." }, { status: 400 });
    if (audience === "Specific Leagues" && !visibilityLeagueIds.length) return NextResponse.json({ error: "Choose at least one visible league." }, { status: 400 });

    await withTransaction(async (client) => {
      const competition = await client.query<{ id: string }>(`select id from public.cup_competition where id = $1 for update`, [competitionId]);
      if (!competition.rowCount) throw new Error("Cup competition not found.");
      if (audience === "Specific Leagues") {
        const validLeagues = await client.query<{ id: string }>(`select id from public.league where id = any($1::uuid[])`, [visibilityLeagueIds]);
        if (validLeagues.rowCount !== visibilityLeagueIds.length) throw new Error("One or more selected leagues are invalid.");
      }
      await client.query(`update public.cup_competition set audience = $2, updated_at = now() where id = $1`, [competitionId, audience]);
      await client.query(`delete from public.cup_competition_visibility_league where competition_id = $1`, [competitionId]);
      if (audience === "Specific Leagues") {
        for (const leagueId of visibilityLeagueIds) {
          await client.query(`insert into public.cup_competition_visibility_league (competition_id, league_id) values ($1, $2)`, [competitionId, leagueId]);
        }
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/cup-competitions', 'Updated cup visibility', $2::jsonb)`,
        [user.personId, JSON.stringify({ competition_id: competitionId, audience, visibility_league_ids: visibilityLeagueIds })]
      );
    });
    return NextResponse.json({ ok: true, ...(await loadAdminCupData()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update cup visibility." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const competitionId = String(body.competitionId ?? "").trim();
    if (!competitionId) return NextResponse.json({ error: "Competition is required." }, { status: 400 });

    await withTransaction(async (client) => {
      const competition = await client.query<{ id: string; name: string; status: string }>(
        `select id, name, status from public.cup_competition where id = $1 for update`,
        [competitionId]
      );
      if (!competition.rowCount) throw new Error("Cup competition not found.");

      const fixtures = await client.query<{ fixture_count: string }>(
        `select count(*)::text as fixture_count
         from public.cup_competition_tie ct
         join public.cup_competition_round cr on cr.id = ct.competition_round_id
         where cr.competition_id = $1 and ct.fixture_id is not null`,
        [competitionId]
      );
      const deleted = competition.rows[0];
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/cup-competitions', 'Deleted cup competition', $2::jsonb)`,
        [user.personId, JSON.stringify({
          competition_id: deleted.id,
          name: deleted.name,
          status: deleted.status,
          fixture_count: Number(fixtures.rows[0]?.fixture_count ?? 0)
        })]
      );
      await client.query(`delete from public.cup_competition where id = $1`, [competitionId]);
    });

    return NextResponse.json({ ok: true, ...(await loadAdminCupData()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete cup competition." }, { status: 400 });
  }
}
