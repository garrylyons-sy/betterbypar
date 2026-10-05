import { NextRequest, NextResponse } from "next/server";
import { PoolClient } from "pg";

import { currentUser, testUserFromEmail } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

type LineupSlotDefinition = {
  slotNumber: number;
  gameType: "Singles" | "Doubles";
  label: string;
};

const standardLineupSlots: LineupSlotDefinition[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1" },
  { slotNumber: 2, gameType: "Singles", label: "Singles 2" },
  { slotNumber: 3, gameType: "Doubles", label: "Doubles" },
  { slotNumber: 4, gameType: "Singles", label: "Singles 4" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5" },
  { slotNumber: 6, gameType: "Singles", label: "Singles 6" }
];

const cLeagueLineupSlots: LineupSlotDefinition[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1" },
  { slotNumber: 2, gameType: "Doubles", label: "Doubles 2" },
  { slotNumber: 3, gameType: "Singles", label: "Singles 3" },
  { slotNumber: 4, gameType: "Doubles", label: "Doubles 4" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5" }
];

function lineupSlotsForLeague(leagueName?: string | null): LineupSlotDefinition[] {
  return leagueName === "C League" ? cLeagueLineupSlots : standardLineupSlots;
}

type LineupSlotInput = {
  slotNumber?: number;
  player1Id?: string;
  player2Id?: string;
  player1GuestName?: string;
  player2GuestName?: string;
  player1IsGuest?: boolean;
  player2IsGuest?: boolean;
  player1CountsForStats?: boolean;
  player2CountsForStats?: boolean;
};

type GameBreakRow = {
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  break_value: number;
  recorded_at: string;
};

function isTrustedLineupTestManager(user: Awaited<ReturnType<typeof currentUser>>, value: unknown) {
  const requested = value === true || value === "true" || value === "1";
  return requested && user?.email?.toLowerCase() === "garlyons@gmail.com";
}

async function requestUser(options?: { testUser?: unknown }) {
  const testEmail = typeof options?.testUser === "string" ? options.testUser : "";
  return await testUserFromEmail(testEmail) ?? await currentUser();
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

async function requireTeamManager(teamId: string, options?: { testManager?: unknown; testUser?: unknown }) {
  const user = await requestUser({ testUser: options?.testUser });
  if (!user) throw new Error("Not authenticated.");
  if (isTrustedLineupTestManager(user, options?.testManager)) return user;
  if (await isAppOperator(user.personId)) return user;
  const { rowCount } = await dbQuery(
    `select 1
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
       and ptr.role = 'Manager'
       and ptr.active = true
     union
     select 1
     from public.team_membership tm
     where tm.person_id = $1
       and tm.team_id = $2
       and tm.role = 'Manager'
       and tm.active = true
     limit 1`,
    [user.personId, teamId]
  );
  if (!rowCount) throw new Error("Manager access is required for this team.");
  return user;
}

async function requireTeamMember(teamId: string, options?: { testManager?: unknown; testUser?: unknown }) {
  const user = await requestUser({ testUser: options?.testUser });
  if (!user) throw new Error("Not authenticated.");
  if (isTrustedLineupTestManager(user, options?.testManager)) {
    return { user, canManage: true };
  }
  if (await isAppOperator(user.personId)) {
    return { user, canManage: true };
  }
  const result = await dbQuery<{ has_membership: boolean; can_manage: boolean }>(
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
       ) as has_membership,
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
           and ptr.role = 'Manager'
           and ptr.active = true
       ) or exists (
         select 1
         from public.team_membership tm
         where tm.person_id = $1
           and tm.team_id = $2
           and tm.role = 'Manager'
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
    const testManager = request.nextUrl.searchParams.get("testManager");
    const testUser = request.nextUrl.searchParams.get("testUser");
    if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    const { canManage } = await requireTeamMember(teamId, { testManager, testUser });

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
    const body = await request.json();
    const user = await requestUser({ testUser: body.testUser });
    if (!user) throw new Error("Not authenticated.");

    const teamId = String(body.teamId ?? "").trim();
    const fixtureId = String(body.fixtureId ?? "").trim();
    const action = String(body.action ?? "save").trim();
    const slots = Array.isArray(body.slots) ? body.slots as LineupSlotInput[] : [];
    const testManager = body.testManager;
    const adminOverride = Boolean(body.adminOverride) && await isAppOperator(user.personId);

    if (!teamId || !fixtureId) {
      return NextResponse.json({ error: "teamId and fixtureId are required." }, { status: 400 });
    }
    await requireTeamManager(teamId, { testManager, testUser: body.testUser });

    if (action === "recordResult") {
      const gameId = String(body.gameId ?? "").trim();
      const winnerTeamId = body.winnerTeamId === null ? null : String(body.winnerTeamId ?? "").trim();
      if (!gameId || winnerTeamId === "") {
        return NextResponse.json({ error: "gameId is required." }, { status: 400 });
      }

      await withTransaction(async (client) => {
        await ensureFixtureTeam(client, fixtureId, teamId);
        await recordGameWinner(client, fixtureId, gameId, winnerTeamId);
      });

      const payload = await loadLineupPayload(teamId, fixtureId);
      return NextResponse.json({ ok: true, ...payload, canManage: true });
    }

    if (action === "completeMatch") {
      await withTransaction(async (client) => {
        await ensureFixtureTeam(client, fixtureId, teamId);
        await completeMatch(client, fixtureId);
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
      if (existingStatus === "Published" && !adminOverride) {
        throw new Error("Published lineups are locked and cannot be changed.");
      }
      const playerIds = await loadTeamPlayerIds(client, teamId);
      const guestAccess = await loadEligibleGuestPlayerAccess(client, teamId, fixtureId);
      const fixtureMeta = await loadFixtureLineupMeta(client, fixtureId);
      const normalized = normalizeSlots(slots, playerIds, guestAccess.eligibleIds, action === "publish", fixtureMeta.slotDefinitions, fixtureMeta.fixtureType === "Friendly", guestAccess.blockedByTeam);
      const lineupId = await upsertLineup(client, fixtureId, teamId, user.personId, action === "publish");

      for (const slot of fixtureMeta.slotDefinitions) {
        const selected = normalized.find((item) => item.slotNumber === slot.slotNumber);
        await client.query(
          `insert into public.fixture_lineup_slot (
             lineup_id, slot_number, game_type, player_1_id, player_2_id,
             player_1_guest_name, player_2_guest_name,
             player_1_is_guest, player_2_is_guest,
             player_1_counts_for_stats, player_2_counts_for_stats
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (lineup_id, slot_number) do update
           set player_1_id = excluded.player_1_id,
               player_2_id = excluded.player_2_id,
               player_1_guest_name = excluded.player_1_guest_name,
               player_2_guest_name = excluded.player_2_guest_name,
               player_1_is_guest = excluded.player_1_is_guest,
               player_2_is_guest = excluded.player_2_is_guest,
               player_1_counts_for_stats = excluded.player_1_counts_for_stats,
               player_2_counts_for_stats = excluded.player_2_counts_for_stats`,
          [
            lineupId,
            slot.slotNumber,
            slot.gameType,
            selected?.player1Id || null,
            selected?.player2Id || null,
            selected?.player1GuestName || null,
            selected?.player2GuestName || null,
            Boolean(selected?.player1IsGuest),
            Boolean(selected?.player2IsGuest),
            selected?.player1CountsForStats ?? true,
            selected?.player2CountsForStats ?? true
          ]
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
    fixture_type: "League" | "Friendly";
  }>(
    `${fixtureSelectSql}
     where (
         ($1::uuid is not null and f.id = $1)
         or ($1::uuid is null and f.status = 'Scheduled')
       )
       and (f.home_team_id = $2 or f.away_team_id = $2)
       and ($1::uuid is not null or coalesce(f.fixture_type, 'League') = 'League')
     order by case when $1::uuid is not null then 0 else 1 end, f.fixture_date asc
     limit 1`,
    [preferredFixtureId || null, teamId]
  );

  const fixture = fixtureResult.rows[0];
  const players = (await dbQuery<{ person_id: string; player_name: string }>(
    `select distinct p.id as person_id, concat_ws(' ', p.first_name, p.last_name) as player_name
     from public.team target_team
     join public.person_team_role ptr
       on ptr.league_id = target_team.league_id
      and ptr.team_name = target_team.name
     join public.club_membership cm
       on cm.id = ptr.club_membership_id
      and cm.club_id = target_team.club_id
      and cm.active = true
     join public.person p on p.id = cm.person_id
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
  const playerIds = new Set(players.map((player) => player.id));
  const guestPlayers = (await dbQuery<{ person_id: string; player_name: string; team_name: string; already_played_for_team: string | null }>(
    eligibleGuestPlayersSql,
    [teamId, fixture?.fixture_id ?? null]
  )).rows
    .filter((row) => !playerIds.has(row.person_id))
    .map((row) => ({
      id: row.person_id,
      name: row.player_name,
      teamName: row.team_name,
      disabledReason: row.already_played_for_team ? `Already played for ${row.already_played_for_team}` : ""
    }));

  if (!fixture) {
    return { fixture: null, players, guestPlayers, lineup: null, opponentStatus: null, opponentLineup: null, games: [], weekFixtures: [] };
  }

  const lineupRows = (await dbQuery<LineupRow>(
    lineupQuerySql,
    [fixture.fixture_id]
  )).rows;
  const slotDefinitions = lineupSlotsForLeague(fixture.league_name);
  const own = buildLineup(lineupRows.filter((row) => row.team_id === teamId), fixture, slotDefinitions);
  const opponentTeamId = fixture.home_team_id === teamId ? fixture.away_team_id : fixture.home_team_id;
  const opponentRaw = lineupRows.filter((row) => row.team_id === opponentTeamId);
  const opponentStatus = opponentRaw[0] ? {
    teamName: opponentRaw[0].team_name,
    status: opponentRaw[0].status,
    publishedAt: opponentRaw[0].published_at
  } : null;
  const opponent = own?.status === "Published" && opponentRaw[0]?.status === "Published" ? buildLineup(opponentRaw, fixture, slotDefinitions) : null;

  const games = (await dbQuery(
    `select
       g.id,
       g.game_number,
       g.game_type::text,
       g.points_awarded,
       g.winner_team_id,
       hp1.id as home_player_1_id,
       coalesce(nullif(g.home_player_1_guest_name, ''), concat_ws(' ', hp1.first_name, hp1.last_name)) as home_player_1_name,
       coalesce(g.home_player_1_is_guest, false) as home_player_1_is_guest,
       coalesce(g.home_player_1_counts_for_stats, true) as home_player_1_counts_for_stats,
       hp1_guest_team.team_name as home_player_1_guest_team_name,
       hp2.id as home_player_2_id,
       coalesce(nullif(g.home_player_2_guest_name, ''), concat_ws(' ', hp2.first_name, hp2.last_name)) as home_player_2_name,
       coalesce(g.home_player_2_is_guest, false) as home_player_2_is_guest,
       coalesce(g.home_player_2_counts_for_stats, true) as home_player_2_counts_for_stats,
       hp2_guest_team.team_name as home_player_2_guest_team_name,
       ap1.id as away_player_1_id,
       coalesce(nullif(g.away_player_1_guest_name, ''), concat_ws(' ', ap1.first_name, ap1.last_name)) as away_player_1_name,
       coalesce(g.away_player_1_is_guest, false) as away_player_1_is_guest,
       coalesce(g.away_player_1_counts_for_stats, true) as away_player_1_counts_for_stats,
       ap1_guest_team.team_name as away_player_1_guest_team_name,
       ap2.id as away_player_2_id,
       coalesce(nullif(g.away_player_2_guest_name, ''), concat_ws(' ', ap2.first_name, ap2.last_name)) as away_player_2_name,
       coalesce(g.away_player_2_is_guest, false) as away_player_2_is_guest,
       coalesce(g.away_player_2_counts_for_stats, true) as away_player_2_counts_for_stats,
       ap2_guest_team.team_name as away_player_2_guest_team_name
     from public.match m
     join public.fixture f on f.id = m.fixture_id
     join public.team ht on ht.id = f.home_team_id
     join public.team at on at.id = f.away_team_id
     join public.game g on g.match_id = m.id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = hp1.id and ptr.club_id = ht.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> ht.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = hp1.id and gt.club_id = ht.club_id and tm.role = 'Player' and tm.active = true and gt.name <> ht.name
       ) guest_team
       order by team_name
       limit 1
     ) hp1_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = hp2.id and ptr.club_id = ht.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> ht.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = hp2.id and gt.club_id = ht.club_id and tm.role = 'Player' and tm.active = true and gt.name <> ht.name
       ) guest_team
       order by team_name
       limit 1
     ) hp2_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = ap1.id and ptr.club_id = at.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> at.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = ap1.id and gt.club_id = at.club_id and tm.role = 'Player' and tm.active = true and gt.name <> at.name
       ) guest_team
       order by team_name
       limit 1
     ) ap1_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = ap2.id and ptr.club_id = at.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> at.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = ap2.id and gt.club_id = at.club_id and tm.role = 'Player' and tm.active = true and gt.name <> at.name
       ) guest_team
       order by team_name
       limit 1
     ) ap2_guest_team on true
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
     where (
       (
         (select coalesce(fixture_type, 'League') from public.fixture where id = $1) = 'Friendly'
         and wf.id = $1
       )
       or (
         (select coalesce(fixture_type, 'League') from public.fixture where id = $1) = 'League'
         and wf.season_id = (
           select season_id from public.fixture where id = $1
         )
         and wf.league_id = (
           select league_id from public.fixture where id = $1
         )
         and wf.fixture_date::date = (
           select fixture_date::date from public.fixture where id = $1
         )
         and coalesce(wf.fixture_type, 'League') = 'League'
       )
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
    home_player_1_is_guest: boolean;
    home_player_1_counts_for_stats: boolean;
    home_player_1_guest_team_name: string | null;
    home_player_2_id: string | null;
    home_player_2_name: string | null;
    home_player_2_is_guest: boolean;
    home_player_2_counts_for_stats: boolean;
    home_player_2_guest_team_name: string | null;
    away_player_1_id: string | null;
    away_player_1_name: string;
    away_player_1_is_guest: boolean;
    away_player_1_counts_for_stats: boolean;
    away_player_1_guest_team_name: string | null;
    away_player_2_id: string | null;
    away_player_2_name: string | null;
    away_player_2_is_guest: boolean;
    away_player_2_counts_for_stats: boolean;
    away_player_2_guest_team_name: string | null;
  }>(
    `select
       wf.id as fixture_id,
       g.id,
       g.game_number,
       g.game_type::text as game_type,
       g.points_awarded,
       g.winner_team_id,
       hp1.id as home_player_1_id,
       coalesce(nullif(g.home_player_1_guest_name, ''), concat_ws(' ', hp1.first_name, hp1.last_name)) as home_player_1_name,
       coalesce(g.home_player_1_is_guest, false) as home_player_1_is_guest,
       coalesce(g.home_player_1_counts_for_stats, true) as home_player_1_counts_for_stats,
       hp1_guest_team.team_name as home_player_1_guest_team_name,
       hp2.id as home_player_2_id,
       coalesce(nullif(g.home_player_2_guest_name, ''), concat_ws(' ', hp2.first_name, hp2.last_name)) as home_player_2_name,
       coalesce(g.home_player_2_is_guest, false) as home_player_2_is_guest,
       coalesce(g.home_player_2_counts_for_stats, true) as home_player_2_counts_for_stats,
       hp2_guest_team.team_name as home_player_2_guest_team_name,
       ap1.id as away_player_1_id,
       coalesce(nullif(g.away_player_1_guest_name, ''), concat_ws(' ', ap1.first_name, ap1.last_name)) as away_player_1_name,
       coalesce(g.away_player_1_is_guest, false) as away_player_1_is_guest,
       coalesce(g.away_player_1_counts_for_stats, true) as away_player_1_counts_for_stats,
       ap1_guest_team.team_name as away_player_1_guest_team_name,
       ap2.id as away_player_2_id,
       coalesce(nullif(g.away_player_2_guest_name, ''), concat_ws(' ', ap2.first_name, ap2.last_name)) as away_player_2_name,
       coalesce(g.away_player_2_is_guest, false) as away_player_2_is_guest,
       coalesce(g.away_player_2_counts_for_stats, true) as away_player_2_counts_for_stats,
       ap2_guest_team.team_name as away_player_2_guest_team_name
     from public.fixture wf
     join public.match m on m.fixture_id = wf.id
     join public.game g on g.match_id = m.id
     join public.team ht on ht.id = wf.home_team_id
     join public.team at on at.id = wf.away_team_id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = hp1.id and ptr.club_id = ht.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> ht.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = hp1.id and gt.club_id = ht.club_id and tm.role = 'Player' and tm.active = true and gt.name <> ht.name
       ) guest_team
       order by team_name
       limit 1
     ) hp1_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = hp2.id and ptr.club_id = ht.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> ht.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = hp2.id and gt.club_id = ht.club_id and tm.role = 'Player' and tm.active = true and gt.name <> ht.name
       ) guest_team
       order by team_name
       limit 1
     ) hp2_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = ap1.id and ptr.club_id = at.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> at.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = ap1.id and gt.club_id = at.club_id and tm.role = 'Player' and tm.active = true and gt.name <> at.name
       ) guest_team
       order by team_name
       limit 1
     ) ap1_guest_team on true
     left join lateral (
       select team_name
       from (
         select ptr.team_name
         from public.person_team_role ptr
         where ptr.person_id = ap2.id and ptr.club_id = at.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> at.name
         union
         select gt.name as team_name
         from public.team_membership tm
         join public.team gt on gt.id = tm.team_id
         where tm.person_id = ap2.id and gt.club_id = at.club_id and tm.role = 'Player' and tm.active = true and gt.name <> at.name
       ) guest_team
       order by team_name
       limit 1
     ) ap2_guest_team on true
     where (
       (
         (select coalesce(fixture_type, 'League') from public.fixture where id = $1) = 'Friendly'
         and wf.id = $1
       )
       or (
         (select coalesce(fixture_type, 'League') from public.fixture where id = $1) = 'League'
         and wf.season_id = (
           select season_id from public.fixture where id = $1
         )
         and wf.league_id = (
           select league_id from public.fixture where id = $1
         )
         and wf.fixture_date::date = (
           select fixture_date::date from public.fixture where id = $1
         )
         and coalesce(wf.fixture_type, 'League') = 'League'
       )
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
        home_player_1_is_guest: game.home_player_1_is_guest,
        home_player_1_counts_for_stats: game.home_player_1_counts_for_stats,
        home_player_1_guest_team_name: game.home_player_1_guest_team_name,
        home_player_2_id: game.home_player_2_id,
        home_player_2_name: game.home_player_2_name,
        home_player_2_is_guest: game.home_player_2_is_guest,
        home_player_2_counts_for_stats: game.home_player_2_counts_for_stats,
        home_player_2_guest_team_name: game.home_player_2_guest_team_name,
        away_player_1_id: game.away_player_1_id,
        away_player_1_name: game.away_player_1_name,
        away_player_1_is_guest: game.away_player_1_is_guest,
        away_player_1_counts_for_stats: game.away_player_1_counts_for_stats,
        away_player_1_guest_team_name: game.away_player_1_guest_team_name,
        away_player_2_id: game.away_player_2_id,
        away_player_2_name: game.away_player_2_name,
        away_player_2_is_guest: game.away_player_2_is_guest,
        away_player_2_counts_for_stats: game.away_player_2_counts_for_stats,
        away_player_2_guest_team_name: game.away_player_2_guest_team_name,
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
      status: fixture.status,
      fixtureType: fixture.fixture_type
    },
    players,
    guestPlayers,
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
    f.status::text as status,
    coalesce(f.fixture_type, 'League') as fixture_type
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
  player_1_guest_name: string | null;
  player_1_is_guest: boolean | null;
  player_1_counts_for_stats: boolean | null;
  player_1_guest_team_name: string | null;
  player_2_id: string | null;
  player_2_name: string | null;
  player_2_guest_name: string | null;
  player_2_is_guest: boolean | null;
  player_2_counts_for_stats: boolean | null;
  player_2_guest_team_name: string | null;
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
    coalesce(nullif(fls.player_1_guest_name, ''), concat_ws(' ', p1.first_name, p1.last_name)) as player_1_name,
    fls.player_1_guest_name,
    coalesce(fls.player_1_is_guest, false) as player_1_is_guest,
    coalesce(fls.player_1_counts_for_stats, true) as player_1_counts_for_stats,
    p1_guest_team.team_name as player_1_guest_team_name,
    fls.player_2_id,
    coalesce(nullif(fls.player_2_guest_name, ''), concat_ws(' ', p2.first_name, p2.last_name)) as player_2_name,
    fls.player_2_guest_name,
    coalesce(fls.player_2_is_guest, false) as player_2_is_guest,
    coalesce(fls.player_2_counts_for_stats, true) as player_2_counts_for_stats,
    p2_guest_team.team_name as player_2_guest_team_name
  from public.fixture_lineup fl
  join public.team t on t.id = fl.team_id
  left join public.fixture_lineup_slot fls on fls.lineup_id = fl.id
  left join public.person p1 on p1.id = fls.player_1_id
  left join public.person p2 on p2.id = fls.player_2_id
  left join lateral (
    select team_name
    from (
      select ptr.team_name
      from public.person_team_role ptr
      where ptr.person_id = p1.id and ptr.club_id = t.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> t.name
      union
      select gt.name as team_name
      from public.team_membership tm
      join public.team gt on gt.id = tm.team_id
      where tm.person_id = p1.id and gt.club_id = t.club_id and tm.role = 'Player' and tm.active = true and gt.name <> t.name
    ) guest_team
    order by team_name
    limit 1
  ) p1_guest_team on true
  left join lateral (
    select team_name
    from (
      select ptr.team_name
      from public.person_team_role ptr
      where ptr.person_id = p2.id and ptr.club_id = t.club_id and ptr.role = 'Player' and ptr.active = true and ptr.team_name <> t.name
      union
      select gt.name as team_name
      from public.team_membership tm
      join public.team gt on gt.id = tm.team_id
      where tm.person_id = p2.id and gt.club_id = t.club_id and tm.role = 'Player' and tm.active = true and gt.name <> t.name
    ) guest_team
    order by team_name
    limit 1
  ) p2_guest_team on true
  where fl.fixture_id = $1
  order by fl.team_id, fls.slot_number
`;

function buildLineup(rows: LineupRow[], fixture: { fixture_id: string }, slotDefinitions: LineupSlotDefinition[]) {
  const first = rows[0];
  if (!first) {
    return {
      fixtureId: fixture.fixture_id,
      status: "Draft",
      slots: slotDefinitions.map((slot) => ({
        ...slot,
        player1Id: "",
        player1Name: "",
        player1GuestName: "",
        player1IsGuest: false,
        player1CountsForStats: true,
        player2Id: "",
        player2Name: "",
        player2GuestName: "",
        player2IsGuest: false,
        player2CountsForStats: true
      }))
    };
  }

  return {
    id: first.lineup_id,
    fixtureId: first.fixture_id,
    teamId: first.team_id,
    teamName: first.team_name,
    status: first.status,
    publishedAt: first.published_at,
    slots: slotDefinitions.map((slot) => {
      const row = rows.find((item) => item.slot_number === slot.slotNumber);
      return {
        ...slot,
        player1Id: row?.player_1_id ?? "",
        player1Name: row?.player_1_name ?? "",
        player1GuestName: row?.player_1_guest_name ?? "",
        player1IsGuest: Boolean(row?.player_1_is_guest),
        player1CountsForStats: row?.player_1_counts_for_stats ?? true,
        player1GuestTeamName: row?.player_1_guest_team_name ?? null,
        player2Id: row?.player_2_id ?? "",
        player2Name: row?.player_2_name ?? "",
        player2GuestName: row?.player_2_guest_name ?? "",
        player2IsGuest: Boolean(row?.player_2_is_guest),
        player2CountsForStats: row?.player_2_counts_for_stats ?? true,
        player2GuestTeamName: row?.player_2_guest_team_name ?? null
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
    `select cm.person_id
     from public.team target_team
     join public.person_team_role ptr
       on ptr.league_id = target_team.league_id
      and ptr.team_name = target_team.name
     join public.club_membership cm
       on cm.id = ptr.club_membership_id
      and cm.club_id = target_team.club_id
      and cm.active = true
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

const eligibleGuestPlayersSql = `
  with target as (
    select
      t.*,
      case upper(right(trim(t.name), 1))
        when 'A' then 1
        when 'B' then 2
        when 'C' then 3
        when 'D' then 4
        else null
      end as team_rank
    from public.team t
    where t.id = $1
  ),
  lower_teams as (
    select
      t.*,
      case upper(right(trim(t.name), 1))
        when 'A' then 1
        when 'B' then 2
        when 'C' then 3
        when 'D' then 4
        else null
      end as team_rank
    from public.team t
    join target on target.club_id = t.club_id
    where t.active = true
      and t.season_id = target.season_id
      and (
        case upper(right(trim(t.name), 1))
          when 'A' then 1
          when 'B' then 2
          when 'C' then 3
          when 'D' then 4
          else null
        end
      ) > target.team_rank
  ),
  candidate_players as (
    select distinct p.id as person_id, concat_ws(' ', p.first_name, p.last_name) as player_name, lt.name as team_name
    from lower_teams lt
    join public.person_team_role ptr
      on ptr.league_id = lt.league_id
     and ptr.team_name = lt.name
     and ptr.role = 'Player'
     and ptr.active = true
    join public.club_membership cm
      on cm.id = ptr.club_membership_id
     and cm.club_id = lt.club_id
     and cm.active = true
    join public.person p on p.id = cm.person_id and p.active = true
    union
    select distinct p.id as person_id, concat_ws(' ', p.first_name, p.last_name) as player_name, lt.name as team_name
    from lower_teams lt
    join public.team_membership tm
      on tm.team_id = lt.id
     and tm.role = 'Player'
     and tm.active = true
    join public.person p on p.id = tm.person_id and p.active = true
  ),
  played_up as (
    select person_id, min(played_for_team) as already_played_for_team
    from (
      select fls.player_1_id as person_id, picked_team.name as played_for_team
      from public.fixture_lineup_slot fls
      join public.fixture_lineup fl on fl.id = fls.lineup_id and fl.status = 'Published'
      join public.fixture f on f.id = fl.fixture_id
      join public.team picked_team on picked_team.id = fl.team_id
      join target on target.season_id = f.season_id
      where fls.player_1_id is not null
        and fls.player_1_is_guest = true
        and fl.team_id = target.id
        and ($2::uuid is null or f.id <> $2::uuid)
      union all
      select fls.player_2_id as person_id, picked_team.name as played_for_team
      from public.fixture_lineup_slot fls
      join public.fixture_lineup fl on fl.id = fls.lineup_id and fl.status = 'Published'
      join public.fixture f on f.id = fl.fixture_id
      join public.team picked_team on picked_team.id = fl.team_id
      join target on target.season_id = f.season_id
      where fls.player_2_id is not null
        and fls.player_2_is_guest = true
        and fl.team_id = target.id
        and ($2::uuid is null or f.id <> $2::uuid)
    ) used
    group by person_id
  )
  select cp.person_id, cp.player_name, cp.team_name, pu.already_played_for_team
  from candidate_players cp
  left join played_up pu on pu.person_id = cp.person_id
  order by cp.team_name, cp.player_name
`;

async function loadEligibleGuestPlayerAccess(client: PoolClient, teamId: string, fixtureId: string) {
  const result = await client.query<{ person_id: string; already_played_for_team: string | null }>(eligibleGuestPlayersSql, [teamId, fixtureId]);
  return {
    eligibleIds: new Set(result.rows.filter((row) => !row.already_played_for_team).map((row) => row.person_id)),
    blockedByTeam: new Map(result.rows.filter((row) => row.already_played_for_team).map((row) => [row.person_id, row.already_played_for_team ?? "another team"]))
  };
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

function normalizeSlots(
  slots: LineupSlotInput[],
  playerIds: Set<string>,
  guestPlayerIds: Set<string>,
  requireComplete: boolean,
  slotDefinitions: LineupSlotDefinition[],
  allowDuplicatePlayers = false,
  blockedGuestTeams = new Map<string, string>()
) {
  const normalized = slotDefinitions.map((slot) => {
    const input = slots.find((item) => Number(item.slotNumber) === slot.slotNumber);
    const player1Id = String(input?.player1Id ?? "").trim();
    const player2Id = String(input?.player2Id ?? "").trim();
    const player1GuestName = cleanGuestName(input?.player1GuestName);
    const player2GuestName = cleanGuestName(input?.player2GuestName);
    const player1IsGuest = Boolean(input?.player1IsGuest || player1GuestName);
    const player2IsGuest = Boolean(input?.player2IsGuest || player2GuestName);
    if (player1Id && !player1IsGuest && !playerIds.has(player1Id)) throw new Error(`${slot.label} player is not in this team.`);
    if (player2Id && !player2IsGuest && !playerIds.has(player2Id)) throw new Error(`${slot.label} doubles partner is not in this team.`);
    if (player1Id && player1IsGuest && blockedGuestTeams.has(player1Id)) throw new Error(`${slot.label} Guest Player already played for ${blockedGuestTeams.get(player1Id)} this season.`);
    if (player2Id && player2IsGuest && blockedGuestTeams.has(player2Id)) throw new Error(`${slot.label} doubles Guest Player already played for ${blockedGuestTeams.get(player2Id)} this season.`);
    if (player1Id && player1IsGuest && !guestPlayerIds.has(player1Id)) throw new Error(`${slot.label} Guest Player must be from a lower team in this club.`);
    if (player2Id && player2IsGuest && !guestPlayerIds.has(player2Id)) throw new Error(`${slot.label} doubles Guest Player must be from a lower team in this club.`);
    if (player1IsGuest && !player1Id && !player1GuestName) throw new Error(`${slot.label} Guest Player must be selected from a lower team or entered as a fallback name.`);
    if (player2IsGuest && !player2Id && !player2GuestName) throw new Error(`${slot.label} doubles Guest Player must be selected from a lower team or entered as a fallback name.`);
    if (player1Id && player2Id && player1Id === player2Id) throw new Error(`${slot.label} needs two different players.`);
    if (requireComplete && !player1Id && !player1GuestName) throw new Error(`${slot.label} needs a player before publishing.`);
    if (requireComplete && slot.gameType === "Doubles" && !player2Id && !player2GuestName) throw new Error("Doubles needs two players before publishing.");
    if (requireComplete && slot.gameType === "Singles" && (player2Id || player2GuestName)) throw new Error(`${slot.label} is a singles slot.`);
    return {
      slotNumber: slot.slotNumber,
      player1Id,
      player1GuestName,
      player1IsGuest,
      player1CountsForStats: !player1IsGuest,
      player2Id: slot.gameType === "Doubles" ? player2Id : "",
      player2GuestName: slot.gameType === "Doubles" ? player2GuestName : "",
      player2IsGuest: slot.gameType === "Doubles" ? player2IsGuest : false,
      player2CountsForStats: slot.gameType === "Doubles" ? !player2IsGuest : true
    };
  });
  if (!allowDuplicatePlayers) {
    const selectedIds = normalized.flatMap((slot) => [slot.player1Id, slot.player2Id].filter(Boolean));
    const duplicateId = selectedIds.find((playerId, index) => selectedIds.indexOf(playerId) !== index);
    if (duplicateId) {
      throw new Error("A player can only be selected once in a lineup.");
    }
  }
  return normalized;
}

function cleanGuestName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
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

async function loadFixtureLineupMeta(client: PoolClient, fixtureId: string) {
  const result = await client.query<{ league_name: string; fixture_type: "League" | "Friendly" }>(
    `select l.name as league_name, coalesce(f.fixture_type, 'League') as fixture_type
     from public.fixture f
     join public.league l on l.id = f.league_id
     where f.id = $1
     limit 1`,
    [fixtureId]
  );
  return {
    slotDefinitions: lineupSlotsForLeague(result.rows[0]?.league_name),
    fixtureType: result.rows[0]?.fixture_type ?? "League"
  };
}

async function generateGamesIfBothPublished(client: PoolClient, fixtureId: string, personId: string) {
  const fixtureResult = await client.query<{
    home_team_id: string;
    away_team_id: string;
    league_name: string;
  }>(
    `select f.home_team_id, f.away_team_id, l.name as league_name
     from public.fixture f
     join public.league l on l.id = f.league_id
     where f.id = $1
     for update`,
    [fixtureId]
  );
  const fixture = fixtureResult.rows[0];
  if (!fixture) throw new Error("Fixture not found.");
  const slotDefinitions = lineupSlotsForLeague(fixture.league_name);

  const lineupResult = await client.query<LineupRow>(lineupQuerySql, [fixtureId]);
  const home = buildLineup(lineupResult.rows.filter((row) => row.team_id === fixture.home_team_id), { fixture_id: fixtureId }, slotDefinitions);
  const away = buildLineup(lineupResult.rows.filter((row) => row.team_id === fixture.away_team_id), { fixture_id: fixtureId }, slotDefinitions);
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

  for (const slot of slotDefinitions) {
    const homeSlot = home.slots.find((item) => item.slotNumber === slot.slotNumber);
    const awaySlot = away.slots.find((item) => item.slotNumber === slot.slotNumber);
    await client.query(
      `insert into public.game (
         match_id, game_type, game_number, home_player_1_id, home_player_2_id,
         away_player_1_id, away_player_2_id,
         home_player_1_guest_name, home_player_2_guest_name,
         away_player_1_guest_name, away_player_2_guest_name,
         home_player_1_is_guest, home_player_2_is_guest,
         away_player_1_is_guest, away_player_2_is_guest,
         home_player_1_counts_for_stats, home_player_2_counts_for_stats,
         away_player_1_counts_for_stats, away_player_2_counts_for_stats,
         points_awarded
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       on conflict (match_id, game_number) do update
       set home_player_1_id = excluded.home_player_1_id,
           home_player_2_id = excluded.home_player_2_id,
           away_player_1_id = excluded.away_player_1_id,
           away_player_2_id = excluded.away_player_2_id,
           home_player_1_guest_name = excluded.home_player_1_guest_name,
           home_player_2_guest_name = excluded.home_player_2_guest_name,
           away_player_1_guest_name = excluded.away_player_1_guest_name,
           away_player_2_guest_name = excluded.away_player_2_guest_name,
           home_player_1_is_guest = excluded.home_player_1_is_guest,
           home_player_2_is_guest = excluded.home_player_2_is_guest,
           away_player_1_is_guest = excluded.away_player_1_is_guest,
           away_player_2_is_guest = excluded.away_player_2_is_guest,
           home_player_1_counts_for_stats = excluded.home_player_1_counts_for_stats,
           home_player_2_counts_for_stats = excluded.home_player_2_counts_for_stats,
           away_player_1_counts_for_stats = excluded.away_player_1_counts_for_stats,
           away_player_2_counts_for_stats = excluded.away_player_2_counts_for_stats,
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
        homeSlot?.player1GuestName || null,
        slot.gameType === "Doubles" ? homeSlot?.player2GuestName || null : null,
        awaySlot?.player1GuestName || null,
        slot.gameType === "Doubles" ? awaySlot?.player2GuestName || null : null,
        Boolean(homeSlot?.player1IsGuest),
        slot.gameType === "Doubles" ? Boolean(homeSlot?.player2IsGuest) : false,
        Boolean(awaySlot?.player1IsGuest),
        slot.gameType === "Doubles" ? Boolean(awaySlot?.player2IsGuest) : false,
        homeSlot?.player1CountsForStats ?? true,
        slot.gameType === "Doubles" ? homeSlot?.player2CountsForStats ?? true : true,
        awaySlot?.player1CountsForStats ?? true,
        slot.gameType === "Doubles" ? awaySlot?.player2CountsForStats ?? true : true,
        slot.gameType === "Doubles" ? 2 : 1
      ]
    );
  }
}

async function recordGameWinner(client: PoolClient, fixtureId: string, gameId: string, winnerTeamId: string | null) {
  const result = await client.query<{ match_id: string; home_team_id: string; away_team_id: string }>(
    `select m.id as match_id,
            f.home_team_id,
            f.away_team_id
     from public.match m
     join public.fixture f on f.id = m.fixture_id
     join public.game g on g.match_id = m.id
     where f.id = $1
       and g.id = $2
       and f.status <> 'Completed'
     limit 1`,
    [fixtureId, gameId]
  );
  const game = result.rows[0];
  if (!game) throw new Error("Game not found for this fixture.");
  if (winnerTeamId && winnerTeamId !== game.home_team_id && winnerTeamId !== game.away_team_id) {
    throw new Error("Winner must be one of the teams in this fixture.");
  }

  await client.query("update public.game set winner_team_id = $1 where id = $2", [winnerTeamId, gameId]);
  await client.query("select public.refresh_match_team_points($1)", [game.match_id]);
}

async function completeMatch(client: PoolClient, fixtureId: string) {
  const completion = await client.query<{ total_games: string; completed_games: string }>(
    `select
       count(g.id) as total_games,
       count(g.id) filter (where g.winner_team_id is not null) as completed_games
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     left join public.game g on g.match_id = m.id
     where f.id = $1
       and f.status <> 'Completed'`,
    [fixtureId]
  );
  const totalGames = Number(completion.rows[0]?.total_games ?? 0);
  const completedGames = Number(completion.rows[0]?.completed_games ?? 0);
  if (totalGames === 0 || completedGames !== totalGames) {
    throw new Error("All games must be scored before the match can be completed.");
  }
  await client.query(
    `update public.fixture
     set status = 'Completed'
     where id = $1
       and status <> 'Completed'`,
    [fixtureId]
  );
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
       and (
         ($3::uuid = g.home_player_1_id and coalesce(g.home_player_1_counts_for_stats, true))
         or ($3::uuid = g.home_player_2_id and coalesce(g.home_player_2_counts_for_stats, true))
         or ($3::uuid = g.away_player_1_id and coalesce(g.away_player_1_counts_for_stats, true))
         or ($3::uuid = g.away_player_2_id and coalesce(g.away_player_2_counts_for_stats, true))
       )
       and f.status <> 'Completed'
     limit 1`,
    [fixtureId, gameId, playerId]
  );
  if (!result.rowCount) throw new Error("Break player must be one of the stat-eligible players in this game.");

  await client.query(
    `insert into public.break (game_id, player_id, break_value, source_label)
     values ($1, $2, $3, 'live-match-entry')`,
    [gameId, playerId, breakValue]
  );
}
