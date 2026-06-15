import { NextRequest, NextResponse } from "next/server";
import { PoolClient } from "pg";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

const lineupSlots = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1" },
  { slotNumber: 2, gameType: "Singles", label: "Singles 2" },
  { slotNumber: 3, gameType: "Doubles", label: "Doubles" },
  { slotNumber: 4, gameType: "Singles", label: "Singles 4" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5" },
  { slotNumber: 6, gameType: "Singles", label: "Singles 6" }
] as const;

type LineupSlotInput = {
  slotNumber?: number;
  player1Id?: string;
  player2Id?: string;
};

type GameBreakRow = {
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  break_value: number;
  recorded_at: string;
};

async function requireTeamManager(teamId: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery(
    `select 1
     from public.team target_team
     join public.person_team_role ptr
       on ptr.club_id = target_team.club_id
      and ptr.league_id = target_team.league_id
      and ptr.team_name = target_team.name
     where target_team.id = $2
       and ptr.person_id = $1
       and ptr.role in ('Manager', 'Assistant Manager')
       and ptr.active = true
     union
     select 1
     from public.team_membership tm
     where tm.person_id = $1
       and tm.team_id = $2
       and tm.role in ('Manager', 'Assistant Manager')
       and tm.active = true
     limit 1`,
    [user.personId, teamId]
  );
  if (!rowCount) throw new Error("Manager access is required for this team.");
  return user;
}

async function requireTeamMember(teamId: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const result = await dbQuery<{ has_membership: boolean; can_manage: boolean }>(
    `select
       exists (
         select 1
         from public.team target_team
         join public.person_team_role ptr
           on ptr.club_id = target_team.club_id
          and ptr.league_id = target_team.league_id
          and ptr.team_name = target_team.name
         where target_team.id = $2
           and ptr.person_id = $1
           and ptr.active = true
       ) or exists (
         select 1
         from public.team_membership tm
         where tm.person_id = $1
           and tm.team_id = $2
           and tm.active = true
       ) as has_membership,
       exists (
         select 1
         from public.team target_team
         join public.person_team_role ptr
           on ptr.club_id = target_team.club_id
          and ptr.league_id = target_team.league_id
          and ptr.team_name = target_team.name
         where target_team.id = $2
           and ptr.person_id = $1
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
    [user.personId, teamId]
  );
  if (!result.rows[0]?.has_membership) throw new Error("Team access is required.");
  return { user, canManage: Boolean(result.rows[0]?.can_manage) };
}

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
    const fixtureId = request.nextUrl.searchParams.get("fixtureId")?.trim();
    if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    const { canManage } = await requireTeamMember(teamId);

    const payload = await loadLineupPayload(teamId, fixtureId || undefined);
    return NextResponse.json({ ...payload, canManage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lineup unavailable." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) throw new Error("Not authenticated.");

    const body = await request.json();
    const teamId = String(body.teamId ?? "").trim();
    const fixtureId = String(body.fixtureId ?? "").trim();
    const action = String(body.action ?? "save").trim();
    const slots = Array.isArray(body.slots) ? body.slots as LineupSlotInput[] : [];

    if (!teamId || !fixtureId) {
      return NextResponse.json({ error: "teamId and fixtureId are required." }, { status: 400 });
    }
    await requireTeamManager(teamId);

    if (action === "recordResult") {
      const gameId = String(body.gameId ?? "").trim();
      const winnerTeamId = String(body.winnerTeamId ?? "").trim();
      if (!gameId || !winnerTeamId) {
        return NextResponse.json({ error: "gameId and winnerTeamId are required." }, { status: 400 });
      }

      await withTransaction(async (client) => {
        await ensureFixtureTeam(client, fixtureId, teamId);
        await recordGameWinner(client, fixtureId, gameId, winnerTeamId);
      });

      const payload = await loadLineupPayload(teamId, fixtureId);
      return NextResponse.json({ ok: true, ...payload, canManage: true });
    }

    if (action === "recordBreak") {
      const gameId = String(body.gameId ?? "").trim();
      const playerId = String(body.playerId ?? "").trim();
      const breakValue = Number(body.breakValue);
      if (!gameId || !playerId || !Number.isInteger(breakValue) || breakValue < 1 || breakValue > 147) {
        return NextResponse.json({ error: "Choose a player and enter a break between 1 and 147." }, { status: 400 });
      }

      await withTransaction(async (client) => {
        await ensureFixtureTeam(client, fixtureId, teamId);
        await recordPlayerBreak(client, fixtureId, gameId, playerId, breakValue);
      });

      const payload = await loadLineupPayload(teamId, fixtureId);
      return NextResponse.json({ ok: true, ...payload, canManage: true });
    }

    await withTransaction(async (client) => {
      await ensureFixtureTeam(client, fixtureId, teamId);
      const existingStatus = await loadLineupStatus(client, fixtureId, teamId);
      if (existingStatus === "Published") {
        throw new Error("Published lineups are locked and cannot be changed.");
      }
      const playerIds = await loadTeamPlayerIds(client, teamId);
      const normalized = normalizeSlots(slots, playerIds, action === "publish");
      const lineupId = await upsertLineup(client, fixtureId, teamId, user.personId, action === "publish");

      for (const slot of lineupSlots) {
        const selected = normalized.find((item) => item.slotNumber === slot.slotNumber);
        await client.query(
          `insert into public.fixture_lineup_slot (lineup_id, slot_number, game_type, player_1_id, player_2_id)
           values ($1, $2, $3, $4, $5)
           on conflict (lineup_id, slot_number) do update
           set player_1_id = excluded.player_1_id,
               player_2_id = excluded.player_2_id`,
          [lineupId, slot.slotNumber, slot.gameType, selected?.player1Id || null, selected?.player2Id || null]
        );
      }

      if (action === "publish") {
        await generateGamesIfBothPublished(client, fixtureId, user.personId);
      }
    });

    const payload = await loadLineupPayload(teamId, fixtureId);
    return NextResponse.json({ ok: true, ...payload, canManage: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save lineup." },
      { status: 400 }
    );
  }
}

async function loadLineupPayload(teamId: string, preferredFixtureId?: string) {
  const fixtureResult = await dbQuery<{
    fixture_id: string;
    fixture_date: string;
    home_team_id: string;
    away_team_id: string;
    home_team_name: string;
    away_team_name: string;
    league_name: string;
    season_name: string;
    status: string;
  }>(
    `${fixtureSelectSql}
     where f.status = 'Scheduled'
       and ($1::uuid is null or f.id = $1)
       and (f.home_team_id = $2 or f.away_team_id = $2)
     order by case when $1::uuid is not null then 0 else 1 end, f.fixture_date asc
     limit 1`,
    [preferredFixtureId || null, teamId]
  );

  const fixture = fixtureResult.rows[0];
  const players = (await dbQuery<{ person_id: string; player_name: string }>(
    `select distinct p.id as person_id, concat_ws(' ', p.first_name, p.last_name) as player_name
     from public.team target_team
     join public.person_team_role ptr
       on ptr.club_id = target_team.club_id
      and ptr.league_id = target_team.league_id
      and ptr.team_name = target_team.name
     join public.person p on p.id = ptr.person_id
     where target_team.id = $1
       and ptr.role = 'Player'
       and ptr.active = true
       and p.active = true
     union
     select distinct p.id as person_id, concat_ws(' ', p.first_name, p.last_name) as player_name
     from public.team_membership tm
     join public.person p on p.id = tm.person_id
     where tm.team_id = $1
       and tm.role = 'Player'
       and tm.active = true
       and p.active = true
     order by player_name`,
    [teamId]
  )).rows.map((row) => ({ id: row.person_id, name: row.player_name }));

  if (!fixture) {
    return { fixture: null, players, lineup: null, opponentStatus: null, opponentLineup: null, games: [], weekFixtures: [] };
  }

  const lineupRows = (await dbQuery<LineupRow>(
    lineupQuerySql,
    [fixture.fixture_id]
  )).rows;
  const own = buildLineup(lineupRows.filter((row) => row.team_id === teamId), fixture);
  const opponentTeamId = fixture.home_team_id === teamId ? fixture.away_team_id : fixture.home_team_id;
  const opponentRaw = lineupRows.filter((row) => row.team_id === opponentTeamId);
  const opponentStatus = opponentRaw[0] ? {
    teamName: opponentRaw[0].team_name,
    status: opponentRaw[0].status,
    publishedAt: opponentRaw[0].published_at
  } : null;
  const opponent = own?.status === "Published" && opponentRaw[0]?.status === "Published" ? buildLineup(opponentRaw, fixture) : null;

  const games = (await dbQuery(
    `select
       g.id,
       g.game_number,
       g.game_type::text,
       g.points_awarded,
       g.winner_team_id,
       hp1.id as home_player_1_id,
       concat_ws(' ', hp1.first_name, hp1.last_name) as home_player_1_name,
       hp2.id as home_player_2_id,
       concat_ws(' ', hp2.first_name, hp2.last_name) as home_player_2_name,
       ap1.id as away_player_1_id,
       concat_ws(' ', ap1.first_name, ap1.last_name) as away_player_1_name,
       ap2.id as away_player_2_id,
       concat_ws(' ', ap2.first_name, ap2.last_name) as away_player_2_name
     from public.match m
     join public.game g on g.match_id = m.id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     where m.fixture_id = $1
     order by g.game_number`,
    [fixture.fixture_id]
  )).rows;
  const weekFixtureRows = (await dbQuery<{
    fixture_id: string;
    fixture_date: string;
    home_team_id: string;
    away_team_id: string;
    home_team_name: string;
    away_team_name: string;
    status: "Scheduled" | "Completed";
    match_id: string | null;
    home_team_score: number | null;
    away_team_score: number | null;
    home_lineup_status: "Draft" | "Published" | null;
    away_lineup_status: "Draft" | "Published" | null;
  }>(
    `select
       wf.id as fixture_id,
       wf.fixture_date,
       wf.home_team_id,
       wf.away_team_id,
       wht.name as home_team_name,
       wat.name as away_team_name,
       wf.status::text as status,
       m.id as match_id,
       m.home_team_score,
       m.away_team_score,
       hfl.status as home_lineup_status,
       afl.status as away_lineup_status
     from public.fixture wf
     join public.team wht on wht.id = wf.home_team_id
     join public.team wat on wat.id = wf.away_team_id
     left join public.match m on m.fixture_id = wf.id
     left join public.fixture_lineup hfl on hfl.fixture_id = wf.id and hfl.team_id = wf.home_team_id
     left join public.fixture_lineup afl on afl.fixture_id = wf.id and afl.team_id = wf.away_team_id
     where wf.season_id = (
         select season_id from public.fixture where id = $1
       )
       and wf.league_id = (
         select league_id from public.fixture where id = $1
       )
       and wf.fixture_date::date = (
         select fixture_date::date from public.fixture where id = $1
       )
     order by
       case when wf.home_team_id = $2 or wf.away_team_id = $2 then 0 else 1 end,
       wf.fixture_date,
       wht.name,
       wat.name`,
    [fixture.fixture_id, teamId]
  )).rows;
  const weekGameRows = (await dbQuery<{
    fixture_id: string;
    id: string;
    game_number: number;
    game_type: "Singles" | "Doubles";
    points_awarded: number;
    winner_team_id: string | null;
    home_player_1_id: string | null;
    home_player_1_name: string;
    home_player_2_id: string | null;
    home_player_2_name: string | null;
    away_player_1_id: string | null;
    away_player_1_name: string;
    away_player_2_id: string | null;
    away_player_2_name: string | null;
  }>(
    `select
       wf.id as fixture_id,
       g.id,
       g.game_number,
       g.game_type::text as game_type,
       g.points_awarded,
       g.winner_team_id,
       hp1.id as home_player_1_id,
       concat_ws(' ', hp1.first_name, hp1.last_name) as home_player_1_name,
       hp2.id as home_player_2_id,
       concat_ws(' ', hp2.first_name, hp2.last_name) as home_player_2_name,
       ap1.id as away_player_1_id,
       concat_ws(' ', ap1.first_name, ap1.last_name) as away_player_1_name,
       ap2.id as away_player_2_id,
       concat_ws(' ', ap2.first_name, ap2.last_name) as away_player_2_name
     from public.fixture wf
     join public.match m on m.fixture_id = wf.id
     join public.game g on g.match_id = m.id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     where wf.season_id = (
         select season_id from public.fixture where id = $1
       )
       and wf.league_id = (
         select league_id from public.fixture where id = $1
       )
       and wf.fixture_date::date = (
         select fixture_date::date from public.fixture where id = $1
       )
     order by wf.fixture_date, g.game_number`,
    [fixture.fixture_id]
  )).rows;
  const gameIds = [...games.map((game) => game.id), ...weekGameRows.map((game) => game.id)];
  const breakRows = gameIds.length ? (await dbQuery<GameBreakRow>(
    `select
       b.id,
       b.game_id,
       b.player_id,
       concat_ws(' ', p.first_name, p.last_name) as player_name,
       b.break_value,
       b.recorded_at::text
     from public.break b
     join public.person p on p.id = b.player_id
     where b.game_id = any($1::uuid[])
     order by b.break_value desc, b.recorded_at asc`,
    [gameIds]
  )).rows : [];
  const breaksForGame = (gameId: string) => breakRows
    .filter((row) => row.game_id === gameId)
    .map((row) => ({
      id: row.id,
      playerId: row.player_id,
      playerName: row.player_name,
      breakValue: Number(row.break_value),
      recordedAt: row.recorded_at
    }));
  const weekFixtures = weekFixtureRows.map((row) => ({
    id: row.fixture_id,
    fixtureDate: row.fixture_date,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    status: row.status,
    matchId: row.match_id,
    homeTeamScore: row.home_team_score === null ? null : Number(row.home_team_score),
    awayTeamScore: row.away_team_score === null ? null : Number(row.away_team_score),
    homeLineupStatus: row.home_lineup_status,
    awayLineupStatus: row.away_lineup_status,
    games: weekGameRows
      .filter((game) => game.fixture_id === row.fixture_id)
      .map((game) => ({
        id: game.id,
        game_number: game.game_number,
        game_type: game.game_type,
        points_awarded: game.points_awarded,
        winner_team_id: game.winner_team_id,
        home_player_1_id: game.home_player_1_id,
        home_player_1_name: game.home_player_1_name,
        home_player_2_id: game.home_player_2_id,
        home_player_2_name: game.home_player_2_name,
        away_player_1_id: game.away_player_1_id,
        away_player_1_name: game.away_player_1_name,
        away_player_2_id: game.away_player_2_id,
        away_player_2_name: game.away_player_2_name,
        breaks: breaksForGame(game.id)
      }))
  }));

  return {
    fixture: {
      id: fixture.fixture_id,
      fixtureDate: fixture.fixture_date,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeamName: fixture.home_team_name,
      awayTeamName: fixture.away_team_name,
      league: fixture.league_name,
      season: fixture.season_name,
      status: fixture.status
    },
    players,
    lineup: own,
    opponentStatus,
    opponentLineup: opponent,
    games: games.map((game) => ({
      ...game,
      breaks: breaksForGame(game.id)
    })),
    weekFixtures,
    canManage: false
  };
}

const fixtureSelectSql = `
  select
    f.id as fixture_id,
    f.fixture_date,
    f.home_team_id,
    f.away_team_id,
    ht.name as home_team_name,
    at.name as away_team_name,
    l.name as league_name,
    s.name as season_name,
    f.status::text as status
  from public.fixture f
  join public.team ht on ht.id = f.home_team_id
  join public.team at on at.id = f.away_team_id
  join public.league l on l.id = f.league_id
  join public.season s on s.id = f.season_id
`;

type LineupRow = {
  lineup_id: string;
  fixture_id: string;
  team_id: string;
  team_name: string;
  status: "Draft" | "Published";
  published_at: string | null;
  slot_number: number | null;
  game_type: "Singles" | "Doubles" | null;
  player_1_id: string | null;
  player_1_name: string | null;
  player_2_id: string | null;
  player_2_name: string | null;
};

const lineupQuerySql = `
  select
    fl.id as lineup_id,
    fl.fixture_id,
    fl.team_id,
    t.name as team_name,
    fl.status,
    fl.published_at,
    fls.slot_number,
    fls.game_type::text as game_type,
    fls.player_1_id,
    concat_ws(' ', p1.first_name, p1.last_name) as player_1_name,
    fls.player_2_id,
    concat_ws(' ', p2.first_name, p2.last_name) as player_2_name
  from public.fixture_lineup fl
  join public.team t on t.id = fl.team_id
  left join public.fixture_lineup_slot fls on fls.lineup_id = fl.id
  left join public.person p1 on p1.id = fls.player_1_id
  left join public.person p2 on p2.id = fls.player_2_id
  where fl.fixture_id = $1
  order by fl.team_id, fls.slot_number
`;

function buildLineup(rows: LineupRow[], fixture: { fixture_id: string }) {
  const first = rows[0];
  if (!first) {
    return {
      fixtureId: fixture.fixture_id,
      status: "Draft",
      slots: lineupSlots.map((slot) => ({ ...slot, player1Id: "", player1Name: "", player2Id: "", player2Name: "" }))
    };
  }

  return {
    id: first.lineup_id,
    fixtureId: first.fixture_id,
    teamId: first.team_id,
    teamName: first.team_name,
    status: first.status,
    publishedAt: first.published_at,
    slots: lineupSlots.map((slot) => {
      const row = rows.find((item) => item.slot_number === slot.slotNumber);
      return {
        ...slot,
        player1Id: row?.player_1_id ?? "",
        player1Name: row?.player_1_name ?? "",
        player2Id: row?.player_2_id ?? "",
        player2Name: row?.player_2_name ?? ""
      };
    })
  };
}

async function ensureFixtureTeam(client: PoolClient, fixtureId: string, teamId: string) {
  const result = await client.query(
    `select 1
     from public.fixture
     where id = $1
       and status = 'Scheduled'
       and (home_team_id = $2 or away_team_id = $2)
     limit 1`,
    [fixtureId, teamId]
  );
  if (!result.rowCount) throw new Error("Scheduled fixture not found for this team.");
}

async function loadTeamPlayerIds(client: PoolClient, teamId: string) {
  const result = await client.query<{ person_id: string }>(
    `select ptr.person_id
     from public.team target_team
     join public.person_team_role ptr
       on ptr.club_id = target_team.club_id
      and ptr.league_id = target_team.league_id
      and ptr.team_name = target_team.name
     where target_team.id = $1
       and ptr.role = 'Player'
       and ptr.active = true
     union
     select tm.person_id
     from public.team_membership tm
     where tm.team_id = $1
       and tm.role = 'Player'
       and tm.active = true`,
    [teamId]
  );
  return new Set(result.rows.map((row) => row.person_id));
}

async function loadLineupStatus(client: PoolClient, fixtureId: string, teamId: string) {
  const result = await client.query<{ status: "Draft" | "Published" }>(
    `select status
     from public.fixture_lineup
     where fixture_id = $1
       and team_id = $2
     limit 1`,
    [fixtureId, teamId]
  );
  return result.rows[0]?.status ?? null;
}

function normalizeSlots(slots: LineupSlotInput[], playerIds: Set<string>, requireComplete: boolean) {
  const normalized = lineupSlots.map((slot) => {
    const input = slots.find((item) => Number(item.slotNumber) === slot.slotNumber);
    const player1Id = String(input?.player1Id ?? "").trim();
    const player2Id = String(input?.player2Id ?? "").trim();
    if (player1Id && !playerIds.has(player1Id)) throw new Error(`${slot.label} player is not in this team.`);
    if (player2Id && !playerIds.has(player2Id)) throw new Error(`${slot.label} doubles partner is not in this team.`);
    if (player1Id && player2Id && player1Id === player2Id) throw new Error(`${slot.label} needs two different players.`);
    if (requireComplete && !player1Id) throw new Error(`${slot.label} needs a player before publishing.`);
    if (requireComplete && slot.gameType === "Doubles" && !player2Id) throw new Error("Doubles needs two players before publishing.");
    if (requireComplete && slot.gameType === "Singles" && player2Id) throw new Error(`${slot.label} is a singles slot.`);
    return {
      slotNumber: slot.slotNumber,
      player1Id,
      player2Id: slot.gameType === "Doubles" ? player2Id : ""
    };
  });
  const selectedIds = normalized.flatMap((slot) => [slot.player1Id, slot.player2Id].filter(Boolean));
  const duplicateId = selectedIds.find((playerId, index) => selectedIds.indexOf(playerId) !== index);
  if (duplicateId) {
    throw new Error("A player can only be selected once in a lineup.");
  }
  return normalized;
}

async function upsertLineup(client: PoolClient, fixtureId: string, teamId: string, personId: string, publish: boolean) {
  const result = await client.query<{ id: string }>(
    `insert into public.fixture_lineup (fixture_id, team_id, status, submitted_by, published_at, updated_at)
     values ($1, $2, $3, $4, case when $3 = 'Published' then now() else null end, now())
     on conflict (fixture_id, team_id) do update
     set status = excluded.status,
         submitted_by = excluded.submitted_by,
         published_at = case
           when excluded.status = 'Published' and public.fixture_lineup.published_at is null then now()
           when excluded.status = 'Published' then public.fixture_lineup.published_at
           else null
         end,
         updated_at = now()
     returning id`,
    [fixtureId, teamId, publish ? "Published" : "Draft", personId]
  );
  return result.rows[0].id;
}

async function generateGamesIfBothPublished(client: PoolClient, fixtureId: string, personId: string) {
  const fixtureResult = await client.query<{
    home_team_id: string;
    away_team_id: string;
  }>("select home_team_id, away_team_id from public.fixture where id = $1 for update", [fixtureId]);
  const fixture = fixtureResult.rows[0];
  if (!fixture) throw new Error("Fixture not found.");

  const lineupResult = await client.query<LineupRow>(lineupQuerySql, [fixtureId]);
  const home = buildLineup(lineupResult.rows.filter((row) => row.team_id === fixture.home_team_id), { fixture_id: fixtureId });
  const away = buildLineup(lineupResult.rows.filter((row) => row.team_id === fixture.away_team_id), { fixture_id: fixtureId });
  if (home.status !== "Published" || away.status !== "Published") return;

  const matchResult = await client.query<{ id: string }>(
    `insert into public.match (fixture_id, entered_by, entered_at)
     values ($1, $2, now())
     on conflict (fixture_id) do update
     set entered_by = coalesce(public.match.entered_by, excluded.entered_by)
     returning id`,
    [fixtureId, personId]
  );
  const matchId = matchResult.rows[0].id;

  for (const slot of lineupSlots) {
    const homeSlot = home.slots.find((item) => item.slotNumber === slot.slotNumber);
    const awaySlot = away.slots.find((item) => item.slotNumber === slot.slotNumber);
    await client.query(
      `insert into public.game (
         match_id, game_type, game_number, home_player_1_id, home_player_2_id,
         away_player_1_id, away_player_2_id, points_awarded
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (match_id, game_number) do update
       set home_player_1_id = excluded.home_player_1_id,
           home_player_2_id = excluded.home_player_2_id,
           away_player_1_id = excluded.away_player_1_id,
           away_player_2_id = excluded.away_player_2_id,
           game_type = excluded.game_type,
           points_awarded = excluded.points_awarded`,
      [
        matchId,
        slot.gameType,
        slot.slotNumber,
        homeSlot?.player1Id || null,
        slot.gameType === "Doubles" ? homeSlot?.player2Id || null : null,
        awaySlot?.player1Id || null,
        slot.gameType === "Doubles" ? awaySlot?.player2Id || null : null,
        slot.gameType === "Doubles" ? 2 : 1
      ]
    );
  }
}

async function recordGameWinner(client: PoolClient, fixtureId: string, gameId: string, winnerTeamId: string) {
  const result = await client.query<{ match_id: string }>(
    `select m.id as match_id
     from public.match m
     join public.fixture f on f.id = m.fixture_id
     join public.game g on g.match_id = m.id
     where f.id = $1
       and g.id = $2
       and (f.home_team_id = $3 or f.away_team_id = $3)
     limit 1`,
    [fixtureId, gameId, winnerTeamId]
  );
  const matchId = result.rows[0]?.match_id;
  if (!matchId) throw new Error("Game not found for this fixture.");

  await client.query("update public.game set winner_team_id = $1 where id = $2", [winnerTeamId, gameId]);
  await client.query("select public.refresh_match_team_points($1)", [matchId]);

  const completion = await client.query<{ total_games: string; completed_games: string }>(
    `select count(*) as total_games, count(*) filter (where winner_team_id is not null) as completed_games
     from public.game
     where match_id = $1`,
    [matchId]
  );
  if (Number(completion.rows[0]?.total_games ?? 0) === 6 && Number(completion.rows[0]?.completed_games ?? 0) === 6) {
    await client.query("update public.fixture set status = 'Completed' where id = $1", [fixtureId]);
  }
}

async function recordPlayerBreak(client: PoolClient, fixtureId: string, gameId: string, playerId: string, breakValue: number) {
  const result = await client.query<{ game_id: string }>(
    `select g.id as game_id
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     join public.game g on g.match_id = m.id
     where f.id = $1
       and g.id = $2
       and $3::uuid in (g.home_player_1_id, g.home_player_2_id, g.away_player_1_id, g.away_player_2_id)
     limit 1`,
    [fixtureId, gameId, playerId]
  );
  if (!result.rowCount) throw new Error("Break player must be one of the players in this game.");

  await client.query(
    `insert into public.break (game_id, player_id, break_value, source_label)
     values ($1, $2, $3, 'live-match-entry')`,
    [gameId, playerId, breakValue]
  );
}
