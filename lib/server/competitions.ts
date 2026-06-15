import { PoolClient } from "pg";

import type { AppUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export type CompetitionSummary = {
  id: string;
  clubId: string | null;
  clubName: string;
  name: string;
  competitionType: "Handicap" | "Scratch";
  entryClosesAt: string;
  rules: string;
  status: "Draft" | "Open" | "Drawn" | "In Progress" | "Complete";
  entrantCount: number;
  isEntered: boolean;
  canManage: boolean;
};

export type CompetitionDetail = CompetitionSummary & {
  rounds: Array<{
    id: string;
    roundNumber: number;
    name: string;
    framesToPlay: number;
    playByDate: string;
  }>;
  entries: Array<{
    id: string;
    clubMembershipId: string;
    personId: string;
    playerName: string;
    handicap: number | null;
    status: string;
  }>;
  matches: Array<{
    id: string;
    roundId: string;
    roundNumber: number;
    roundName: string;
    framesToPlay: number;
    playByDate: string;
    matchNumber: number;
    player1EntryId: string | null;
    player1Name: string;
    player1PersonId: string | null;
    player2EntryId: string | null;
    player2Name: string;
    player2PersonId: string | null;
    player1Score: number | null;
    player2Score: number | null;
    winnerEntryId: string | null;
    status: string;
    canReport: boolean;
  }>;
};

export async function isPlatformAdmin(personId: string) {
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [personId]
  );
  return Boolean(rowCount);
}

export async function clubMembershipsForPerson(personId: string) {
  const { rows } = await dbQuery<{ club_membership_id: string; club_id: string; club_name: string; handicap: string | null }>(
    `select cm.id as club_membership_id, c.id as club_id, c.name as club_name, cm.handicap::text
     from public.club_membership cm
     join public.club c on c.id = cm.club_id and c.active = true
     where cm.person_id = $1
       and cm.active = true
     order by c.name`,
    [personId]
  );
  return rows;
}

export async function clubAdminClubIds(personId: string) {
  const { rows } = await dbQuery<{ club_id: string }>(
    `select club_id
     from public.club_admin
     where person_id = $1
       and active = true`,
    [personId]
  );
  return new Set(rows.map((row) => row.club_id));
}

export async function canManageCompetition(user: AppUser, competitionId: string) {
  const platformAdmin = await isPlatformAdmin(user.personId);
  if (platformAdmin) return true;
  const { rowCount } = await dbQuery(
    `select 1
     from public.competition c
     join public.club_admin ca on ca.club_id = c.club_id and ca.active = true
     where c.id = $1
       and ca.person_id = $2
     limit 1`,
    [competitionId, user.personId]
  );
  return Boolean(rowCount);
}

export async function canManageClub(user: AppUser, clubId: string) {
  if (await isPlatformAdmin(user.personId)) return true;
  const { rowCount } = await dbQuery(
    `select 1
     from public.club_admin
     where club_id = $1
       and person_id = $2
       and active = true
     limit 1`,
    [clubId, user.personId]
  );
  return Boolean(rowCount);
}

export async function listCompetitions(user: AppUser): Promise<CompetitionSummary[]> {
  const memberships = await clubMembershipsForPerson(user.personId);
  const memberClubIds = memberships.map((membership) => membership.club_id);
  const adminClubIds = await clubAdminClubIds(user.personId);
  const platformAdmin = await isPlatformAdmin(user.personId);

  const { rows } = await dbQuery<{
    id: string;
    club_id: string | null;
    club_name: string | null;
    name: string;
    competition_type: "Handicap" | "Scratch";
    entry_closes_at: string;
    rules: string;
    status: CompetitionSummary["status"];
    entrant_count: string;
    is_entered: boolean;
  }>(
    `select
       c.id,
       c.club_id,
       coalesce(cl.name, 'Interclub') as club_name,
       c.name,
       c.competition_type,
       c.entry_closes_at::text,
       c.rules,
       c.status,
       count(ce.id)::text as entrant_count,
       bool_or(cm.person_id = $1 and ce.status = 'Entered') as is_entered
     from public.competition c
     left join public.club cl on cl.id = c.club_id
     left join public.competition_entry ce on ce.competition_id = c.id and ce.status = 'Entered'
     left join public.club_membership cm on cm.id = ce.club_membership_id
     where $2::boolean = true
        or c.managed_by_platform = true
        or c.club_id = any($3::uuid[])
     group by c.id, cl.name
     order by c.created_at desc`,
    [user.personId, platformAdmin, memberClubIds]
  );

  return rows.map((row) => ({
    id: row.id,
    clubId: row.club_id,
    clubName: row.club_name ?? "Interclub",
    name: row.name,
    competitionType: row.competition_type,
    entryClosesAt: row.entry_closes_at,
    rules: row.rules,
    status: row.status,
    entrantCount: Number(row.entrant_count ?? 0),
    isEntered: Boolean(row.is_entered),
    canManage: platformAdmin || Boolean(row.club_id && adminClubIds.has(row.club_id))
  }));
}

export async function loadCompetitionDetail(user: AppUser, competitionId: string): Promise<CompetitionDetail | null> {
  const summaries = await listCompetitions(user);
  const summary = summaries.find((competition) => competition.id === competitionId);
  if (!summary) return null;

  const [roundsResult, entriesResult, matchesResult] = await Promise.all([
    dbQuery<{
      id: string;
      round_number: number;
      name: string;
      frames_to_play: number;
      play_by_date: string;
    }>(
      `select id, round_number, name, frames_to_play, play_by_date::text
       from public.competition_round
       where competition_id = $1
       order by round_number`,
      [competitionId]
    ),
    dbQuery<{
      id: string;
      club_membership_id: string;
      person_id: string;
      player_name: string;
      handicap: string | null;
      status: string;
    }>(
      `select
         ce.id,
         ce.club_membership_id,
         cm.person_id,
         concat_ws(' ', p.first_name, p.last_name) as player_name,
         cm.handicap::text,
         ce.status
       from public.competition_entry ce
       join public.club_membership cm on cm.id = ce.club_membership_id
       join public.person p on p.id = cm.person_id
       where ce.competition_id = $1
       order by ce.entered_at, player_name`,
      [competitionId]
    ),
    dbQuery<{
      id: string;
      round_id: string;
      round_number: number;
      round_name: string;
      frames_to_play: number;
      play_by_date: string;
      match_number: number;
      player_1_entry_id: string | null;
      player_1_name: string | null;
      player_1_person_id: string | null;
      player_2_entry_id: string | null;
      player_2_name: string | null;
      player_2_person_id: string | null;
      player_1_score: number | null;
      player_2_score: number | null;
      winner_entry_id: string | null;
      status: string;
    }>(
      `select
         m.id,
         r.id as round_id,
         r.round_number,
         r.name as round_name,
         r.frames_to_play,
         r.play_by_date::text,
         m.match_number,
         m.player_1_entry_id,
         concat_ws(' ', p1.first_name, p1.last_name) as player_1_name,
         cm1.person_id as player_1_person_id,
         m.player_2_entry_id,
         concat_ws(' ', p2.first_name, p2.last_name) as player_2_name,
         cm2.person_id as player_2_person_id,
         m.player_1_score,
         m.player_2_score,
         m.winner_entry_id,
         m.status
       from public.competition_match m
       join public.competition_round r on r.id = m.competition_round_id
       left join public.competition_entry e1 on e1.id = m.player_1_entry_id
       left join public.club_membership cm1 on cm1.id = e1.club_membership_id
       left join public.person p1 on p1.id = cm1.person_id
       left join public.competition_entry e2 on e2.id = m.player_2_entry_id
       left join public.club_membership cm2 on cm2.id = e2.club_membership_id
       left join public.person p2 on p2.id = cm2.person_id
       where r.competition_id = $1
       order by r.round_number, m.match_number`,
      [competitionId]
    )
  ]);

  return {
    ...summary,
    rounds: roundsResult.rows.map((row) => ({
      id: row.id,
      roundNumber: row.round_number,
      name: row.name,
      framesToPlay: row.frames_to_play,
      playByDate: row.play_by_date
    })),
    entries: entriesResult.rows.map((row) => ({
      id: row.id,
      clubMembershipId: row.club_membership_id,
      personId: row.person_id,
      playerName: row.player_name,
      handicap: row.handicap === null ? null : Number(row.handicap),
      status: row.status
    })),
    matches: matchesResult.rows.map((row) => ({
      id: row.id,
      roundId: row.round_id,
      roundNumber: row.round_number,
      roundName: row.round_name,
      framesToPlay: row.frames_to_play,
      playByDate: row.play_by_date,
      matchNumber: row.match_number,
      player1EntryId: row.player_1_entry_id,
      player1Name: row.player_1_name ?? "Bye",
      player1PersonId: row.player_1_person_id,
      player2EntryId: row.player_2_entry_id,
      player2Name: row.player_2_name ?? "Bye",
      player2PersonId: row.player_2_person_id,
      player1Score: row.player_1_score,
      player2Score: row.player_2_score,
      winnerEntryId: row.winner_entry_id,
      status: row.status,
      canReport: summary.canManage || row.player_1_person_id === user.personId || row.player_2_person_id === user.personId
    }))
  };
}

export async function insertDefaultRounds(client: PoolClient, competitionId: string, rounds: Array<{ name: string; framesToPlay: number; playByDate: string }>) {
  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index];
    await client.query(
      `insert into public.competition_round (competition_id, round_number, name, frames_to_play, play_by_date)
       values ($1, $2, $3, $4, $5::date)
       on conflict (competition_id, round_number) do update
       set name = excluded.name,
           frames_to_play = excluded.frames_to_play,
           play_by_date = excluded.play_by_date`,
      [competitionId, index + 1, round.name, round.framesToPlay, round.playByDate]
    );
  }
}
