import { setClubAdminGrant } from "@/lib/server/club-admin-grant";
import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function assertAdministrator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Administrator access is required.");
}

export async function POST(request: Request) {
  try {
    await assertAdministrator();
    const body = await request.json();
    const personId = String(body.personId ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();
    const clubId = String(body.clubId ?? "").trim();
    const role = String(body.role ?? "Player");
    const active = Boolean(body.active);
    const permissionType = String(body.permissionType ?? "team");

    if (permissionType === "admin") {
      if (!personId) {
        return NextResponse.json({ error: "Person is required." }, { status: 400 });
      }

      await dbQuery(
        `insert into public.app_operator (person_id, active)
         values ($1, $2)
         on conflict (person_id) do update
         set active = excluded.active`,
        [personId, active]
      );

      return NextResponse.json({ ok: true });
    }

    if (permissionType === "clubAdmin") {
      if (!personId || !clubId) {
        return NextResponse.json({ error: "Person and club are required." }, { status: 400 });
      }

      await withTransaction(client => setClubAdminGrant(client, clubId, personId, active));

      return NextResponse.json({ ok: true });
    }

    if (!personId || !teamId) {
      return NextResponse.json({ error: "Person and team are required." }, { status: 400 });
    }

    if (active && role === "Player") {
      const eligible = await dbQuery<{ eligible: boolean }>(
        `select public.is_golf_player($1::uuid, t.club_id) as eligible
         from public.team t where t.id = $2`,
        [personId, teamId]
      );
      if (!eligible.rows[0]?.eligible) {
        return NextResponse.json({ error: "Only registered golf players with a Golf Ireland number can receive a player role. Golf professionals and assistant professionals cannot be players." }, { status: 400 });
      }
    }

    await dbQuery(
      `with team_scope as (
         select club_id, league_id, name as team_name
         from public.team
         where id = $2
       ),
       club_member as (
         insert into public.club_membership (club_id, person_id, role, active)
         select club_id, $1, 'Club Member', true
         from team_scope
         on conflict (club_id, person_id, role) do update
         set active = true
         returning id, club_id
       )
       insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
       select cm.id, $1, ts.club_id, ts.league_id, ts.team_name, $3, $4
       from team_scope ts
       join club_member cm on cm.club_id = ts.club_id
       on conflict (club_membership_id, league_id, team_name, role) do update
       set active = excluded.active`,
      [personId, teamId, role, active]
    );

    await dbQuery(
      `insert into public.team_membership (person_id, team_id, role, active)
       values ($1, $2, $3, $4)
       on conflict (team_id, person_id, role) do update
       set active = excluded.active`,
      [personId, teamId, role, active]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save permission." },
      { status: 400 }
    );
  }
}
