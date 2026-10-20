import { expireLadderNotifications, expireTerminalLadderNotifications } from "@/lib/server/notifications";
import { NextResponse } from "next/server";

import { normalizeLadderInitialOrder, normalizeLadderSettings, resolveLadderResult } from "@/lib/club-ladder.mjs";
import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Access = { personId: string; platform: boolean; clubIds: string[] };

async function ladderAdminAccess(request: Request): Promise<Access | null> {
  const user = await currentUserFromRequest(request);
  if (!user) return null;
  const [operator, clubs] = await Promise.all([
    dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]),
    dbQuery<{ club_id: string }>(
      `select club_id from public.club_admin where person_id = $1 and active = true
       union
       select club_id from public.club_membership where person_id = $1 and active = true and is_club_admin = true`,
      [user.personId]
    )
  ]);
  return { personId: user.personId, platform: Boolean(operator.rowCount), clubIds: clubs.rows.map((row) => row.club_id) };
}

function stringIds(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map((id) => String(id).trim()).filter(Boolean))) : [];
}

export async function GET(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const search = new URL(request.url).searchParams;
    const ladderId = search.get("ladderId")?.trim() ?? "";
    const detail = search.get("detail")?.trim() ?? "";
    if (ladderId && (detail === "activeChallenges" || detail === "history")) {
      const allowed = await dbQuery(
        `select 1 from public.club_ladder
         where id = $1 and ($2::boolean = true or club_id = any($3::uuid[]))`,
        [ladderId, access.platform, access.clubIds]
      );
      if (!allowed.rowCount) return NextResponse.json({ error: "Club ladder was not found." }, { status: 404 });

      const statusClause = detail === "activeChallenges"
        ? "challenge.status = any(array['Pending','Accepted','Scheduled','Result Pending','Disputed']::text[])"
        : "challenge.status = any(array['Completed','Walkover']::text[])";
      const challenges = await dbQuery<{
        id: string; status: string; challenger_name: string; challenged_name: string;
        challenger_position: number; challenged_position: number; challenger_score: number | null;
        challenged_score: number | null; winner_name: string | null; response_due_at: string | null;
        scheduled_at: string | null; play_by: string | null; recorded_at: string | null;
      }>(
        `select challenge.id::text, challenge.status,
                concat_ws(' ', challenger_person.first_name, challenger_person.last_name) as challenger_name,
                concat_ws(' ', challenged_person.first_name, challenged_person.last_name) as challenged_name,
                challenger.position as challenger_position, challenged.position as challenged_position,
                challenge.challenger_score, challenge.challenged_score,
                case when winner.id = challenger.id
                     then concat_ws(' ', challenger_person.first_name, challenger_person.last_name)
                     when winner.id = challenged.id
                     then concat_ws(' ', challenged_person.first_name, challenged_person.last_name)
                     else null end as winner_name,
                challenge.response_due_at::text, challenge.scheduled_at::text, challenge.play_by::text,
                coalesce(challenge.result_submitted_at, challenge.completed_at)::text as recorded_at
         from public.club_ladder_challenge challenge
         join public.club_ladder_entry challenger on challenger.id = challenge.challenger_entry_id
         join public.person challenger_person on challenger_person.id = challenger.person_id
         join public.club_ladder_entry challenged on challenged.id = challenge.challenged_entry_id
         join public.person challenged_person on challenged_person.id = challenged.person_id
         left join public.club_ladder_entry winner on winner.id = challenge.winner_entry_id
         where challenge.ladder_id = $1 and ${statusClause}
         order by coalesce(challenge.completed_at, challenge.updated_at, challenge.created_at) desc`,
        [ladderId]
      );
      return NextResponse.json({
        challenges: challenges.rows.map((challenge) => ({
          id: challenge.id,
          status: challenge.status,
          challengerName: challenge.challenger_name,
          challengedName: challenge.challenged_name,
          challengerPosition: challenge.challenger_position,
          challengedPosition: challenge.challenged_position,
          challengerScore: challenge.challenger_score,
          challengedScore: challenge.challenged_score,
          winnerName: challenge.winner_name,
          responseDueAt: challenge.response_due_at,
          scheduledAt: challenge.scheduled_at,
          playBy: challenge.play_by,
          recordedAt: challenge.recorded_at
        }))
      });
    }

    const params = [access.platform, access.clubIds];
    const [clubs, ladders, eligibleTeams, teams, members, entries] = await Promise.all([
      dbQuery<{ club_id: string; club_name: string; logo_path: string | null; primary_color: string | null; accent_color: string | null }>(
        `select c.id::text as club_id, c.name as club_name, c.logo_path, c.primary_color, c.accent_color
         from public.club c
         where c.active = true and ($1::boolean = true or c.id = any($2::uuid[]))
         order by c.name`, params
      ),
      dbQuery<{
        club_id: string; ladder_id: string; ladder_name: string; match_format: "1 Frame" | "Best of 3" | "Best of 5";
        challenge_range: number; response_hours: number; play_within_days: number; use_handicap: boolean; active: boolean; entry_count: string;
      }>(
        `select cl.club_id::text, cl.id::text as ladder_id, cl.name as ladder_name, cl.match_format,
                cl.challenge_range, cl.response_hours, cl.play_within_days, cl.use_handicap, cl.active,
                count(cle.id) filter (where cle.status = 'Active')::text as entry_count
         from public.club_ladder cl
         left join public.club_ladder_entry cle on cle.ladder_id = cl.id
         where ($1::boolean = true or cl.club_id = any($2::uuid[]))
         group by cl.id
         order by cl.club_id, cl.created_at, lower(cl.name)`, params
      ),
      dbQuery<{ ladder_id: string; team_id: string }>(
        `select eligibility.ladder_id::text, eligibility.team_id::text
         from public.club_ladder_eligible_team eligibility
         join public.club_ladder ladder on ladder.id = eligibility.ladder_id
         where ($1::boolean = true or ladder.club_id = any($2::uuid[]))`, params
      ),
      dbQuery<{ club_id: string; team_id: string; team_name: string }>(
        `select t.club_id::text, t.id::text as team_id, t.name as team_name
         from public.team t
         join public.season s on s.id = t.season_id and s.active = true
         where t.active = true and ($1::boolean = true or t.club_id = any($2::uuid[]))
         order by t.club_id, t.name`, params
      ),
      dbQuery<{ club_id: string; person_id: string; person_name: string; handicap: string | null; team_ids: string[] | null }>(
        `select people.club_id::text, p.id::text as person_id,
                concat_ws(' ', p.first_name, p.last_name) as person_name,
                handicap.handicap,
                coalesce(team_roles.team_ids, array[]::text[]) as team_ids
         from (
           select cm.club_id, cm.person_id
           from public.club_membership cm
           where cm.active = true
           union
           select ptr.club_id, ptr.person_id
           from public.person_team_role ptr
           join public.team team on team.club_id = ptr.club_id and team.league_id = ptr.league_id
             and team.name = ptr.team_name and team.active = true
           join public.season season on season.id = team.season_id and season.active = true
           where ptr.active = true and ptr.role in ('Player', 'Manager')
           union
           select team.club_id, membership.person_id
           from public.team_membership membership
           join public.team team on team.id = membership.team_id and team.active = true
           join public.season season on season.id = team.season_id and season.active = true
           where membership.active = true and membership.role in ('Player', 'Manager')
         ) people
         join public.person p on p.id = people.person_id and p.active = true
         left join lateral (
           select max(cm.handicap)::text as handicap
           from public.club_membership cm
           where cm.club_id = people.club_id and cm.person_id = people.person_id and cm.active = true
         ) handicap on true
         left join lateral (
           select array_agg(distinct roles.team_id::text) as team_ids
           from (
             select t.id as team_id
             from public.person_team_role ptr
             join public.team t on t.club_id = ptr.club_id and t.league_id = ptr.league_id
               and t.name = ptr.team_name and t.active = true
             join public.season s on s.id = t.season_id and s.active = true
             where ptr.person_id = people.person_id and ptr.club_id = people.club_id
               and ptr.role in ('Player', 'Manager') and ptr.active = true
             union
             select t.id
             from public.team_membership tm
             join public.team t on t.id = tm.team_id and t.club_id = people.club_id and t.active = true
             join public.season s on s.id = t.season_id and s.active = true
             where tm.person_id = people.person_id and tm.role in ('Player', 'Manager') and tm.active = true
           ) roles
         ) team_roles on true
         where ($1::boolean = true or people.club_id = any($2::uuid[]))
         order by people.club_id, lower(p.last_name), lower(p.first_name)`, params
      ),
      dbQuery<{
        club_id: string; ladder_id: string; entry_id: string; person_id: string;
        person_name: string; position: number; status: "Active" | "Paused"; handicap: string | null;
      }>(
        `select ladder.club_id::text, entry.ladder_id::text, entry.id::text as entry_id,
                entry.person_id::text, concat_ws(' ', person.first_name, person.last_name) as person_name,
                entry.position, entry.status, membership.handicap
         from public.club_ladder_entry entry
         join public.club_ladder ladder on ladder.id = entry.ladder_id
         join public.person person on person.id = entry.person_id
         left join lateral (
           select max(cm.handicap)::text as handicap
           from public.club_membership cm
           where cm.club_id = ladder.club_id
             and cm.person_id = entry.person_id
             and cm.active = true
         ) membership on true
         where entry.status in ('Active', 'Paused')
           and ($1::boolean = true or ladder.club_id = any($2::uuid[]))
         order by ladder.club_id, entry.ladder_id, entry.position`, params
      )
    ]);

    return NextResponse.json({
      clubs: clubs.rows.map((club) => ({
        clubId: club.club_id,
        clubName: club.club_name,
        logoPath: club.logo_path,
        primaryColor: club.primary_color,
        accentColor: club.accent_color,
        teams: teams.rows.filter((team) => team.club_id === club.club_id).map((team) => ({ id: team.team_id, name: team.team_name })),
        ladders: ladders.rows.filter((ladder) => ladder.club_id === club.club_id).map((ladder) => ({
          id: ladder.ladder_id,
          name: ladder.ladder_name,
          matchFormat: ladder.match_format,
          challengeRange: ladder.challenge_range,
          responseHours: ladder.response_hours,
          playWithinDays: ladder.play_within_days,
          useHandicap: ladder.use_handicap,
          active: ladder.active,
          entryCount: Number(ladder.entry_count),
          eligibleTeamIds: eligibleTeams.rows.filter((team) => team.ladder_id === ladder.ladder_id).map((team) => team.team_id),
          entries: entries.rows.filter((entry) => entry.ladder_id === ladder.ladder_id).map((entry) => ({
            id: entry.entry_id,
            personId: entry.person_id,
            name: entry.person_name,
            position: entry.position,
            status: entry.status,
            handicap: entry.handicap === null ? null : Number(entry.handicap)
          }))
        })),
        members: members.rows.filter((member) => member.club_id === club.club_id).map((member) => ({
          personId: member.person_id,
          name: member.person_name,
          handicap: member.handicap === null ? null : Number(member.handicap),
          teamIds: member.team_ids ?? []
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladders could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const clubId = String(body.clubId ?? "").trim();
    const ladderId = String(body.ladderId ?? "").trim() || null;
    const eligibleTeamIds = stringIds(body.eligibleTeamIds);
    const initialPersonIds = stringIds(body.initialPersonIds);
    const initialOrder = normalizeLadderInitialOrder(body.initialOrder);
    if (!clubId) throw new Error("Club is required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
    }
    if (!ladderId && !initialPersonIds.length) {
      throw new Error("Select at least one player before creating a ladder.");
    }
    const settings = normalizeLadderSettings(body);

    const ladder = await withTransaction(async (client) => {
      const club = await client.query<{ name: string }>("select name from public.club where id = $1 and active = true", [clubId]);
      if (!club.rowCount) throw new Error("Club was not found.");
      if (ladderId) {
        const existing = await client.query("select 1 from public.club_ladder where id = $1 and club_id = $2 for update", [ladderId, clubId]);
        if (!existing.rowCount) throw new Error("Club ladder was not found.");
      }
      const duplicateName = await client.query(
        `select 1 from public.club_ladder where club_id = $1 and lower(name) = lower($2) and ($3::uuid is null or id <> $3::uuid)`,
        [clubId, settings.name, ladderId]
      );
      if (duplicateName.rowCount) throw new Error("This club already has a ladder with that name.");

      if (eligibleTeamIds.length) {
        const validTeams = await client.query(
          `select t.id from public.team t join public.season s on s.id = t.season_id and s.active = true
           where t.club_id = $1 and t.active = true and t.id = any($2::uuid[])`,
          [clubId, eligibleTeamIds]
        );
        if (validTeams.rowCount !== eligibleTeamIds.length) throw new Error("Every selected team must be an active team for this club.");
      }

      if (initialPersonIds.length) {
        const validMembers = await client.query<{ person_id: string }>(
          `select distinct person.id::text as person_id
           from public.person person
           where person.active = true and person.id = any($2::uuid[])
             and (
               exists (
                 select 1 from public.club_membership membership
                 where membership.person_id = person.id and membership.club_id = $1 and membership.active = true
               )
               or exists (
                 select 1 from public.person_team_role ptr
                 join public.team t on t.club_id = ptr.club_id and t.league_id = ptr.league_id
                   and t.name = ptr.team_name and t.active = true
                 where ptr.person_id = person.id and ptr.club_id = $1 and ptr.active = true
                   and ptr.role in ('Player', 'Manager')
                   and (cardinality($3::uuid[]) = 0 or t.id = any($3::uuid[]))
               )
               or exists (
                 select 1 from public.team_membership tm
                 join public.team t on t.id = tm.team_id and t.club_id = $1 and t.active = true
                 where tm.person_id = person.id and tm.role in ('Player', 'Manager')
                   and tm.active = true and (cardinality($3::uuid[]) = 0 or tm.team_id = any($3::uuid[]))
               )
             )
             and (
               cardinality($3::uuid[]) = 0
               or exists (
                 select 1 from public.person_team_role ptr
                 join public.team t on t.club_id = ptr.club_id and t.league_id = ptr.league_id
                   and t.name = ptr.team_name and t.active = true
                 where ptr.person_id = person.id and ptr.club_id = $1 and ptr.active = true
                   and ptr.role in ('Player', 'Manager') and t.id = any($3::uuid[])
               )
               or exists (
                 select 1 from public.team_membership tm
                 where tm.person_id = person.id and tm.role in ('Player', 'Manager')
                   and tm.active = true and tm.team_id = any($3::uuid[])
               )
             )`,
          [clubId, initialPersonIds, eligibleTeamIds]
        );
        if (validMembers.rowCount !== initialPersonIds.length) throw new Error("Every selected player must be eligible for this ladder.");
      }

      const saved = ladderId
        ? await client.query<{
            id: string; name: string; match_format: string; challenge_range: number; response_hours: number;
            play_within_days: number; use_handicap: boolean; active: boolean;
          }>(
            `update public.club_ladder set name = $3, match_format = $4, challenge_range = $5,
               response_hours = $6, play_within_days = $7, use_handicap = $8, active = $9, updated_at = now()
             where id = $1 and club_id = $2
             returning id::text, name, match_format, challenge_range, response_hours, play_within_days, use_handicap, active`,
            [ladderId, clubId, settings.name, settings.matchFormat, settings.challengeRange, settings.responseHours, settings.playWithinDays, settings.useHandicap, settings.active]
          )
        : await client.query<{
            id: string; name: string; match_format: string; challenge_range: number; response_hours: number;
            play_within_days: number; use_handicap: boolean; active: boolean;
          }>(
            `insert into public.club_ladder
               (club_id, name, match_format, challenge_range, response_hours, play_within_days, use_handicap, active, created_by, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
             returning id::text, name, match_format, challenge_range, response_hours, play_within_days, use_handicap, active`,
            [clubId, settings.name, settings.matchFormat, settings.challengeRange, settings.responseHours, settings.playWithinDays, settings.useHandicap, settings.active, access.personId]
          );

      await expireTerminalLadderNotifications(client, saved.rows[0].id);
      await client.query("delete from public.club_ladder_eligible_team where ladder_id = $1", [saved.rows[0].id]);
      if (eligibleTeamIds.length) {
        await client.query(
          `insert into public.club_ladder_eligible_team (ladder_id, team_id)
           select $1, team_id from unnest($2::uuid[]) as selected(team_id)`,
          [saved.rows[0].id, eligibleTeamIds]
        );

        const ineligibleEntries = await client.query<{ id: string }>(
          `select entry.id::text
           from public.club_ladder_entry entry
           where entry.ladder_id = $1 and entry.status in ('Active', 'Paused')
             and not exists (
               select 1
               from public.person_team_role role
               join public.team team on team.club_id = role.club_id and team.league_id = role.league_id
                 and team.name = role.team_name and team.active = true
               where role.person_id = entry.person_id and role.role in ('Player', 'Manager')
                 and role.active = true and team.id = any($2::uuid[])
             )
             and not exists (
               select 1 from public.team_membership membership
               where membership.person_id = entry.person_id and membership.role in ('Player', 'Manager') and membership.active = true
                 and membership.team_id = any($2::uuid[])
             )`,
          [saved.rows[0].id, eligibleTeamIds]
        );
        const ineligibleEntryIds = ineligibleEntries.rows.map((entry) => entry.id);
        if (ineligibleEntryIds.length) {
          await client.query(
            `update public.club_ladder_challenge
             set status = 'Cancelled', updated_at = now()
             where ladder_id = $1 and status in ('Pending', 'Accepted', 'Scheduled', 'Result Pending', 'Disputed')
               and (challenger_entry_id = any($2::uuid[]) or challenged_entry_id = any($2::uuid[]))`,
            [saved.rows[0].id, ineligibleEntryIds]
          );
          await expireTerminalLadderNotifications(client, saved.rows[0].id);
          await client.query("set constraints all deferred");
          await client.query(
            `update public.club_ladder_entry set status = 'Withdrawn', updated_at = now()
             where id = any($1::uuid[])`,
            [ineligibleEntryIds]
          );
          await client.query(
            `with ranked as (
               select id, row_number() over (
                 order by case when status in ('Active', 'Paused') then 0 else 1 end, position, joined_at, id
               ) as new_position
               from public.club_ladder_entry where ladder_id = $1
             )
             update public.club_ladder_entry entry
             set position = ranked.new_position, updated_at = now()
             from ranked where entry.id = ranked.id`,
            [saved.rows[0].id]
          );
        }
      }
      if (!ladderId && initialPersonIds.length) {
        await client.query(
          `with ordered as (
             select selected.person_id,
                    row_number() over (
                      order by case when $3::text = 'Random' then random() else null::double precision end,
                               lower(p.last_name), lower(p.first_name), p.id
                    )::integer as opening_position
             from unnest($2::uuid[]) as selected(person_id)
             join public.person p on p.id = selected.person_id
           )
           insert into public.club_ladder_entry
             (ladder_id, person_id, position, starting_position, status, updated_at)
           select $1, person_id, opening_position, opening_position, 'Active', now()
           from ordered order by opening_position`,
          [saved.rows[0].id, initialPersonIds, initialOrder]
        );
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder settings saved',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
             'match_format', $5::text, 'eligible_team_count', $6::int, 'initial_player_count', $7::int,
             'initial_order', $8::text))`,
        [access.personId, clubId, club.rows[0].name, saved.rows[0].id, settings.matchFormat, eligibleTeamIds.length, ladderId ? 0 : initialPersonIds.length, ladderId ? null : initialOrder]
      );
      return saved.rows[0];
    });

    return NextResponse.json({ ladder: {
      id: ladder.id, name: ladder.name, matchFormat: ladder.match_format, challengeRange: ladder.challenge_range,
      responseHours: ladder.response_hours, playWithinDays: ladder.play_within_days, useHandicap: ladder.use_handicap, active: ladder.active
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladder settings could not be saved." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "removePlayer");
    const clubId = String(body.clubId ?? "").trim();
    const ladderId = String(body.ladderId ?? "").trim();
    if (!clubId || !ladderId) throw new Error("Club and ladder are required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
    }

    if (action === "acceptChallenge" || action === "recordResult") {
      const challengeId = String(body.challengeId ?? "").trim();
      if (!challengeId) throw new Error("Challenge is required.");

      const result = await withTransaction(async (client) => {
        const challenge = await client.query<{
          id: string; status: string; challenger_entry_id: string; challenged_entry_id: string;
          challenger_name: string; challenged_name: string; ladder_name: string; club_name: string;
          match_format: "1 Frame" | "Best of 3" | "Best of 5"; play_within_days: number;
        }>(
          `select challenge.id::text, challenge.status,
                  challenge.challenger_entry_id::text, challenge.challenged_entry_id::text,
                  concat_ws(' ', challenger_person.first_name, challenger_person.last_name) as challenger_name,
                  concat_ws(' ', challenged_person.first_name, challenged_person.last_name) as challenged_name,
                  ladder.name as ladder_name, club.name as club_name,
                  ladder.match_format, ladder.play_within_days
           from public.club_ladder_challenge challenge
           join public.club_ladder ladder on ladder.id = challenge.ladder_id
           join public.club club on club.id = ladder.club_id
           join public.club_ladder_entry challenger on challenger.id = challenge.challenger_entry_id
           join public.person challenger_person on challenger_person.id = challenger.person_id
           join public.club_ladder_entry challenged on challenged.id = challenge.challenged_entry_id
           join public.person challenged_person on challenged_person.id = challenged.person_id
           where challenge.id = $1 and challenge.ladder_id = $2
             and ladder.club_id = $3
           for update of challenge, ladder`,
          [challengeId, ladderId, clubId]
        );
        if (!challenge.rowCount) throw new Error("Ladder challenge was not found.");
        const row = challenge.rows[0];

        if (action === "acceptChallenge") {
          if (row.status !== "Pending") throw new Error("Only a pending challenge can be accepted.");
          await client.query(
            `update public.club_ladder_challenge
             set status = 'Accepted', accepted_at = now(),
                 play_by = now() + ($2::text || ' days')::interval,
                 updated_at = now()
             where id = $1`,
            [row.id, row.play_within_days]
          );
          await client.query(
            `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
             values ($1, 'Page Visit', '/admin/ladders', 'Club ladder challenge accepted by administrator',
               jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
                 'ladder_name', $5::text, 'challenge_id', $6::text,
                 'challenger_name', $7::text, 'challenged_name', $8::text))`,
            [access.personId, clubId, row.club_name, ladderId, row.ladder_name, row.id, row.challenger_name, row.challenged_name]
          );
          await expireLadderNotifications(client, row.id);
          return { status: "Accepted" };
        }

        if (!["Accepted", "Scheduled", "Result Pending", "Disputed"].includes(row.status)) {
          throw new Error("A result cannot be entered for this challenge.");
        }
        const selectedWinner = body.winnerSide === undefined
          ? undefined
          : body.winnerSide === "challenger"
            ? "home"
            : body.winnerSide === "challenged"
              ? "away"
              : String(body.winnerSide);
        const validated = resolveLadderResult(row.match_format, body.challengerScore as number | undefined, body.challengedScore as number | undefined, selectedWinner);
        const challengerScore = validated.homeScore;
        const challengedScore = validated.awayScore;
        const winnerEntryId = validated.winner === "home" ? row.challenger_entry_id : row.challenged_entry_id;

        await client.query("select pg_advisory_xact_lock(hashtext($1))", [`ladder:${ladderId}`]);
        if (winnerEntryId === row.challenger_entry_id) {
          const positions = await client.query<{ id: string; position: number }>(
            `select id::text, position from public.club_ladder_entry
             where id = any($1::uuid[]) for update`,
            [[row.challenger_entry_id, row.challenged_entry_id]]
          );
          const challenger = positions.rows.find((entry) => entry.id === row.challenger_entry_id);
          const challenged = positions.rows.find((entry) => entry.id === row.challenged_entry_id);
          if (!challenger || !challenged) throw new Error("The ladder positions could not be found.");
          if (challenger.position > challenged.position) {
            await client.query("set constraints all deferred");
            await client.query(
              `update public.club_ladder_entry
               set position = position + 1, updated_at = now()
               where ladder_id = $1 and status <> 'Withdrawn'
                 and position >= $2 and position < $3 and id <> $4`,
              [ladderId, challenged.position, challenger.position, challenger.id]
            );
            await client.query(
              "update public.club_ladder_entry set position = $2, updated_at = now() where id = $1",
              [challenger.id, challenged.position]
            );
          }
        }
        await client.query(
          `update public.club_ladder_challenge
           set status = 'Completed', challenger_score = $2, challenged_score = $3,
               winner_entry_id = $4, result_submitted_by = $5, result_submitted_at = now(),
               completed_at = now(), updated_at = now()
           where id = $1`,
          [row.id, challengerScore, challengedScore, winnerEntryId, access.personId]
        );
        await client.query(
          `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
           values ($1, 'Page Visit', '/admin/ladders', 'Club ladder result recorded by administrator',
             jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
               'ladder_name', $5::text, 'challenge_id', $6::text,
               'challenger_name', $7::text, 'challenged_name', $8::text,
               'challenger_score', $9::int, 'challenged_score', $10::int))`,
          [access.personId, clubId, row.club_name, ladderId, row.ladder_name, row.id,
            row.challenger_name, row.challenged_name, challengerScore, challengedScore]
        );
        await expireLadderNotifications(client, row.id);
        return { status: "Completed" };
      });

      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "addPlayers") {
      const personIds = stringIds(body.personIds);
      if (!personIds.length) throw new Error("Select at least one player to add.");

      await withTransaction(async (client) => {
        const ladder = await client.query<{ name: string; club_name: string; eligible_team_ids: string[] }>(
          `select ladder.name, club.name as club_name,
                  array(
                    select eligibility.team_id
                    from public.club_ladder_eligible_team eligibility
                    where eligibility.ladder_id = ladder.id
                    order by eligibility.team_id
                  ) as eligible_team_ids
           from public.club_ladder ladder
           join public.club club on club.id = ladder.club_id
           where ladder.id = $1 and ladder.club_id = $2
           for update of ladder`,
          [ladderId, clubId]
        );
        if (!ladder.rowCount) throw new Error("Club ladder was not found.");
        const eligibleTeamIds = ladder.rows[0].eligible_team_ids;

        const validMembers = await client.query<{ person_id: string }>(
          `select distinct person.id::text as person_id
           from public.person person
           where person.active = true and person.id = any($2::uuid[])
             and (
               exists (
                 select 1 from public.club_membership membership
                 where membership.person_id = person.id and membership.club_id = $1 and membership.active = true
               )
               or exists (
                 select 1 from public.person_team_role role
                 join public.team team on team.club_id = role.club_id and team.league_id = role.league_id
                   and team.name = role.team_name and team.active = true
                 where role.person_id = person.id and role.club_id = $1
                   and role.role in ('Player', 'Manager') and role.active = true
                   and (cardinality($3::uuid[]) = 0 or team.id = any($3::uuid[]))
               )
               or exists (
                 select 1 from public.team_membership team_membership
                 join public.team team on team.id = team_membership.team_id and team.club_id = $1 and team.active = true
                 where team_membership.person_id = person.id and team_membership.role in ('Player', 'Manager')
                   and team_membership.active = true
                   and (cardinality($3::uuid[]) = 0 or team_membership.team_id = any($3::uuid[]))
               )
             )
             and (
               cardinality($3::uuid[]) = 0
               or exists (
                 select 1 from public.person_team_role role
                 join public.team team on team.club_id = role.club_id and team.league_id = role.league_id
                   and team.name = role.team_name and team.active = true
                 where role.person_id = person.id and role.club_id = $1
                   and role.role in ('Player', 'Manager') and role.active = true and team.id = any($3::uuid[])
               )
               or exists (
                 select 1 from public.team_membership team_membership
                 where team_membership.person_id = person.id and team_membership.role in ('Player', 'Manager')
                   and team_membership.active = true and team_membership.team_id = any($3::uuid[])
               )
             )`,
          [clubId, personIds, eligibleTeamIds]
        );
        if (validMembers.rowCount !== personIds.length) throw new Error("Every selected player must be eligible for this ladder.");

        const currentEntries = await client.query(
          `select 1 from public.club_ladder_entry
           where ladder_id = $1 and person_id = any($2::uuid[]) and status in ('Active', 'Paused')
           limit 1`,
          [ladderId, personIds]
        );
        if (currentEntries.rowCount) throw new Error("One or more selected players are already in this ladder.");

        await client.query("set constraints all deferred");
        await client.query(
          `insert into public.club_ladder_entry (ladder_id, person_id, position, starting_position, status, joined_at, updated_at)
           select $1, selected.person_id,
                  coalesce((select max(position) from public.club_ladder_entry where ladder_id = $1), 0) + selected.selection_order::integer,
                  coalesce((select max(position) from public.club_ladder_entry where ladder_id = $1), 0) + selected.selection_order::integer,
                  'Active', now(), now()
           from unnest($2::uuid[]) with ordinality as selected(person_id, selection_order)
           join public.person person on person.id = selected.person_id and person.active = true
           on conflict (ladder_id, person_id) do update
             set status = 'Active', joined_at = now(), updated_at = now()`,
          [ladderId, personIds]
        );
        await client.query(
          `with ranked as (
             select id, row_number() over (
               order by case
                          when person_id = any($2::uuid[]) then 1
                          when status in ('Active', 'Paused') then 0
                          else 2
                        end,
                        case when person_id = any($2::uuid[]) then array_position($2::uuid[], person_id) end,
                        position, joined_at, id
             ) as new_position
             from public.club_ladder_entry
             where ladder_id = $1
           )
           update public.club_ladder_entry entry
           set position = ranked.new_position, updated_at = now()
           from ranked where entry.id = ranked.id`,
          [ladderId, personIds]
        );
        await client.query(
          `update public.club_ladder_entry
           set starting_position = position, updated_at = now()
           where ladder_id = $1 and person_id = any($2::uuid[])`,
          [ladderId, personIds]
        );
        await client.query(
          `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
           values ($1, 'Page Visit', '/admin/ladders', 'Club ladder players added',
             jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
               'ladder_name', $5::text, 'player_count', $6::int, 'person_ids', to_jsonb($7::uuid[])))`,
          [access.personId, clubId, ladder.rows[0].club_name, ladderId, ladder.rows[0].name, personIds.length, personIds]
        );
      });

      return NextResponse.json({ ok: true, addedCount: personIds.length });
    }

    const entryId = String(body.entryId ?? "").trim();
    if (!entryId) throw new Error("Player is required.");

    await withTransaction(async (client) => {
      const ladder = await client.query<{ name: string; club_name: string }>(
        `select ladder.name, club.name as club_name
         from public.club_ladder ladder
         join public.club club on club.id = ladder.club_id
         where ladder.id = $1 and ladder.club_id = $2
         for update of ladder`,
        [ladderId, clubId]
      );
      if (!ladder.rowCount) throw new Error("Club ladder was not found.");

      const entry = await client.query<{ person_name: string; status: string }>(
        `select concat_ws(' ', person.first_name, person.last_name) as person_name, entry.status
         from public.club_ladder_entry entry
         join public.person person on person.id = entry.person_id
         where entry.id = $1 and entry.ladder_id = $2
         for update of entry`,
        [entryId, ladderId]
      );
      if (!entry.rowCount || !["Active", "Paused"].includes(entry.rows[0].status)) {
        throw new Error("This player is not currently in the ladder.");
      }

      await client.query(
        `update public.club_ladder_challenge
         set status = 'Cancelled', updated_at = now()
         where ladder_id = $1 and status in ('Pending', 'Accepted', 'Scheduled', 'Result Pending', 'Disputed')
           and (challenger_entry_id = $2 or challenged_entry_id = $2)`,
        [ladderId, entryId]
      );
      await expireTerminalLadderNotifications(client, ladderId);
      await client.query("set constraints all deferred");
      await client.query(
        `update public.club_ladder_entry
         set status = 'Withdrawn', updated_at = now()
         where id = $1 and ladder_id = $2`,
        [entryId, ladderId]
      );
      await client.query(
        `with ranked as (
           select id, row_number() over (
             order by case when status in ('Active', 'Paused') then 0 else 1 end, position, joined_at, id
           ) as new_position
           from public.club_ladder_entry
           where ladder_id = $1
         )
         update public.club_ladder_entry entry
         set position = ranked.new_position, updated_at = now()
         from ranked
         where entry.id = ranked.id`,
        [ladderId]
      );
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder player removed',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
             'ladder_name', $5::text, 'entry_id', $6::text, 'player_name', $7::text))`,
        [access.personId, clubId, ladder.rows[0].club_name, ladderId, ladder.rows[0].name, entryId, entry.rows[0].person_name]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Player could not be removed from the ladder." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const clubId = String(body.clubId ?? "").trim();
    const ladderId = String(body.ladderId ?? "").trim();
    if (!clubId || !ladderId) throw new Error("Club and ladder are required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
    }

    await withTransaction(async (client) => {
      const ladder = await client.query<{ id: string; name: string; club_name: string }>(
        `select cl.id::text, cl.name, c.name as club_name
         from public.club_ladder cl join public.club c on c.id = cl.club_id
         where cl.id = $1 and cl.club_id = $2 for update of cl`, [ladderId, clubId]
      );
      if (!ladder.rowCount) throw new Error("Club ladder was not found.");
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder deleted',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_name', $4::text))`,
        [access.personId, clubId, ladder.rows[0].club_name, ladder.rows[0].name]
      );
      await client.query("delete from public.club_ladder where id = $1", [ladderId]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Club ladder could not be deleted." }, { status: 400 });
  }
}
