import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function assertAdministrator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Administrator access is required.");
  return user;
}

export async function POST(request: NextRequest) {
  try {
    await assertAdministrator();
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const clubId = String(body.clubId ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();
    const role = String(body.role ?? "Player").trim();
    const handicapInput = String(body.handicap ?? "").trim();
    const handicap = handicapInput === "" ? null : Number(handicapInput);
    const admin = Boolean(body.admin);

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
    }
    const clubLevelRole = role === "Club Member" || role === "Club Admin";

    if (!clubLevelRole && !teamId) {
      return NextResponse.json({ error: "A team is required for player and manager roles." }, { status: 400 });
    }
    if (clubLevelRole && !clubId) {
      return NextResponse.json({ error: "A club is required for club roles." }, { status: 400 });
    }
    if (handicap !== null && (!Number.isFinite(handicap) || handicap < -200 || handicap > 200)) {
      return NextResponse.json({ error: "Handicap must be between -200 and 200, or left blank." }, { status: 400 });
    }

    const person = await withTransaction(async (client) => {
      let personResult = email
        ? await client.query(
            `select id
             from public.person
             where lower(email) = lower($1)
             limit 1`,
            [email]
          )
        : { rows: [] };

      if (!personResult.rows[0]) {
        personResult = await client.query(
          `insert into public.person (first_name, last_name, email, phone, active)
           values ($1, $2, $3, $4, true)
           returning id`,
          [firstName, lastName, email || null, phone || null]
        );
      } else {
        await client.query(
          `update public.person
           set first_name = $2,
               last_name = $3,
               phone = coalesce(nullif($4, ''), phone),
               active = true
           where id = $1`,
          [personResult.rows[0].id, firstName, lastName, phone]
        );
      }

      const personId = personResult.rows[0].id;
      if (clubLevelRole) {
        await client.query(
          `insert into public.club_membership (club_id, person_id, role, handicap, is_club_admin, active)
           values ($1, $2, 'Club Member', $3, $4, true)
           on conflict (club_id, person_id, role) do update
           set active = true,
               handicap = excluded.handicap,
               is_club_admin = public.club_membership.is_club_admin or excluded.is_club_admin`,
          [clubId, personId, handicap, role === "Club Admin"]
        );
        if (role === "Club Admin") {
          await client.query(
            `insert into public.club_admin (club_id, person_id, active)
             values ($1, $2, true)
             on conflict (club_id, person_id) do update set active = true`,
            [clubId, personId]
          );
        }
      } else {
        await client.query(
          `with team_scope as (
             select club_id, league_id, name as team_name
             from public.team
             where id = $1
           ),
           club_member as (
             insert into public.club_membership (club_id, person_id, role, handicap, active)
             select club_id, $2, 'Club Member', $4, true
             from team_scope
             on conflict (club_id, person_id, role) do update
             set active = true,
                 handicap = coalesce(excluded.handicap, public.club_membership.handicap)
             returning id, club_id
           )
           insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
           select cm.id, $2, ts.club_id, ts.league_id, ts.team_name, $3, true
           from team_scope ts
           join club_member cm on cm.club_id = ts.club_id
           on conflict (club_membership_id, league_id, team_name, role) do update set active = true`,
          [teamId, personId, role, handicap]
        );

        await client.query(
          `insert into public.team_membership (team_id, person_id, role, active)
           values ($1, $2, $3, true)
           on conflict (team_id, person_id, role) do update set active = true`,
          [teamId, personId, role]
        );
      }

      if (admin) {
        await client.query(
          `insert into public.app_operator (person_id, active)
           values ($1, true)
           on conflict (person_id) do update set active = true`,
          [personId]
        );
      }

      return { personId };
    });

    return NextResponse.json({ ok: true, person });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add person." },
      { status: 400 }
    );
  }
}
