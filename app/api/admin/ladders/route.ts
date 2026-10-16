import { NextResponse } from "next/server";

import { normalizeLadderSettings } from "@/lib/club-ladder.mjs";
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

    const params = [access.platform, access.clubIds];
    const [clubs, ladders, eligibleTeams, teams, members] = await Promise.all([
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
        `select cm.club_id::text, p.id::text as person_id,
                concat_ws(' ', p.first_name, p.last_name) as person_name,
                max(cm.handicap)::text as handicap,
                coalesce(team_roles.team_ids, array[]::text[]) as team_ids
         from public.club_membership cm
         join public.person p on p.id = cm.person_id and p.active = true
         left join lateral (
           select array_agg(distinct roles.team_id::text) as team_ids
           from (
             select t.id as team_id
             from public.person_team_role ptr
             join public.team t on t.club_id = ptr.club_id and t.league_id = ptr.league_id
               and t.name = ptr.team_name and t.active = true
             join public.season s on s.id = t.season_id and s.active = true
             where ptr.person_id = cm.person_id and ptr.club_id = cm.club_id and ptr.active = true
             union
             select t.id
             from public.team_membership tm
             join public.team t on t.id = tm.team_id and t.club_id = cm.club_id and t.active = true
             join public.season s on s.id = t.season_id and s.active = true
             where tm.person_id = cm.person_id and tm.active = true
           ) roles
         ) team_roles on true
         where cm.active = true and ($1::boolean = true or cm.club_id = any($2::uuid[]))
         group by cm.club_id, p.id, team_roles.team_ids
         order by cm.club_id, lower(p.last_name), lower(p.first_name)`, params
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
          eligibleTeamIds: eligibleTeams.rows.filter((team) => team.ladder_id === ladder.ladder_id).map((team) => team.team_id)
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
    if (!clubId) throw new Error("Club is required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
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
          `select distinct cm.person_id::text
           from public.club_membership cm
           join public.person p on p.id = cm.person_id and p.active = true
           where cm.club_id = $1 and cm.active = true and cm.person_id = any($2::uuid[])
             and (
               cardinality($3::uuid[]) = 0
               or exists (
                 select 1 from public.person_team_role ptr
                 join public.team t on t.club_id = ptr.club_id and t.league_id = ptr.league_id
                   and t.name = ptr.team_name and t.active = true
                 where ptr.person_id = cm.person_id and ptr.club_id = cm.club_id and ptr.active = true
                   and t.id = any($3::uuid[])
               )
               or exists (
                 select 1 from public.team_membership tm
                 where tm.person_id = cm.person_id and tm.active = true and tm.team_id = any($3::uuid[])
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
               where role.person_id = entry.person_id and role.active = true and team.id = any($2::uuid[])
             )
             and not exists (
               select 1 from public.team_membership membership
               where membership.person_id = entry.person_id and membership.active = true
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
          `insert into public.club_ladder_entry (ladder_id, person_id, position, status, updated_at)
           select $1, selected.person_id, row_number() over (order by lower(p.last_name), lower(p.first_name)), 'Active', now()
           from unnest($2::uuid[]) as selected(person_id)
           join public.person p on p.id = selected.person_id
           order by lower(p.last_name), lower(p.first_name)`,
          [saved.rows[0].id, initialPersonIds]
        );
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder settings saved',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_id', $4::text,
             'match_format', $5::text, 'eligible_team_count', $6::int, 'initial_player_count', $7::int))`,
        [access.personId, clubId, club.rows[0].name, saved.rows[0].id, settings.matchFormat, eligibleTeamIds.length, ladderId ? 0 : initialPersonIds.length]
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
