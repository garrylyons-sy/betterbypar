import type { PoolClient } from "pg";

import type { AppUser } from "./auth";
import {
  canEditPicks,
  deadlineForEntry,
  orderedFallbackCandidates,
  outcomeForPickedPlayer,
  resolveEntryTierOptions,
  validateManualPicks
} from "../last-man-standing-rules.mjs";

type AccessInput = {
  authenticated: boolean;
  hasLeagueChairAccess: boolean;
  audience: "League Chair" | "Everyone";
};

type CompetitionSummaryRow = {
  id: string;
  name: string;
  status: string;
  entrantCount: number | string;
  standingCount: number | string;
  entryId: string | null;
  entryStatus: string | null;
  roundId: string | null;
  roundName: string | null;
  cycleNumber: number | string | null;
  roundNumber: number | string | null;
  deadlineAt: string | null;
  pickOneName: string | null;
  pickTwoName: string | null;
};

type PresentedEntry = {
  id: string;
  personName: string;
  status: string;
  deadlineAt: string | null;
  picks: Array<{ slotNumber: number; playerName: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

type RoleRow = {
  role: "Player" | "Manager";
  league_name: string;
  team_id: string;
  team_name: string;
  active: boolean;
};

type EntryOption = {
  tier: "A" | "B" | "C";
  sourceRole: "Player" | "Manager";
  teamId: string;
  teamName: string;
};

export class LastManStandingError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "LAST_MAN_STANDING_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function participantAccessDecision(input: AccessInput) {
  if (!input.authenticated) {
    return { allowed: false, status: 401, error: "Sign in required." } as const;
  }
  if (!input.hasLeagueChairAccess) {
    return { allowed: false, status: 403, error: "League Chair access required." } as const;
  }
  return { allowed: true, status: 200, error: null } as const;
}

export function summarizeLastManStandingCompetitions(rows: CompetitionSummaryRow[]) {
  return rows.map((row) => {
    const currentRound = row.roundId
      ? {
          id: row.roundId,
          name: row.roundName,
          cycleNumber: Number(row.cycleNumber),
          roundNumber: Number(row.roundNumber),
          deadlineAt: row.deadlineAt
        }
      : null;
    const picks = [row.pickOneName, row.pickTwoName].filter((name): name is string => Boolean(name));
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      isEntered: Boolean(row.entryId),
      entryId: row.entryId,
      currentRound,
      panel: currentRound
        ? {
            roundLabel: `Cycle ${currentRound.cycleNumber} · Round ${currentRound.roundNumber}`,
            picks,
            entrantStatus: row.entryStatus,
            remainingLabel: `${Number(row.standingCount)} of ${Number(row.entrantCount)} standing`,
            deadlineAt: row.deadlineAt
          }
        : null
    };
  });
}

export function presentLastManStandingEntries(
  entries: PresentedEntry[],
  options: { viewerEntryId: string | null; now?: Date }
) {
  const now = options.now ?? new Date();
  return entries.map((entry) => {
    const ownsEntry = entry.id === options.viewerEntryId;
    const deadlinePassed = entry.deadlineAt ? now.getTime() >= new Date(entry.deadlineAt).getTime() : false;
    const showPicks = ownsEntry || deadlinePassed;
    return { ...entry, picks: showPicks ? entry.picks : [], picksHidden: !showPicks };
  });
}

export function deriveEntrySettlement(outcomes: string[]) {
  if (outcomes.length !== 2 || outcomes.some((outcome) => outcome === "Pending" || outcome === "No Eligible Pick")) {
    return { ready: false, status: null } as const;
  }
  return { ready: true, status: outcomes.includes("Lost") ? "Eliminated" : "Standing" } as const;
}

export function deriveRoundSettlement(
  entries: Array<{ entryId: string; status: "Standing" | "Eliminated" }>,
  options: { decidingRound: boolean }
) {
  const standingEntryIds = entries.filter((entry) => entry.status === "Standing").map((entry) => entry.entryId);
  if (options.decidingRound && standingEntryIds.length === 1) {
    return { state: "Winner", winnerEntryId: standingEntryIds[0] } as const;
  }
  if (options.decidingRound && standingEntryIds.length === 0) {
    return { state: "Restart", reinstateEntryIds: entries.map((entry) => entry.entryId) } as const;
  }
  return { state: "Continue", standingEntryIds } as const;
}

export async function hasLastManStandingPilotAccess(personId: string) {
  const { dbQuery } = await import("./db");
  const { rows } = await dbQuery<{ allowed: boolean }>(
    `select (
       exists (
         select 1 from public.club_membership
         where person_id = $1 and active = true and role = 'League Chair'
       )
       or exists (
         select 1 from public.app_operator
         where person_id = $1 and active = true
       )
     ) as allowed`,
    [personId]
  );
  return Boolean(rows[0]?.allowed);
}

async function requirePilotAccess(user: AppUser) {
  if (!await hasLastManStandingPilotAccess(user.personId)) {
    throw new LastManStandingError("League Chair access required.", 403, "FORBIDDEN");
  }
}

const summaryQuery = `
  select
    c.id::text,
    c.name,
    c.status,
    count(distinct all_entries.id)::int as "entrantCount",
    count(distinct all_entries.id) filter (where all_entries.status in ('Entered', 'Standing', 'Winner'))::int as "standingCount",
    own_entry.id::text as "entryId",
    own_entry.status as "entryStatus",
    current_round.id::text as "roundId",
    current_round.name as "roundName",
    current_round.cycle_number as "cycleNumber",
    current_round.round_number as "roundNumber",
    own_deadline.deadline_at::text as "deadlineAt",
    max(case when own_pick.slot_number = 1 then concat_ws(' ', pick_person.first_name, pick_person.last_name) end) as "pickOneName",
    max(case when own_pick.slot_number = 2 then concat_ws(' ', pick_person.first_name, pick_person.last_name) end) as "pickTwoName"
  from public.last_man_standing_competition c
  left join public.last_man_standing_entry all_entries on all_entries.competition_id = c.id and all_entries.status <> 'Withdrawn'
  left join public.last_man_standing_entry own_entry on own_entry.competition_id = c.id and own_entry.person_id = $1
  left join lateral (
    select r.*
    from public.last_man_standing_round r
    where r.competition_id = c.id and r.status in ('Open', 'Locked', 'Needs Review')
    order by r.cycle_number desc, r.round_number desc
    limit 1
  ) current_round on true
  left join public.last_man_standing_pick own_pick on own_pick.entry_id = own_entry.id and own_pick.round_id = current_round.id
  left join public.person pick_person on pick_person.id = coalesce(own_pick.effective_player_id, own_pick.selected_player_id)
  left join lateral (
    select max(p.deadline_at) as deadline_at
    from public.last_man_standing_pick p
    where p.entry_id = own_entry.id and p.round_id = current_round.id
  ) own_deadline on true
  where c.audience = 'League Chair'
    and c.status <> 'Archived'
  group by c.id, own_entry.id, current_round.id, own_deadline.deadline_at
  order by (c.status = 'Open') desc, c.created_at desc`;

export async function listLastManStandingCompetitions(user: AppUser) {
  await requirePilotAccess(user);
  await processDueLastManStandingWork({ actorPersonId: user.personId }).catch((error) => {
    console.error("last-man-standing:process-list", error);
  });
  const { dbQuery } = await import("./db");
  const result = await dbQuery<CompetitionSummaryRow>(summaryQuery, [user.personId]);
  return summarizeLastManStandingCompetitions(result.rows);
}

async function loadRoleOptions(client: Pick<PoolClient, "query">, user: AppUser, seasonId: string) {
  const result = await client.query<RoleRow>(
    `select ptr.role::text as role, l.name as league_name, t.id::text as team_id, t.name as team_name, ptr.active
     from public.person_team_role ptr
     join public.league l on l.id = ptr.league_id
     join public.team t on t.league_id = ptr.league_id
       and t.club_id = ptr.club_id
       and t.season_id = $2
       and lower(t.name) = lower(ptr.team_name)
       and t.active = true
     where ptr.person_id = $1 and ptr.active = true
     order by l.name, t.name`,
    [user.personId, seasonId]
  );
  return resolveEntryTierOptions(result.rows.map((row) => ({
    role: row.role,
    leagueName: row.league_name,
    teamId: row.team_id,
    teamName: row.team_name,
    active: row.active
  }))) as { options: EntryOption[]; defaultOption: EntryOption | null };
}

async function competitionRow(client: Pick<PoolClient, "query">, competitionId: string, lock = false) {
  const result = await client.query<{
    id: string;
    season_id: string;
    name: string;
    audience: "League Chair" | "Everyone";
    status: string;
    entry_opens_at: string;
    entry_closes_at: string;
  }>(
    `select id::text, season_id::text, name, audience, status, entry_opens_at::text, entry_closes_at::text
     from public.last_man_standing_competition where id = $1 ${lock ? "for update" : ""}`,
    [competitionId]
  );
  const row = result.rows[0];
  if (!row || row.audience !== "League Chair" || row.status === "Archived") {
    throw new LastManStandingError("Competition not found.", 404, "NOT_FOUND");
  }
  return row;
}

export async function loadLastManStandingCompetition(user: AppUser, competitionId: string) {
  await requirePilotAccess(user);
  await processDueLastManStandingWork({ competitionId, actorPersonId: user.personId }).catch((error) => {
    console.error("last-man-standing:process-detail", error);
  });
  const { dbQuery } = await import("./db");
  const queryClient = { query: dbQuery } as unknown as Pick<PoolClient, "query">;
  const competition = await competitionRow(queryClient, competitionId);
  const [roles, detail] = await Promise.all([
    loadRoleOptions(queryClient, user, competition.season_id),
    dbQuery<{
      entry_id: string | null;
      entry_status: string | null;
      tier: "A" | "B" | "C" | null;
      source_team_id: string | null;
      round_id: string | null;
      cycle_number: number | null;
      round_number: number | null;
      round_name: string | null;
      round_status: string | null;
    }>(
      `select e.id::text as entry_id, e.status as entry_status, e.tier, e.source_team_id::text,
              r.id::text as round_id, r.cycle_number, r.round_number, r.name as round_name, r.status as round_status
       from public.last_man_standing_competition c
       left join public.last_man_standing_entry e on e.competition_id = c.id and e.person_id = $2
       left join lateral (
         select * from public.last_man_standing_round
         where competition_id = c.id and status in ('Open', 'Locked', 'Needs Review')
         order by cycle_number desc, round_number desc limit 1
       ) r on true
       where c.id = $1`,
      [competitionId, user.personId]
    )
  ]);
  const row = detail.rows[0];
  const [candidateRows, pickRows, entryRows, historyRows] = row?.entry_id && row.round_id && row.tier
    ? await Promise.all([
        dbQuery<{
          id: string;
          name: string;
          team_name: string;
          used: boolean;
          has_fixture: boolean;
        }>(
          `select distinct p.id::text, concat_ws(' ', p.first_name, p.last_name) as name, ptr.team_name,
                  exists (
                    select 1 from public.last_man_standing_pick used_pick
                    join public.last_man_standing_round used_round on used_round.id = used_pick.round_id
                    where used_pick.entry_id = $1 and used_round.cycle_number = $5
                      and used_pick.round_id <> $2
                      and coalesce(used_pick.effective_player_id, used_pick.selected_player_id) = p.id
                  ) as used,
                  exists (
                    select 1 from public.last_man_standing_round_schedule rs
                    join public.fixture_week_match fwm on fwm.week_id = rs.fixture_week_id
                    join public.match m on m.id = fwm.match_id
                    join public.fixture f on f.id = m.fixture_id
                    join public.team lineup_team on lineup_team.id in (f.home_team_id, f.away_team_id)
                    where rs.round_id = $2 and rs.tier = $3
                      and lower(lineup_team.name) = lower(ptr.team_name)
                      and lineup_team.club_id = ptr.club_id
                  ) as has_fixture
           from public.person p
           join public.person_team_role ptr on ptr.person_id = p.id and ptr.active = true and ptr.role = 'Player'
           join public.league l on l.id = ptr.league_id
           where p.active = true
             and case when l.name = 'A League' then 'A' when l.name = 'B League' then 'B' else 'C' end = $3
             and exists (select 1 from public.team t where t.season_id = $4 and t.league_id = ptr.league_id and t.club_id = ptr.club_id and lower(t.name) = lower(ptr.team_name) and t.active = true)
           order by ptr.team_name, name`,
          [row.entry_id, row.round_id, row.tier, competition.season_id, row.cycle_number]
        ),
        dbQuery<{
          id: string;
          slot_number: number;
          player_id: string | null;
          player_name: string | null;
          state: string;
          automatic_reason: string | null;
          outcome: string;
          deadline_at: string | null;
          version: number;
        }>(
          `select p.id::text, p.slot_number,
                  coalesce(p.effective_player_id, p.selected_player_id)::text as player_id,
                  concat_ws(' ', person.first_name, person.last_name) as player_name,
                  p.state, p.automatic_reason, p.outcome, p.deadline_at::text, p.version
           from public.last_man_standing_pick p
           left join public.person person on person.id = coalesce(p.effective_player_id, p.selected_player_id)
           where p.entry_id = $1 and p.round_id = $2 order by p.slot_number`,
          [row.entry_id, row.round_id]
        ),
        dbQuery<{
          id: string;
          person_name: string;
          status: string;
          source_team_name: string;
          default_match_date: string;
          deadline_time: string;
          own_fixture_date: string | null;
          picks: Array<{ slotNumber: number; playerName: string; state: string; outcome: string }>;
        }>(
          `select e.id::text, concat_ws(' ', person.first_name, person.last_name) as person_name,
                  e.status, source_team.name as source_team_name,
                  rs.default_match_date::text, rs.deadline_time::text,
                  (select (f.fixture_date at time zone 'Europe/Dublin')::date::text
                   from public.fixture_week_match fwm
                   join public.match m on m.id = fwm.match_id
                   join public.fixture f on f.id = m.fixture_id
                   where fwm.week_id = rs.fixture_week_id and (f.home_team_id = e.source_team_id or f.away_team_id = e.source_team_id)
                   order by f.fixture_date limit 1) as own_fixture_date,
                  coalesce(jsonb_agg(jsonb_build_object(
                    'slotNumber', pick.slot_number,
                    'playerName', concat_ws(' ', picked.first_name, picked.last_name),
                    'state', pick.state,
                    'outcome', pick.outcome
                  ) order by pick.slot_number) filter (where pick.id is not null), '[]'::jsonb) as picks
           from public.last_man_standing_entry e
           join public.person person on person.id = e.person_id
           join public.team source_team on source_team.id = e.source_team_id
           join public.last_man_standing_round_schedule rs on rs.round_id = $2 and rs.tier = e.tier
           left join public.last_man_standing_pick pick on pick.entry_id = e.id and pick.round_id = $2
           left join public.person picked on picked.id = coalesce(pick.effective_player_id, pick.selected_player_id)
           where e.competition_id = $1 and e.status <> 'Withdrawn'
           group by e.id, person.id, source_team.id, rs.id order by e.status, person.last_name, person.first_name`,
          [competitionId, row.round_id]
        ),
        dbQuery<{
          round_name: string;
          round_number: number;
          slot_number: number;
          player_name: string;
          state: string;
          outcome: string;
          automatic_reason: string | null;
        }>(
          `select r.name as round_name, r.round_number, p.slot_number,
                  concat_ws(' ', person.first_name, person.last_name) as player_name,
                  p.state, p.outcome, p.automatic_reason
           from public.last_man_standing_pick p
           join public.last_man_standing_round r on r.id = p.round_id
           join public.person person on person.id = coalesce(p.effective_player_id, p.selected_player_id)
           where p.entry_id = $1 and p.round_id <> $2
           order by r.cycle_number desc, r.round_number desc, p.slot_number`,
          [row.entry_id, row.round_id]
        )
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }];
  const entries = presentLastManStandingEntries(entryRows.rows.map((entry) => ({
    id: entry.id,
    personName: entry.person_name,
    status: entry.status,
    sourceTeamName: entry.source_team_name,
    deadlineAt: deadlineForEntry({
      ownFixtureDate: entry.own_fixture_date,
      defaultMatchDate: entry.default_match_date,
      deadlineTime: entry.deadline_time.slice(0, 5)
    }).toISOString(),
    picks: entry.picks
  })), { viewerEntryId: row?.entry_id ?? null });
  return {
    competition: {
      id: competition.id,
      name: competition.name,
      status: competition.status,
      entryOpensAt: competition.entry_opens_at,
      entryClosesAt: competition.entry_closes_at
    },
    entryOptions: roles.options,
    defaultEntryOption: roles.defaultOption,
    entry: row?.entry_id ? {
      id: row.entry_id,
      status: row.entry_status,
      tier: row.tier,
      sourceTeamId: row.source_team_id
    } : null,
    currentRound: row?.round_id ? {
      id: row.round_id,
      name: row.round_name,
      cycleNumber: row.cycle_number,
      roundNumber: row.round_number,
      status: row.round_status
    } : null,
    candidates: candidateRows.rows.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      teamName: candidate.team_name,
      used: candidate.used,
      hasFixture: candidate.has_fixture
    })),
    picks: pickRows.rows.map((pick) => ({
      id: pick.id,
      slotNumber: Number(pick.slot_number),
      playerId: pick.player_id,
      playerName: pick.player_name,
      state: pick.state,
      automaticReason: pick.automatic_reason,
      outcome: pick.outcome,
      deadlineAt: pick.deadline_at,
      version: Number(pick.version)
    })),
    entries,
    history: historyRows.rows.map((pick) => ({
      roundName: pick.round_name,
      roundNumber: Number(pick.round_number),
      slotNumber: Number(pick.slot_number),
      playerName: pick.player_name,
      state: pick.state,
      outcome: pick.outcome,
      automaticReason: pick.automatic_reason
    }))
  };
}

export type EnterCompetitionInput = {
  competitionId: string;
  tier?: "A" | "B" | "C";
  sourceTeamId?: string;
};

export async function enterLastManStandingCompetition(user: AppUser, input: EnterCompetitionInput) {
  await requirePilotAccess(user);
  const { withTransaction } = await import("./db");
  return withTransaction(async (client) => {
    const competition = await competitionRow(client, input.competitionId, true);
    const now = new Date();
    if (competition.status !== "Open" || now < new Date(competition.entry_opens_at) || now >= new Date(competition.entry_closes_at)) {
      throw new LastManStandingError("Entries are not open for this competition.", 409, "ENTRY_CLOSED");
    }
    const roleOptions = await loadRoleOptions(client, user, competition.season_id);
    const chosen = roleOptions.options.find((option) => (
      (!input.tier || option.tier === input.tier)
      && (!input.sourceTeamId || option.teamId === input.sourceTeamId)
    )) ?? (!input.tier && !input.sourceTeamId ? roleOptions.defaultOption : null);
    if (!chosen) {
      throw new LastManStandingError("You do not have an eligible player or manager team role.", 400, "NO_ELIGIBLE_ROLE");
    }

    const duplicate = await client.query(
      "select 1 from public.last_man_standing_entry where competition_id = $1 and person_id = $2",
      [input.competitionId, user.personId]
    );
    if (duplicate.rowCount) {
      throw new LastManStandingError("You have already entered this competition.", 409, "ALREADY_ENTERED");
    }

    const result = await client.query<{ id: string; status: string }>(
      `insert into public.last_man_standing_entry (competition_id, person_id, source_role, tier, source_team_id)
       values ($1, $2, $3, $4, $5)
       returning id::text, status`,
      [input.competitionId, user.personId, chosen.sourceRole, chosen.tier, chosen.teamId]
    );
    await client.query(
      `insert into public.last_man_standing_event (competition_id, entry_id, actor_person_id, event_type, payload)
       values ($1, $2, $3, 'Entry Created', $4::jsonb)`,
      [input.competitionId, result.rows[0].id, user.personId, JSON.stringify({
        tier: chosen.tier,
        sourceRole: chosen.sourceRole,
        sourceTeamId: chosen.teamId
      })]
    );
    return { ...result.rows[0], tier: chosen.tier, sourceRole: chosen.sourceRole, sourceTeamId: chosen.teamId };
  });
}

export type SavePicksInput = {
  competitionId: string;
  roundId: string;
  playerIds: [string, string];
  versions?: [number | null, number | null];
  now?: Date;
};

export async function saveLastManStandingPicks(user: AppUser, input: SavePicksInput) {
  await requirePilotAccess(user);
  const { withTransaction } = await import("./db");
  return withTransaction(async (client) => {
    await competitionRow(client, input.competitionId, true);
    const entryResult = await client.query<{
      id: string;
      tier: "A" | "B" | "C";
      cycle_number: number;
      default_match_date: string;
      deadline_time: string;
      own_fixture_date: string | null;
    }>(
      `select e.id::text, e.tier, r.cycle_number,
              s.default_match_date::text, s.deadline_time::text,
              (select (f.fixture_date at time zone 'Europe/Dublin')::date::text
               from public.fixture_week_match fwm
               join public.match m on m.id = fwm.match_id
               join public.fixture f on f.id = m.fixture_id
               where fwm.week_id = s.fixture_week_id
                 and (f.home_team_id = e.source_team_id or f.away_team_id = e.source_team_id)
               order by f.fixture_date limit 1) as own_fixture_date
       from public.last_man_standing_entry e
       join public.last_man_standing_round r on r.id = $3 and r.competition_id = e.competition_id
       join public.last_man_standing_round_schedule s on s.round_id = r.id and s.tier = e.tier
       where e.competition_id = $1 and e.person_id = $2 and e.status in ('Entered', 'Standing')
       for update of e, r`,
      [input.competitionId, user.personId, input.roundId]
    );
    const entry = entryResult.rows[0];
    if (!entry) {
      throw new LastManStandingError("An active entry and round are required.", 409, "ENTRY_OR_ROUND_UNAVAILABLE");
    }

    const edit = canEditPicks({
      ownFixtureDate: entry.own_fixture_date,
      defaultMatchDate: entry.default_match_date,
      deadlineTime: entry.deadline_time.slice(0, 5),
      now: input.now ?? new Date()
    });
    if (!edit.allowed) throw new LastManStandingError(edit.message, 409, edit.code ?? "PICKS_LOCKED");

    const candidateResult = await client.query<{ id: string; active: boolean }>(
      `select distinct p.id::text, p.active
       from public.person p
       join public.person_team_role ptr on ptr.person_id = p.id and ptr.active = true and ptr.role = 'Player'
       join public.league l on l.id = ptr.league_id
       where p.id = any($1::uuid[])
         and case when l.name = 'A League' then 'A' when l.name = 'B League' then 'B' else 'C' end = $2`,
      [input.playerIds, entry.tier]
    );
    const consumedResult = await client.query<{ player_id: string }>(
      `select distinct coalesce(effective_player_id, selected_player_id)::text as player_id
       from public.last_man_standing_pick p
       join public.last_man_standing_round r on r.id = p.round_id
       where p.entry_id = $1 and r.cycle_number = $2 and p.round_id <> $3
         and coalesce(effective_player_id, selected_player_id) is not null`,
      [entry.id, entry.cycle_number, input.roundId]
    );
    const validation = validateManualPicks({
      playerIds: input.playerIds,
      candidates: candidateResult.rows.map((candidate) => ({
        ...candidate,
        registered: true,
        typedGuest: false,
        tier: entry.tier
      })),
      consumedPlayerIds: consumedResult.rows.map((row) => row.player_id),
      tier: entry.tier
    });
    if (!validation.valid) throw new LastManStandingError(validation.message, 400, validation.code ?? "INVALID_PICKS");

    const existing = await client.query<{
      id: string;
      slot_number: number;
      version: number;
      selected_player_id: string | null;
    }>(
      `select id::text, slot_number, version, selected_player_id::text
       from public.last_man_standing_pick
       where entry_id = $1 and round_id = $2
       order by slot_number for update`,
      [entry.id, input.roundId]
    );
    const currentBySlot = new Map(existing.rows.map((row) => [row.slot_number, row]));
    const saved = [];
    for (const slotNumber of [1, 2] as const) {
      const current = currentBySlot.get(slotNumber);
      const expectedVersion = input.versions?.[slotNumber - 1] ?? null;
      if (current && expectedVersion !== null && current.version !== expectedVersion) {
        throw new LastManStandingError("Your picks changed in another session. Refresh and try again.", 409, "VERSION_CONFLICT");
      }
      const playerId = input.playerIds[slotNumber - 1];
      const result = await client.query<{
        id: string;
        slot_number: number;
        selected_player_id: string;
        version: number;
      }>(
        `insert into public.last_man_standing_pick (
           entry_id, round_id, slot_number, selected_player_id, effective_player_id, state, deadline_at
         ) values ($1, $2, $3, $4, $4, 'Draft', $5)
         on conflict (entry_id, round_id, slot_number) do update set
           selected_player_id = excluded.selected_player_id,
           effective_player_id = excluded.effective_player_id,
           state = 'Draft', automatic_reason = null, outcome = 'Pending', deadline_at = excluded.deadline_at,
           version = public.last_man_standing_pick.version + 1, updated_at = now()
         returning id::text, slot_number, selected_player_id::text, version`,
        [entry.id, input.roundId, slotNumber, playerId, edit.deadline]
      );
      const pick = result.rows[0];
      await client.query(
        `insert into public.last_man_standing_event (competition_id, entry_id, round_id, pick_id, actor_person_id, event_type, payload)
         values ($1, $2, $3, $4, $5, 'Pick Saved', $6::jsonb)`,
        [input.competitionId, entry.id, input.roundId, pick.id, user.personId, JSON.stringify({
          slotNumber,
          previousPlayerId: current?.selected_player_id ?? null,
          selectedPlayerId: playerId,
          version: pick.version,
          deadlineAt: edit.deadline
        })]
      );
      saved.push({
        id: pick.id,
        slotNumber: pick.slot_number,
        playerId: pick.selected_player_id,
        version: pick.version,
        deadlineAt: edit.deadline
      });
    }
    return { entryId: entry.id, roundId: input.roundId, picks: saved };
  });
}

type ProcessInput = {
  competitionId?: string;
  actorPersonId?: string;
  now?: Date;
};

async function appendLastManStandingEvent(
  client: Pick<PoolClient, "query">,
  input: {
    competitionId: string;
    entryId?: string | null;
    roundId?: string | null;
    pickId?: string | null;
    actorPersonId?: string | null;
    eventType: string;
    payload?: Record<string, unknown>;
  }
) {
  await client.query(
    `insert into public.last_man_standing_event (
       competition_id, entry_id, round_id, pick_id, actor_person_id, event_type, payload
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.competitionId,
      input.entryId ?? null,
      input.roundId ?? null,
      input.pickId ?? null,
      input.actorPersonId ?? null,
      input.eventType,
      JSON.stringify(input.payload ?? {})
    ]
  );
}

async function ensureTeamOrderSnapshot(client: PoolClient, scheduleId: string, leagueId: string, seasonId: string) {
  const existing = await client.query<{ team_id: string; position: number }>(
    `select team_id::text, position
     from public.last_man_standing_team_order_snapshot
     where round_schedule_id = $1
     order by position`,
    [scheduleId]
  );
  if (existing.rows.length) return existing.rows.map((row) => ({ teamId: row.team_id, position: Number(row.position) }));

  const standings = await client.query<{ team_id: string; position: number }>(
    `select t.id::text as team_id,
            row_number() over (order by coalesce(ltv.position, 2147483647), lower(t.name), t.id)::int as position
     from public.team t
     left join public.league_table_view ltv on ltv.team_id = t.id and ltv.season_id = t.season_id and ltv.league_id = t.league_id
     where t.league_id = $1 and t.season_id = $2 and t.active = true
     order by position`,
    [leagueId, seasonId]
  );
  for (const row of standings.rows) {
    await client.query(
      `insert into public.last_man_standing_team_order_snapshot (round_schedule_id, team_id, position)
       values ($1, $2, $3) on conflict (round_schedule_id, team_id) do nothing`,
      [scheduleId, row.team_id, row.position]
    );
  }
  return standings.rows.map((row) => ({ teamId: row.team_id, position: Number(row.position) }));
}

async function fallbackData(client: PoolClient, schedule: {
  fixture_week_id: string;
  tier: "A" | "B" | "C";
}) {
  const fixtures = await client.query<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    status: string;
    rescheduled_outside_round: boolean;
  }>(
    `select f.id::text, f.home_team_id::text, f.away_team_id::text, f.status::text,
            ((f.fixture_date at time zone 'Europe/Dublin')::date
              not between fw.starts_on and fw.starts_on + 6) as rescheduled_outside_round
     from public.fixture_week_match fwm
     join public.fixture_week fw on fw.id = fwm.week_id
     join public.match m on m.id = fwm.match_id
     join public.fixture f on f.id = m.fixture_id
     where fwm.week_id = $1`,
    [schedule.fixture_week_id]
  );
  const lineupPlayers = await client.query<{
    player_id: string;
    team_id: string;
    fixture_id: string;
    lineup_slot_id: string;
    slot_number: number;
    player_order: number;
    active: boolean;
  }>(
    `select player.person_id::text as player_id, fl.team_id::text, fl.fixture_id::text,
            fls.id::text as lineup_slot_id, fls.slot_number, player.player_order, p.active
     from public.fixture_week_match fwm
     join public.match m on m.id = fwm.match_id
     join public.fixture_lineup fl on fl.fixture_id = m.fixture_id and fl.status = 'Published'
     join public.fixture_lineup_slot fls on fls.lineup_id = fl.id
     cross join lateral (values (fls.player_1_id, 1), (fls.player_2_id, 2)) player(person_id, player_order)
     join public.person p on p.id = player.person_id
     where fwm.week_id = $1 and player.person_id is not null`,
    [schedule.fixture_week_id]
  );
  return {
    fixtures: fixtures.rows.map((fixture) => ({
      id: fixture.id,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      status: fixture.status,
      rescheduledOutsideRound: fixture.rescheduled_outside_round
    })),
    lineupPlayers: lineupPlayers.rows.filter((player) => {
      const fixture = fixtures.rows.find((item) => item.id === player.fixture_id);
      return fixture && !fixture.rescheduled_outside_round && fixture.status !== "Cancelled";
    }).map((player) => ({
      playerId: player.player_id,
      teamId: player.team_id,
      fixtureId: player.fixture_id,
      lineupSlotId: player.lineup_slot_id,
      slotNumber: Number(player.slot_number),
      playerOrder: Number(player.player_order),
      active: player.active,
      registered: true,
      typedGuest: false,
      tier: schedule.tier
    }))
  };
}

export async function lockLastManStandingRound(input: ProcessInput & { competitionId: string; roundId: string }) {
  const { withTransaction } = await import("./db");
  return withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1), hashtext($2))", [input.competitionId, input.roundId]);
    const roundResult = await client.query<{
      id: string;
      competition_id: string;
      season_id: string;
      status: string;
    }>(
      `select r.id::text, r.competition_id::text, c.season_id::text, r.status
       from public.last_man_standing_round r
       join public.last_man_standing_competition c on c.id = r.competition_id
       where r.id = $1 and r.competition_id = $2 for update of r`,
      [input.roundId, input.competitionId]
    );
    const round = roundResult.rows[0];
    if (!round || round.status === "Settled") return { changed: false };

    const schedules = await client.query<{
      id: string;
      tier: "A" | "B" | "C";
      league_id: string;
      fixture_week_id: string;
      default_match_date: string;
      deadline_time: string;
    }>(
      `select id::text, tier, league_id::text, fixture_week_id::text,
              default_match_date::text, deadline_time::text
       from public.last_man_standing_round_schedule where round_id = $1`,
      [input.roundId]
    );
    let unresolved = false;
    let changed = false;
    for (const schedule of schedules.rows) {
      const teamOrder = await ensureTeamOrderSnapshot(client, schedule.id, schedule.league_id, round.season_id);
      const data = await fallbackData(client, schedule);
      const entries = await client.query<{
        id: string;
        source_team_id: string;
        own_fixture_date: string | null;
      }>(
        `select e.id::text, e.source_team_id::text,
                (select (f.fixture_date at time zone 'Europe/Dublin')::date::text
                 from public.fixture_week_match fwm
                 join public.match m on m.id = fwm.match_id
                 join public.fixture f on f.id = m.fixture_id
                 where fwm.week_id = $3 and (f.home_team_id = e.source_team_id or f.away_team_id = e.source_team_id)
                 order by f.fixture_date limit 1) as own_fixture_date
         from public.last_man_standing_entry e
         where e.competition_id = $1 and e.tier = $2 and e.status in ('Entered', 'Standing')
         order by e.entered_at for update`,
        [input.competitionId, schedule.tier, schedule.fixture_week_id]
      );
      for (const entry of entries.rows) {
        const deadline = deadlineForEntry({
          ownFixtureDate: entry.own_fixture_date,
          defaultMatchDate: schedule.default_match_date,
          deadlineTime: schedule.deadline_time.slice(0, 5)
        });
        if ((input.now ?? new Date()).getTime() < deadline.getTime()) continue;

        const picks = await client.query<{
          id: string;
          slot_number: number;
          selected_player_id: string | null;
          effective_player_id: string | null;
          state: string;
        }>(
          `select id::text, slot_number, selected_player_id::text, effective_player_id::text, state
           from public.last_man_standing_pick where entry_id = $1 and round_id = $2
           order by slot_number for update`,
          [entry.id, input.roundId]
        );
        const consumed = await client.query<{ player_id: string }>(
          `select distinct coalesce(p.effective_player_id, p.selected_player_id)::text as player_id
           from public.last_man_standing_pick p
           join public.last_man_standing_round r on r.id = p.round_id
           where p.entry_id = $1 and p.round_id <> $2
             and r.cycle_number = (select cycle_number from public.last_man_standing_round where id = $2)
             and coalesce(p.effective_player_id, p.selected_player_id) is not null`,
          [entry.id, input.roundId]
        );
        const used = consumed.rows.map((row) => row.player_id);
        const selectedThisRound: string[] = [];
        for (const slotNumber of [1, 2]) {
          const current = picks.rows.find((pick) => pick.slot_number === slotNumber);
          if (current?.state === "Locked" || current?.state === "Automatic" || current?.state === "Settled") {
            if (current.effective_player_id) selectedThisRound.push(current.effective_player_id);
            continue;
          }
          const manualPlayer = current?.selected_player_id ?? null;
          const manualLineup = manualPlayer
            ? data.lineupPlayers.find((player) => player.playerId === manualPlayer)
            : null;
          const candidates = orderedFallbackCandidates({
            sourceTeamId: entry.source_team_id,
            tier: schedule.tier,
            teamOrder,
            fixtures: data.fixtures,
            lineupPlayers: data.lineupPlayers,
            consumedPlayerIds: used,
            excludedPlayerIds: selectedThisRound
          });
          const chosen = manualLineup
            ? {
                playerId: manualPlayer,
                sourceTeamId: manualLineup.teamId,
                sourceFixtureId: manualLineup.fixtureId,
                sourceLineupSlotId: manualLineup.lineupSlotId,
                automaticReason: null
              }
            : candidates[0] ?? null;
          const state = chosen ? (chosen.automaticReason ? "Automatic" : "Locked") : "Needs Review";
          const automaticReason = chosen?.automaticReason ?? (manualPlayer ? null : "No eligible published lineup player was available");
          if (current?.state === "Needs Review" && !chosen) {
            unresolved = true;
            continue;
          }
          const saved = await client.query<{ id: string }>(
            `insert into public.last_man_standing_pick (
               entry_id, round_id, slot_number, selected_player_id, effective_player_id,
               source_fixture_id, source_lineup_slot_id, state, automatic_reason, deadline_at, locked_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
             on conflict (entry_id, round_id, slot_number) do update set
               effective_player_id = excluded.effective_player_id,
               source_fixture_id = excluded.source_fixture_id,
               source_lineup_slot_id = excluded.source_lineup_slot_id,
               state = excluded.state,
               automatic_reason = excluded.automatic_reason,
               deadline_at = excluded.deadline_at,
               locked_at = now(), version = public.last_man_standing_pick.version + 1, updated_at = now()
             returning id::text`,
            [entry.id, input.roundId, slotNumber, manualPlayer, chosen?.playerId ?? null,
              chosen?.sourceFixtureId ?? null, chosen?.sourceLineupSlotId ?? null, state,
              automaticReason, deadline.toISOString()]
          );
          await appendLastManStandingEvent(client, {
            competitionId: input.competitionId,
            entryId: entry.id,
            roundId: input.roundId,
            pickId: saved.rows[0].id,
            actorPersonId: input.actorPersonId,
            eventType: chosen ? (chosen.automaticReason ? "Automatic Pick" : "Pick Locked") : "Needs Review",
            payload: { slotNumber, selectedPlayerId: manualPlayer, effectivePlayerId: chosen?.playerId ?? null, automaticReason }
          });
          if (chosen) selectedThisRound.push(chosen.playerId);
          else unresolved = true;
          changed = true;
        }
      }
    }
    if (changed) {
      await client.query(
        `update public.last_man_standing_round
         set status = $2, locked_at = coalesce(locked_at, now()), updated_at = now()
         where id = $1`,
        [input.roundId, unresolved ? "Needs Review" : "Locked"]
      );
    }
    return { changed, unresolved };
  });
}

export async function settleLastManStandingRound(input: ProcessInput & { competitionId: string; roundId: string }) {
  const { withTransaction } = await import("./db");
  return withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1), hashtext($2))", [input.competitionId, input.roundId]);
    const roundResult = await client.query<{ deciding_round: boolean; status: string }>(
      `select deciding_round, status from public.last_man_standing_round
       where id = $1 and competition_id = $2 for update`,
      [input.roundId, input.competitionId]
    );
    const round = roundResult.rows[0];
    if (!round || round.status === "Settled" || round.status === "Open" || round.status === "Needs Review") {
      return { changed: false };
    }

    const picks = await client.query<{
      id: string;
      entry_id: string;
      effective_player_id: string | null;
      source_fixture_id: string | null;
      outcome: string;
    }>(
      `select id::text, entry_id::text, effective_player_id::text, source_fixture_id::text, outcome
       from public.last_man_standing_pick where round_id = $1 order by entry_id, slot_number for update`,
      [input.roundId]
    );
    const outcomes = new Map<string, string[]>();
    for (const pick of picks.rows) {
      if (!pick.effective_player_id) return { changed: false, pending: true };
      const gameResult = await client.query<{
        id: string;
        winner_team_id: string | null;
        home_team_id: string;
        away_team_id: string;
        home_player_1_id: string | null;
        home_player_2_id: string | null;
        away_player_1_id: string | null;
        away_player_2_id: string | null;
      }>(
        `select g.id::text, g.winner_team_id::text, f.home_team_id::text, f.away_team_id::text,
                g.home_player_1_id::text, g.home_player_2_id::text,
                g.away_player_1_id::text, g.away_player_2_id::text
         from public.game g
         join public.match m on m.id = g.match_id
         join public.fixture f on f.id = m.fixture_id
         where f.id = $1 and $2::uuid in (
           g.home_player_1_id, g.home_player_2_id, g.away_player_1_id, g.away_player_2_id
         ) limit 1`,
        [pick.source_fixture_id, pick.effective_player_id]
      );
      const game = gameResult.rows[0];
      const outcome = outcomeForPickedPlayer({
        playerId: pick.effective_player_id,
        game: game ? {
          winnerTeamId: game.winner_team_id,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          homePlayerIds: [game.home_player_1_id, game.home_player_2_id].filter(Boolean),
          awayPlayerIds: [game.away_player_1_id, game.away_player_2_id].filter(Boolean)
        } : null
      });
      if (outcome === "Pending") return { changed: false, pending: true };
      await client.query(
        `update public.last_man_standing_pick
         set source_game_id = $2, outcome = $3, state = 'Settled', settled_at = now(), updated_at = now()
         where id = $1`,
        [pick.id, game?.id ?? null, outcome]
      );
      await appendLastManStandingEvent(client, {
        competitionId: input.competitionId,
        entryId: pick.entry_id,
        roundId: input.roundId,
        pickId: pick.id,
        actorPersonId: input.actorPersonId,
        eventType: "Pick Settled",
        payload: { playerId: pick.effective_player_id, outcome, gameId: game?.id ?? null }
      });
      outcomes.set(pick.entry_id, [...(outcomes.get(pick.entry_id) ?? []), outcome]);
    }

    const entryStates: Array<{ entryId: string; status: "Standing" | "Eliminated" }> = [];
    for (const [entryId, pickOutcomes] of outcomes) {
      const decision = deriveEntrySettlement(pickOutcomes);
      if (!decision.ready) return { changed: false, pending: true };
      await client.query(
        `update public.last_man_standing_entry
         set status = $2, eliminated_round_id = case when $2 = 'Eliminated' then $3 else null end, updated_at = now()
         where id = $1`,
        [entryId, decision.status, input.roundId]
      );
      if (decision.status === "Eliminated") {
        await appendLastManStandingEvent(client, {
          competitionId: input.competitionId,
          entryId,
          roundId: input.roundId,
          actorPersonId: input.actorPersonId,
          eventType: "Entry Eliminated",
          payload: { outcomes: pickOutcomes }
        });
      }
      entryStates.push({ entryId, status: decision.status });
    }

    const roundDecision = deriveRoundSettlement(entryStates, { decidingRound: round.deciding_round });
    if (roundDecision.state === "Winner") {
      await client.query(
        `update public.last_man_standing_entry set status = 'Winner', winner = true, updated_at = now() where id = $1;
         update public.last_man_standing_competition set status = 'Complete', updated_at = now() where id = $2`,
        [roundDecision.winnerEntryId, input.competitionId]
      );
      await appendLastManStandingEvent(client, {
        competitionId: input.competitionId,
        entryId: roundDecision.winnerEntryId,
        roundId: input.roundId,
        actorPersonId: input.actorPersonId,
        eventType: "Winner Declared"
      });
    } else if (roundDecision.state === "Restart") {
      await client.query(
        `update public.last_man_standing_entry
         set status = 'Standing', winner = false, eliminated_round_id = null, updated_at = now()
         where competition_id = $1 and status <> 'Withdrawn';
         update public.last_man_standing_competition set status = 'No Winner', updated_at = now() where id = $1`,
        [input.competitionId]
      );
      await appendLastManStandingEvent(client, {
        competitionId: input.competitionId,
        roundId: input.roundId,
        actorPersonId: input.actorPersonId,
        eventType: "Entrants Reinstated",
        payload: { entryIds: roundDecision.reinstateEntryIds, nextCycleNumber: "admin-scheduled" }
      });
    }
    await client.query(
      `update public.last_man_standing_round set status = 'Settled', settled_at = now(), updated_at = now() where id = $1`,
      [input.roundId]
    );
    return { changed: true, decision: roundDecision };
  });
}

export async function reopenLastManStandingRound(input: {
  competitionId: string;
  roundId: string;
  actorPersonId: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new LastManStandingError("A reason is required to reopen a round.", 400, "REASON_REQUIRED");
  const { withTransaction } = await import("./db");
  return withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1), hashtext($2))", [input.competitionId, input.roundId]);
    const result = await client.query(
      `update public.last_man_standing_round
       set status = 'Locked', settled_at = null, updated_at = now()
       where id = $1 and competition_id = $2 and status = 'Settled'`,
      [input.roundId, input.competitionId]
    );
    if (!result.rowCount) throw new LastManStandingError("Only a settled round can be reopened.", 409, "ROUND_NOT_SETTLED");
    await client.query(
      `update public.last_man_standing_pick
       set state = case when automatic_reason is null then 'Locked' else 'Automatic' end,
           outcome = 'Pending', source_game_id = null, settled_at = null, updated_at = now()
       where round_id = $1;
       update public.last_man_standing_entry
       set status = 'Standing', winner = false, eliminated_round_id = null, updated_at = now()
       where competition_id = $2 and status <> 'Withdrawn';
       update public.last_man_standing_competition set status = 'In Progress', updated_at = now() where id = $2`,
      [input.roundId, input.competitionId]
    );
    await appendLastManStandingEvent(client, {
      competitionId: input.competitionId,
      roundId: input.roundId,
      actorPersonId: input.actorPersonId,
      eventType: "Round Reopened",
      payload: { reason: input.reason.trim() }
    });
    return { reopened: true };
  });
}

export async function processDueLastManStandingWork(input: ProcessInput = {}) {
  const { dbQuery } = await import("./db");
  const rounds = await dbQuery<{ id: string; competition_id: string; status: string }>(
    `select r.id::text, r.competition_id::text, r.status
     from public.last_man_standing_round r
     join public.last_man_standing_competition c on c.id = r.competition_id
     where r.status in ('Open', 'Locked', 'Needs Review')
       and c.status in ('Open', 'In Progress', 'No Winner')
       and ($1::uuid is null or c.id = $1::uuid)
     order by r.cycle_number, r.round_number`,
    [input.competitionId ?? null]
  );
  const results = [];
  for (const round of rounds.rows) {
    if (round.status === "Open" || round.status === "Needs Review") {
      results.push(await lockLastManStandingRound({ ...input, competitionId: round.competition_id, roundId: round.id }));
    }
    results.push(await settleLastManStandingRound({ ...input, competitionId: round.competition_id, roundId: round.id }));
  }
  return results;
}
