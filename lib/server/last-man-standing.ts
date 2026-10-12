import type { PoolClient } from "pg";

import type { AppUser } from "./auth";
import {
  canEditPicks,
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
    } : null
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
