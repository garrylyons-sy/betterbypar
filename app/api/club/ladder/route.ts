import { NextResponse } from "next/server";

import { canChallengePosition, canRechallenge, canRejectChallenge, rechallengeAvailableAt, resolveLadderResult } from "@/lib/club-ladder.mjs";
import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeChallengeStatuses = ["Pending", "Accepted", "Scheduled", "Result Pending", "Disputed"];

type LadderRow = {
  id: string;
  club_id: string;
  club_name: string;
  name: string;
  match_format: "1 Frame" | "Best of 3" | "Best of 5";
  challenge_range: number;
  response_hours: number;
  play_within_days: number;
  use_handicap: boolean;
  active: boolean;
  can_join: boolean;
};

async function clubAccess(personId: string, clubName: string) {
  const result = await dbQuery<{ id: string; is_operator: boolean; is_member: boolean }>(
    `select c.id::text,
            exists (select 1 from public.app_operator ao where ao.person_id = $1 and ao.active = true) as is_operator,
            (
              exists (select 1 from public.club_membership cm where cm.person_id = $1 and cm.club_id = c.id and cm.active = true)
              or exists (
                select 1 from public.team_membership tm
                join public.team t on t.id = tm.team_id and t.club_id = c.id and t.active = true
                where tm.person_id = $1 and tm.active = true
              )
              or exists (
                select 1 from public.person_team_role ptr
                where ptr.person_id = $1 and ptr.club_id = c.id and ptr.active = true
                  and ptr.role = 'Manager'
              )
            ) as is_member
     from public.club c
     where c.name = $2 and c.active = true
     limit 1`,
    [personId, clubName]
  );
  const row = result.rows[0];
  return row && (row.is_operator || row.is_member) ? row : null;
}

async function loadEligibleLadders(clubId: string, personId: string, isOperator: boolean) {
  return (await dbQuery<LadderRow>(
    `select cl.id::text, cl.club_id::text, c.name as club_name, cl.name, cl.match_format,
            cl.challenge_range, cl.response_hours, cl.play_within_days, cl.use_handicap, cl.active,
            (
              $3::boolean = true
              or not exists (select 1 from public.club_ladder_eligible_team eligibility where eligibility.ladder_id = cl.id)
              or exists (
                select 1 from public.club_ladder_eligible_team eligibility
                join public.team team on team.id = eligibility.team_id and team.active = true
                join public.person_team_role role on role.person_id = $2 and role.club_id = team.club_id
                  and role.league_id = team.league_id and role.team_name = team.name
                  and role.role in ('Player', 'Manager') and role.active = true
                where eligibility.ladder_id = cl.id
              )
              or exists (
                select 1 from public.club_ladder_eligible_team eligibility
                join public.team_membership membership on membership.team_id = eligibility.team_id
                  and membership.person_id = $2 and membership.role in ('Player', 'Manager') and membership.active = true
                where eligibility.ladder_id = cl.id
              )
            ) as can_join
     from public.club_ladder cl
     join public.club c on c.id = cl.club_id
     where cl.club_id = $1
       and (
         $3::boolean = true
         or not exists (select 1 from public.club_ladder_eligible_team eligibility where eligibility.ladder_id = cl.id)
         or exists (
           select 1
           from public.club_ladder_eligible_team eligibility
           join public.team team on team.id = eligibility.team_id and team.active = true
           join public.person_team_role role on role.person_id = $2 and role.club_id = team.club_id
             and role.league_id = team.league_id and role.team_name = team.name
             and role.role in ('Player', 'Manager') and role.active = true
           where eligibility.ladder_id = cl.id
         )
         or exists (
           select 1
           from public.club_ladder_eligible_team eligibility
           join public.team_membership membership on membership.team_id = eligibility.team_id
             and membership.person_id = $2 and membership.role in ('Player', 'Manager') and membership.active = true
           where eligibility.ladder_id = cl.id
         )
       )
     order by cl.created_at, lower(cl.name)`,
    [clubId, personId, isOperator]
  )).rows;
}

async function loadLadder(clubId: string, ladderId: string, personId: string, isOperator: boolean) {
  return (await dbQuery<LadderRow>(
    `select cl.id::text, cl.club_id::text, c.name as club_name, cl.name, cl.match_format,
            cl.challenge_range, cl.response_hours, cl.play_within_days, cl.use_handicap, cl.active,
            (
              $4::boolean = true
              or not exists (select 1 from public.club_ladder_eligible_team eligibility where eligibility.ladder_id = cl.id)
              or exists (
                select 1 from public.club_ladder_eligible_team eligibility
                join public.team team on team.id = eligibility.team_id and team.active = true
                join public.person_team_role role on role.person_id = $3 and role.club_id = team.club_id
                  and role.league_id = team.league_id and role.team_name = team.name
                  and role.role in ('Player', 'Manager') and role.active = true
                where eligibility.ladder_id = cl.id
              )
              or exists (
                select 1 from public.club_ladder_eligible_team eligibility
                join public.team_membership membership on membership.team_id = eligibility.team_id
                  and membership.person_id = $3 and membership.role in ('Player', 'Manager') and membership.active = true
                where eligibility.ladder_id = cl.id
              )
            ) as can_join
     from public.club_ladder cl
     join public.club c on c.id = cl.club_id
     where cl.id = $1 and cl.club_id = $2
       and (
         $4::boolean = true
         or not exists (select 1 from public.club_ladder_eligible_team eligibility where eligibility.ladder_id = cl.id)
         or exists (
           select 1 from public.club_ladder_eligible_team eligibility
           join public.team team on team.id = eligibility.team_id and team.active = true
           join public.person_team_role role on role.person_id = $3 and role.club_id = team.club_id
             and role.league_id = team.league_id and role.team_name = team.name
             and role.role in ('Player', 'Manager') and role.active = true
           where eligibility.ladder_id = cl.id
         )
         or exists (
           select 1 from public.club_ladder_eligible_team eligibility
           join public.team_membership membership on membership.team_id = eligibility.team_id
             and membership.person_id = $3 and membership.role in ('Player', 'Manager') and membership.active = true
           where eligibility.ladder_id = cl.id
         )
       )`,
    [ladderId, clubId, personId, isOperator]
  )).rows[0] ?? null;
}

function formatChallenge(row: Record<string, unknown>, personId: string) {
  const challengerPersonId = String(row.challenger_person_id);
  const challengedPersonId = String(row.challenged_person_id);
  return {
    id: String(row.id),
    status: String(row.status),
    challenger: { entryId: String(row.challenger_entry_id), personId: challengerPersonId, name: String(row.challenger_name), position: Number(row.challenger_position) },
    challenged: { entryId: String(row.challenged_entry_id), personId: challengedPersonId, name: String(row.challenged_name), position: Number(row.challenged_position) },
    responseDueAt: row.response_due_at,
    scheduledAt: row.scheduled_at,
    playBy: row.play_by,
    challengerScore: row.challenger_score === null ? null : Number(row.challenger_score),
    challengedScore: row.challenged_score === null ? null : Number(row.challenged_score),
    winnerEntryId: row.winner_entry_id,
    submittedByMe: String(row.result_submitted_by ?? "") === personId,
    isChallenger: challengerPersonId === personId,
    isChallenged: challengedPersonId === personId,
    canReject: Boolean(row.can_reject)
  };
}

function ladderActivityLabel(action: string, status: string) {
  if (action === "respond" && ["Accepted", "Scheduled"].includes(status)) return "Ladder challenge accepted";
  if (action === "respond" && status === "Rejected") return "Ladder challenge rejected";
  return ({
    challenge: "Ladder challenge made",
    submitResult: "Ladder result recorded",
    join: "Ladder joined",
    leave: "Ladder left",
    cancel: "Ladder challenge cancelled"
  } as Record<string, string>)[action] ?? `Ladder ${action}`;
}

async function expirePendingChallenges(ladderIds: string[]) {
  for (const ladderId of ladderIds) {
    await withTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`ladder:${ladderId}`]);
      const expiredChallenges = await client.query<{
        id: string;
        challenger_entry_id: string;
        challenged_entry_id: string;
        challenger_position: number;
        challenged_position: number;
        had_previous_rejection: boolean;
      }>(
        `select challenge.id::text, challenge.challenger_entry_id::text, challenge.challenged_entry_id::text,
                challenger.position as challenger_position, challenged.position as challenged_position,
                exists (
                  select 1 from public.club_ladder_challenge previous
                  where previous.ladder_id = challenge.ladder_id
                    and previous.challenger_entry_id = challenge.challenger_entry_id
                    and previous.challenged_entry_id = challenge.challenged_entry_id
                    and previous.status = 'Rejected'
                    and previous.id <> challenge.id
                ) as had_previous_rejection
         from public.club_ladder_challenge challenge
         join public.club_ladder_entry challenger on challenger.id = challenge.challenger_entry_id
         join public.club_ladder_entry challenged on challenged.id = challenge.challenged_entry_id
         where challenge.ladder_id = $1 and challenge.status = 'Pending' and challenge.response_due_at < now()
         for update of challenge, challenger, challenged`,
        [ladderId]
      );

      for (const expired of expiredChallenges.rows) {
        if (!expired.had_previous_rejection) {
          await client.query(
            "update public.club_ladder_challenge set status = 'Expired', updated_at = now() where id = $1",
            [expired.id]
          );
          continue;
        }

        await client.query("set constraints all deferred");
        await client.query(
          `update public.club_ladder_entry entry
           set position = case when entry.id = expired.challenger_entry_id
                               then expired.challenged_position else expired.challenger_position end,
               updated_at = now()
           from (
             select $1::uuid as challenger_entry_id, $2::uuid as challenged_entry_id,
                    $3::integer as challenger_position, $4::integer as challenged_position
           ) expired
           where entry.id in (expired.challenger_entry_id, expired.challenged_entry_id)`,
          [expired.challenger_entry_id, expired.challenged_entry_id, expired.challenger_position, expired.challenged_position]
        );
        await client.query(
          `update public.club_ladder_challenge expired
           set status = 'Walkover', winner_entry_id = expired.challenger_entry_id,
               completed_at = now(), updated_at = now()
           where expired.id = $1`,
          [expired.id]
        );
      }
    });
  }
}

export async function GET(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const clubName = new URL(request.url).searchParams.get("club")?.trim() ?? "";
    if (!clubName) return NextResponse.json({ error: "Club is required." }, { status: 400 });
    const access = await clubAccess(user.personId, clubName);
    if (!access) return NextResponse.json({ error: "Club membership is required." }, { status: 403 });
    const [ladders, configured] = await Promise.all([
      loadEligibleLadders(access.id, user.personId, access.is_operator),
      dbQuery("select 1 from public.club_ladder where club_id = $1 limit 1", [access.id])
    ]);
    if (!ladders.length) return NextResponse.json({ configured: Boolean(configured.rowCount), clubName, ladders: [] });

    await expirePendingChallenges(ladders.map((ladder) => ladder.id));

    const payloads = await Promise.all(ladders.map(async (ladder) => {
      const entries = await dbQuery<{
      id: string;
      person_id: string;
      position: number;
      starting_position: number;
      status: string;
      first_name: string;
      last_name: string;
      handicap: string | null;
      recent_form: string[] | null;
      latest_rejected_at: string | null;
      }>(
      `select cle.id::text, cle.person_id::text, cle.position, cle.starting_position, cle.status, p.first_name, p.last_name,
              membership.handicap::text, form.recent_form, rejection.latest_rejected_at
       from public.club_ladder_entry cle
       join public.person p on p.id = cle.person_id and p.active = true
       left join lateral (
         select cm.handicap
         from public.club_membership cm
         where cm.club_id = $2 and cm.person_id = cle.person_id and cm.active = true
           and cm.handicap is not null
         order by cm.joined_date desc, cm.id
         limit 1
       ) membership on true
       left join lateral (
         select jsonb_agg(recent.result order by recent.completed_at desc) as recent_form
         from (
           select case when challenge.winner_entry_id = cle.id then 'W' else 'L' end as result,
                  challenge.completed_at
           from public.club_ladder_challenge challenge
           where challenge.ladder_id = cle.ladder_id
             and challenge.status = 'Completed'
             and challenge.winner_entry_id is not null
             and (challenge.challenger_entry_id = cle.id or challenge.challenged_entry_id = cle.id)
           order by challenge.completed_at desc
           limit 3
         ) recent
       ) form on true
       left join lateral (
         select challenge.updated_at::text as latest_rejected_at
         from public.club_ladder_challenge challenge
         join public.club_ladder_entry challenger on challenger.id = challenge.challenger_entry_id
         where challenge.ladder_id = cle.ladder_id
           and challenge.challenged_entry_id = cle.id
           and challenger.person_id = $3
           and challenge.status = 'Rejected'
         order by challenge.updated_at desc
         limit 1
       ) rejection on true
       where cle.ladder_id = $1 and cle.status in ('Active', 'Paused')
       order by cle.position`,
      [ladder.id, ladder.club_id, user.personId]
      );
      const myEntry = entries.rows.find((row) => row.person_id === user.personId) ?? null;
      const challenges = myEntry ? await dbQuery<Record<string, unknown>>(
      `select chc.id::text, chc.status, chc.challenger_entry_id::text, chc.challenged_entry_id::text,
              chc.response_due_at::text, chc.scheduled_at::text, chc.play_by::text,
              chc.challenger_score, chc.challenged_score, chc.winner_entry_id::text,
              chc.result_submitted_by::text,
              challenger.person_id::text as challenger_person_id,
              concat(cp.first_name, ' ', cp.last_name) as challenger_name,
              challenger.position as challenger_position,
              challenged.person_id::text as challenged_person_id,
              concat(dp.first_name, ' ', dp.last_name) as challenged_name,
              challenged.position as challenged_position,
              (select count(*) = 0
                 from public.club_ladder_challenge previous
                where previous.ladder_id = chc.ladder_id
                  and previous.challenger_entry_id = chc.challenger_entry_id
                  and previous.challenged_entry_id = chc.challenged_entry_id
                  and previous.status = 'Rejected'
                  and previous.id <> chc.id) as can_reject
       from public.club_ladder_challenge chc
       join public.club_ladder_entry challenger on challenger.id = chc.challenger_entry_id
       join public.person cp on cp.id = challenger.person_id
       join public.club_ladder_entry challenged on challenged.id = chc.challenged_entry_id
       join public.person dp on dp.id = challenged.person_id
       where chc.ladder_id = $1
         and (chc.challenger_entry_id = $2 or chc.challenged_entry_id = $2)
       order by chc.created_at desc
       limit 20`,
      [ladder.id, myEntry.id]
      ) : { rows: [] };
      const hasActiveChallenge = challenges.rows.some((row) => activeChallengeStatuses.includes(String(row.status)));

      return {
        available: ladder.active,
        canJoin: ladder.can_join,
        ladder: {
          id: ladder.id, name: ladder.name, clubName: ladder.club_name, matchFormat: ladder.match_format,
          challengeRange: ladder.challenge_range, responseHours: ladder.response_hours,
          playWithinDays: ladder.play_within_days, useHandicap: ladder.use_handicap
        },
        me: myEntry ? { entryId: myEntry.id, personId: user.personId, position: myEntry.position, status: myEntry.status } : null,
        entries: entries.rows.map((row) => ({
          rechallengeAvailableAt: rechallengeAvailableAt(row.latest_rejected_at)?.toISOString() ?? null,
          id: row.id, personId: row.person_id, name: `${row.first_name} ${row.last_name}`.trim(),
          handicap: row.handicap === null ? null : Number(row.handicap),
          recentForm: Array.isArray(row.recent_form) ? row.recent_form : [], position: row.position,
          startingPosition: row.starting_position, status: row.status,
          canChallenge: Boolean(myEntry && !hasActiveChallenge && row.status === "Active"
            && canRechallenge(row.latest_rejected_at)
            && canChallengePosition(myEntry.position, row.position, ladder.challenge_range))
        })),
        challenges: challenges.rows.map((row) => formatChallenge(row, user.personId))
      };
    }));

    return NextResponse.json({ configured: true, clubName, ladders: payloads });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladder could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const clubName = String(body.club ?? "").trim();
    const action = String(body.action ?? "").trim();
    const ladderId = String(body.ladderId ?? "").trim();
    const access = await clubAccess(user.personId, clubName);
    if (!access) return NextResponse.json({ error: "Club membership is required." }, { status: 403 });
    const ladder = ladderId ? await loadLadder(access.id, ladderId, user.personId, access.is_operator) : null;
    if (!ladder || !ladder.active) return NextResponse.json({ error: "This club ladder is not currently available." }, { status: 409 });
    if (action === "join" && !ladder.can_join) {
      return NextResponse.json({ error: "An eligible player or manager team role is required to join this ladder." }, { status: 403 });
    }

    const result = await withTransaction(async (client) => {
      if (action === "join") {
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [`ladder:${ladder.id}`]);
        const existing = await client.query<{ id: string; status: string }>(
          `select id::text, status from public.club_ladder_entry
           where ladder_id = $1 and person_id = $2 for update`,
          [ladder.id, user.personId]
        );
        if (existing.rows[0]?.status === "Active") return { entryId: existing.rows[0].id };
        const nextActivePosition = await client.query<{ position: number }>(
          `select count(*)::integer + 1 as position
           from public.club_ladder_entry
           where ladder_id = $1 and status in ('Active', 'Paused')`,
          [ladder.id]
        );
        const position = nextActivePosition.rows[0].position;
        await client.query("set constraints all deferred");
        await client.query(
          `update public.club_ladder_entry
           set position = position + 1, updated_at = now()
           where ladder_id = $1 and position >= $2 and ($3::uuid is null or id <> $3::uuid)`,
          [ladder.id, position, existing.rows[0]?.id ?? null]
        );
        if (existing.rowCount) {
          await client.query(
            `update public.club_ladder_entry
             set status = 'Active', position = $2, starting_position = $2, joined_at = now(), updated_at = now()
             where id = $1`,
            [existing.rows[0].id, position]
          );
          return { entryId: existing.rows[0].id };
        }
        const saved = await client.query<{ id: string }>(
          `insert into public.club_ladder_entry (ladder_id, person_id, position, starting_position, status, updated_at)
           values ($1, $2, $3, $3, 'Active', now()) returning id::text`,
          [ladder.id, user.personId, position]
        );
        return { entryId: saved.rows[0].id };
      }

      const mine = await client.query<{ id: string; position: number; status: string }>(
        `select id::text, position, status from public.club_ladder_entry
         where ladder_id = $1 and person_id = $2 for update`,
        [ladder.id, user.personId]
      );
      if (!mine.rowCount || mine.rows[0].status !== "Active") throw new Error("Join the ladder before using challenges.");
      const myEntry = mine.rows[0];

      if (action === "leave") {
        const activeChallenge = await client.query(
          `select 1 from public.club_ladder_challenge
           where ladder_id = $1 and status = any($2::text[])
             and (challenger_entry_id = $3 or challenged_entry_id = $3)
           limit 1`,
          [ladder.id, activeChallengeStatuses, myEntry.id]
        );
        if (activeChallenge.rowCount) throw new Error("Finish or cancel your active challenge before leaving the ladder.");
        const lastPosition = await client.query<{ position: number }>(
          `select coalesce(max(position), $2)::integer as position
           from public.club_ladder_entry where ladder_id = $1`,
          [ladder.id, myEntry.position]
        );
        await client.query("set constraints all deferred");
        await client.query(
          `update public.club_ladder_entry
           set position = position - 1, updated_at = now()
           where ladder_id = $1 and position > $2`,
          [ladder.id, myEntry.position]
        );
        await client.query(
          `update public.club_ladder_entry
           set status = 'Withdrawn', position = $2, updated_at = now()
           where id = $1`,
          [myEntry.id, lastPosition.rows[0].position]
        );
        return { status: "Withdrawn" };
      }

      if (action === "challenge") {
        const challengedEntryId = String(body.challengedEntryId ?? "").trim();
        const target = await client.query<{ id: string; person_id: string; position: number; status: string }>(
          `select id::text, person_id::text, position, status from public.club_ladder_entry
           where id = $1 and ladder_id = $2 for update`,
          [challengedEntryId, ladder.id]
        );
        if (!target.rowCount || target.rows[0].status !== "Active") throw new Error("That player is not available to challenge.");
        if (!canChallengePosition(myEntry.position, target.rows[0].position, ladder.challenge_range)) {
          throw new Error(`You can challenge up to ${ladder.challenge_range} places above you.`);
        }
        const latestRejection = await client.query<{ updated_at: string }>(
          `select updated_at::text
           from public.club_ladder_challenge
           where ladder_id = $1 and challenger_entry_id = $2 and challenged_entry_id = $3
             and status = 'Rejected'
           order by updated_at desc
           limit 1`,
          [ladder.id, myEntry.id, target.rows[0].id]
        );
        if (!canRechallenge(latestRejection.rows[0]?.updated_at)) {
          throw new Error("You must wait seven days after a rejected challenge before challenging this player again.");
        }
        const busy = await client.query(
          `select 1 from public.club_ladder_challenge
           where ladder_id = $1 and status = any($2::text[])
             and (challenger_entry_id = any($3::uuid[]) or challenged_entry_id = any($3::uuid[]))
           limit 1`,
          [ladder.id, activeChallengeStatuses, [myEntry.id, target.rows[0].id]]
        );
        if (busy.rowCount) throw new Error("One of these players already has an active challenge.");
        const created = await client.query<{ id: string }>(
          `insert into public.club_ladder_challenge
             (ladder_id, challenger_entry_id, challenged_entry_id, response_due_at)
           values ($1, $2, $3, now() + ($4::text || ' hours')::interval)
           returning id::text`,
          [ladder.id, myEntry.id, target.rows[0].id, ladder.response_hours]
        );
        return { challengeId: created.rows[0].id, status: "Pending", opponentPersonId: target.rows[0].person_id };
      }

      const challengeId = String(body.challengeId ?? "").trim();
      const challenge = await client.query<{
        id: string;
        status: string;
        challenger_entry_id: string;
        challenged_entry_id: string;
        challenger_person_id: string;
        challenged_person_id: string;
        result_submitted_by: string | null;
        winner_entry_id: string | null;
      }>(
        `select chc.id::text, chc.status, chc.challenger_entry_id::text, chc.challenged_entry_id::text,
                challenger.person_id::text as challenger_person_id,
                challenged.person_id::text as challenged_person_id,
                chc.result_submitted_by::text, chc.winner_entry_id::text
         from public.club_ladder_challenge chc
         join public.club_ladder_entry challenger on challenger.id = chc.challenger_entry_id
         join public.club_ladder_entry challenged on challenged.id = chc.challenged_entry_id
         where chc.id = $1 and chc.ladder_id = $2 for update of chc`,
        [challengeId, ladder.id]
      );
      if (!challenge.rowCount) throw new Error("Challenge was not found.");
      const row = challenge.rows[0];
      const isChallenger = row.challenger_person_id === user.personId;
      const isChallenged = row.challenged_person_id === user.personId;
      if (!isChallenger && !isChallenged) throw new Error("This challenge does not belong to you.");

      if (action === "respond") {
        if (!isChallenged || row.status !== "Pending") throw new Error("This challenge cannot be answered.");
        const response = String(body.response ?? "");
        if (response === "reject") {
          const previous = await client.query<{ count: string }>(
            `select count(*)::text from public.club_ladder_challenge
             where ladder_id = $1 and challenger_entry_id = $2 and challenged_entry_id = $3
               and status = 'Rejected' and id <> $4`,
            [ladder.id, row.challenger_entry_id, row.challenged_entry_id, row.id]
          );
          if (!canRejectChallenge(Number(previous.rows[0].count))) {
            throw new Error("You have already rejected this player's challenge once. You must accept this challenge.");
          }
          await client.query(
            `update public.club_ladder_challenge set status = 'Rejected', rejection_number = 1, updated_at = now() where id = $1`,
            [row.id]
          );
          return { challengeId: row.id, status: "Rejected", opponentPersonId: row.challenger_person_id };
        }
        if (response !== "accept") throw new Error("Choose accept or reject.");
        const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
        if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())) throw new Error("Scheduled time must be in the future.");
        if (scheduledAt && scheduledAt.getTime() > Date.now() + ladder.play_within_days * 24 * 60 * 60 * 1000) {
          throw new Error("The match must be scheduled within the playing window.");
        }
        await client.query(
          `update public.club_ladder_challenge
           set status = case when $2::timestamptz is null then 'Accepted' else 'Scheduled' end,
               accepted_at = now(), scheduled_at = $2,
               play_by = now() + ($3::text || ' days')::interval,
               updated_at = now()
           where id = $1`,
          [row.id, scheduledAt?.toISOString() ?? null, ladder.play_within_days]
        );
        return { challengeId: row.id, status: scheduledAt ? "Scheduled" : "Accepted", opponentPersonId: row.challenger_person_id };
      }

      if (action === "schedule") {
        if (!["Accepted", "Scheduled"].includes(row.status)) throw new Error("This challenge cannot be scheduled.");
        const scheduledAt = new Date(String(body.scheduledAt ?? ""));
        if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) throw new Error("Scheduled time must be in the future.");
        const deadline = await client.query<{ play_by: string }>("select play_by::text from public.club_ladder_challenge where id = $1", [row.id]);
        if (deadline.rows[0]?.play_by && scheduledAt > new Date(deadline.rows[0].play_by)) throw new Error("The match must be scheduled within the playing window.");
        await client.query("update public.club_ladder_challenge set status = 'Scheduled', scheduled_at = $2, updated_at = now() where id = $1", [row.id, scheduledAt.toISOString()]);
        return { status: "Scheduled" };
      }

      if (action === "submitResult") {
        if (!["Accepted", "Scheduled", "Result Pending", "Disputed"].includes(row.status)) throw new Error("A result cannot be entered for this challenge.");
        const selectedWinner = body.winnerSide === undefined
          ? undefined
          : body.winnerSide === "challenger"
            ? "home"
            : body.winnerSide === "challenged"
              ? "away"
              : String(body.winnerSide);
        const result = resolveLadderResult(ladder.match_format, body.challengerScore as number | undefined, body.challengedScore as number | undefined, selectedWinner);
        const challengerScore = result.homeScore;
        const challengedScore = result.awayScore;
        const winnerEntryId = result.winner === "home" ? row.challenger_entry_id : row.challenged_entry_id;
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [`ladder:${ladder.id}`]);
        if (winnerEntryId === row.challenger_entry_id) {
          const positions = await client.query<{ id: string; position: number }>(
            `select id::text, position from public.club_ladder_entry
             where id = any($1::uuid[]) for update`,
            [[row.challenger_entry_id, row.challenged_entry_id]]
          );
          const challenger = positions.rows.find((entry) => entry.id === row.challenger_entry_id)!;
          const challenged = positions.rows.find((entry) => entry.id === row.challenged_entry_id)!;
          if (challenger.position > challenged.position) {
            await client.query("set constraints all deferred");
            await client.query(
              `update public.club_ladder_entry
               set position = position + 1, updated_at = now()
               where ladder_id = $1 and status <> 'Withdrawn'
                 and position >= $2 and position < $3 and id <> $4`,
              [ladder.id, challenged.position, challenger.position, challenger.id]
            );
            await client.query("update public.club_ladder_entry set position = $2, updated_at = now() where id = $1", [challenger.id, challenged.position]);
          }
        }
        await client.query(
          `update public.club_ladder_challenge
           set status = 'Completed', challenger_score = $2, challenged_score = $3,
               winner_entry_id = $4, result_submitted_by = $5, result_submitted_at = now(),
               completed_at = now(), updated_at = now()
           where id = $1`,
          [row.id, challengerScore, challengedScore, winnerEntryId, user.personId]
        );
        return { status: "Completed" };
      }

      if (action === "cancel" && isChallenger && row.status === "Pending") {
        await client.query("update public.club_ladder_challenge set status = 'Cancelled', updated_at = now() where id = $1", [row.id]);
        return { status: "Cancelled" };
      }

      throw new Error("Unsupported ladder action.");
    });

    const auditResult = result as Record<string, unknown>;
    const auditStatus = String(auditResult.status ?? "");
    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
       values ($1, 'Page Visit', '/club/ladder', $2,
         jsonb_build_object('club_name', $3::text, 'ladder_id', $4::text, 'action', $5::text,
           'challenge_id', $6::text, 'status', $7::text, 'opponent_person_id', $8::text))`,
      [
        user.personId,
        ladderActivityLabel(action, auditStatus),
        clubName,
        ladder.id,
        action,
        String(auditResult.challengeId ?? body.challengeId ?? "") || null,
        auditStatus || null,
        String(auditResult.opponentPersonId ?? "") || null
      ]
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladder action failed." }, { status: 400 });
  }
}
