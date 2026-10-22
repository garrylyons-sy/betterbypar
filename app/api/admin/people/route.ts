import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

type SubmittedTeamRole = {
  role: "Player" | "Manager";
  teamId: string;
};

type ExistingRoleMatch = {
  id: string;
  first_name: string;
  last_name: string;
};

async function adminAccess() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const [operatorResult, clubAdminResult] = await Promise.all([
    dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]),
    dbQuery<{ club_id: string }>(
      `select club_id
       from public.club_admin
       where person_id = $1
         and active = true
       union
       select club_id
       from public.club_membership
       where person_id = $1
         and active = true
         and is_club_admin = true`,
      [user.personId]
    )
  ]);
  const platformAdmin = Boolean(operatorResult.rowCount);
  const clubAdminClubIds = clubAdminResult.rows.map((row) => row.club_id);
  if (!platformAdmin && !clubAdminClubIds.length) throw new Error("Administrator access is required.");
  return { user, platformAdmin, clubAdminClubIds };
}

function assertPlatformAdmin(access: Awaited<ReturnType<typeof adminAccess>>) {
  if (!access.platformAdmin) throw new Error("Platform administrator access is required.");
}

function assertClubScope(access: Awaited<ReturnType<typeof adminAccess>>, clubId: string) {
  if (access.platformAdmin) return;
  if (!access.clubAdminClubIds.includes(clubId)) throw new Error("Club administrator access is required for this club.");
}

export async function POST(request: NextRequest) {
  try {
    const access = await adminAccess();
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
    const clubLevelRole = role === "Club Member" || role === "Club Admin" || role === "League Chair";

    if (!clubLevelRole && !teamId) {
      return NextResponse.json({ error: "A team is required for player and manager roles." }, { status: 400 });
    }
    if (clubLevelRole && !clubId) {
      return NextResponse.json({ error: "A club is required for club roles." }, { status: 400 });
    }
    if (admin) assertPlatformAdmin(access);
    if (handicap !== null && (!Number.isFinite(handicap) || handicap < -200 || handicap > 200)) {
      return NextResponse.json({ error: "Handicap must be between -200 and 200, or left blank." }, { status: 400 });
    }

    const person = await withTransaction(async (client) => {
      const scopedClubId = clubLevelRole
        ? clubId
        : (await client.query<{ club_id: string }>("select club_id from public.team where id = $1 limit 1", [teamId])).rows[0]?.club_id;
      if (!scopedClubId) throw new Error("Club was not found.");
      assertClubScope(access, scopedClubId);

      if (clubLevelRole) {
        const existingRole = await client.query<ExistingRoleMatch>(
          `select p.id, p.first_name, p.last_name
           from public.person p
           join public.club_membership cm
             on cm.person_id = p.id
            and cm.club_id = $3
            and cm.role = $4
            and cm.active = true
           where p.active = true
             and lower(trim(p.first_name)) = lower(trim($1::text))
             and lower(trim(p.last_name)) = lower(trim($2::text))
           limit 1`,
          [firstName, lastName, scopedClubId, role === "League Chair" ? "League Chair" : "Club Member"]
        );
        if (existingRole.rows[0]) {
          throw new Error(`${firstName} ${lastName} already has club access for this club. Open their existing person record to edit roles or details.`);
        }
      } else {
        const existingRole = await client.query<ExistingRoleMatch & { team_name: string }>(
          `select p.id, p.first_name, p.last_name, t.name as team_name
           from public.person p
           join public.team_membership tm
             on tm.person_id = p.id
            and tm.team_id = $3
            and tm.role = $4::public.membership_role
            and tm.active = true
           join public.team t on t.id = tm.team_id
           where p.active = true
             and lower(trim(p.first_name)) = lower(trim($1::text))
             and lower(trim(p.last_name)) = lower(trim($2::text))
           limit 1`,
          [firstName, lastName, teamId, role]
        );
        if (existingRole.rows[0]) {
          throw new Error(`${firstName} ${lastName} is already a ${role.toLowerCase()} for ${existingRole.rows[0].team_name}. Open their existing person record to edit roles or details.`);
        }
      }

      let personResult: { rows: Array<{ id: string }> } = email
        ? await client.query(
            `select id
             from public.person
             where lower(email) = lower($1)
             limit 1`,
            [email]
          )
        : { rows: [] };

      if (!personResult.rows[0]) {
        const nameMatches = await client.query<{ id: string }>(
          `select distinct p.id
           from public.person p
           join public.club_membership cm
             on cm.person_id = p.id
            and cm.club_id = $3
            and cm.active = true
           where p.active = true
             and lower(trim(p.first_name)) = lower(trim($1::text))
             and lower(trim(p.last_name)) = lower(trim($2::text))
           limit 2`,
          [firstName, lastName, scopedClubId]
        );
        if (nameMatches.rows.length > 1) {
          throw new Error(`${firstName} ${lastName} already exists more than once for this club. Add or edit them using an email address so the right person is updated.`);
        }
        if (nameMatches.rows[0]) {
          personResult = { rows: [{ id: nameMatches.rows[0].id }] };
        }
      }

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
           values ($1, $2, $3, $4, $5, true)
           on conflict (club_id, person_id, role) do update
           set active = true,
               handicap = excluded.handicap,
               is_club_admin = public.club_membership.is_club_admin or excluded.is_club_admin`,
          [clubId, personId, role === "League Chair" ? "League Chair" : "Club Member", handicap, role === "Club Admin"]
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

export async function PATCH(request: NextRequest) {
  try {
    const access = await adminAccess();
    const user = access.user;
    const body = await request.json();
    const action = String(body.action ?? "login").trim();
    const personId = String(body.personId ?? "").trim();

    if (!personId) {
      return NextResponse.json({ error: "Person is required." }, { status: 400 });
    }

    if (action === "details") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const emailInput = String(body.email ?? "").trim().toLowerCase();
      const phoneInput = String(body.phone ?? "").trim();
      const handicapInput = String(body.handicap ?? "").trim();
      const handicap = handicapInput === "" ? null : Number(handicapInput);
      const submittedRoles: SubmittedTeamRole[] | null = Array.isArray(body.roles)
        ? (body.roles as unknown[])
            .map((row: unknown): SubmittedTeamRole | null => {
              if (!row || typeof row !== "object") return null;
              const role = String((row as { role?: unknown }).role ?? "").trim();
              const teamId = String((row as { teamId?: unknown }).teamId ?? "").trim();
              if ((role !== "Player" && role !== "Manager") || !teamId) return null;
              return { role, teamId };
            })
            .filter((row: SubmittedTeamRole | null): row is SubmittedTeamRole => Boolean(row))
        : null;
      const submittedPublisher = typeof body.publisher === "boolean" ? body.publisher : null;
      const submittedLeagueChair: boolean | null = typeof body.leagueChair === "boolean" ? Boolean(body.leagueChair) : null;

      if (!firstName || !lastName) {
        return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
      }
      if (handicap !== null && (!Number.isFinite(handicap) || handicap < -200 || handicap > 200)) {
        return NextResponse.json({ error: "Handicap must be between -200 and 200, or left blank." }, { status: 400 });
      }

      const updated = await withTransaction(async (client) => {
        const scopeResult = await client.query<{ club_id: string }>(
          `select club_id
           from public.club_membership
           where person_id = $1
             and active = true`,
          [personId]
        );
        const editableClubIds = access.platformAdmin
          ? scopeResult.rows.map((row) => row.club_id)
          : scopeResult.rows.map((row) => row.club_id).filter((clubId) => access.clubAdminClubIds.includes(clubId));
        const existingClubIds = Array.from(new Set(scopeResult.rows.map((row) => row.club_id)));
        if (!access.platformAdmin && !editableClubIds.length) {
          throw new Error("Club administrator access is required for this person.");
        }
        if (submittedLeagueChair !== null || submittedPublisher !== null) assertPlatformAdmin(access);

        if (emailInput) {
          const duplicateResult = await client.query<{ id: string }>(
            `select id
             from public.person
             where lower(email) = lower($1)
               and id <> $2
               and active = true
             limit 1`,
            [emailInput, personId]
          );
          if (duplicateResult.rowCount) {
            throw new Error("That email address is already used by another person.");
          }
        }

        const personResult = await client.query<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null }>(
          `update public.person
           set first_name = $2,
               last_name = $3,
               email = nullif($4, ''),
               phone = nullif($5, '')
           where id = $1
             and active = true
           returning id, first_name, last_name, email, phone`,
          [personId, firstName, lastName, emailInput, phoneInput]
        );

        if (!personResult.rowCount) {
          throw new Error("Person was not found.");
        }

        await client.query(
          `update public.club_membership
           set handicap = $2
           where person_id = $1
             and active = true
             and ($3::boolean = true or club_id = any($4::uuid[]))`,
          [personId, handicap, access.platformAdmin, editableClubIds]
        );

        if (submittedRoles) {
          const desiredRoles: SubmittedTeamRole[] = Array.from(
            new Map(submittedRoles.map((row) => [`${row.teamId}:${row.role}`, row])).values()
          );
          const teamResult = desiredRoles.length
            ? await client.query<{ id: string; club_id: string; league_id: string; name: string }>(
                `select id, club_id, league_id, name
                 from public.team
                 where id = any($1::uuid[])`,
                [desiredRoles.map((row) => row.teamId)]
              )
            : { rows: [] as Array<{ id: string; club_id: string; league_id: string; name: string }> };
          const teamsById = new Map(teamResult.rows.map((team) => [team.id, team]));

          for (const desiredRole of desiredRoles) {
            const team = teamsById.get(desiredRole.teamId);
            if (!team) throw new Error("One of the selected teams was not found.");
            assertClubScope(access, team.club_id);
            if (!existingClubIds.includes(team.club_id)) {
              throw new Error("Roles can only be added within this person's existing club.");
            }
          }

          const clubsToReplace = Array.from(new Set([
            ...editableClubIds,
            ...teamResult.rows.map((team) => team.club_id)
          ]));

          if (clubsToReplace.length) {
            await client.query(
              `update public.person_team_role
               set active = false
               where person_id = $1
                 and club_id = any($2::uuid[])`,
              [personId, clubsToReplace]
            );
            await client.query(
              `update public.team_membership tm
               set active = false
               from public.team t
               where tm.team_id = t.id
                 and tm.person_id = $1
                 and t.club_id = any($2::uuid[])`,
              [personId, clubsToReplace]
            );
          }

          for (const desiredRole of desiredRoles) {
            const team = teamsById.get(desiredRole.teamId);
            if (!team) continue;
            await client.query(
              `with club_member as (
                 insert into public.club_membership (club_id, person_id, role, handicap, active)
                 values ($1, $2, 'Club Member', $6, true)
                 on conflict (club_id, person_id, role) do update
                 set active = true,
                     handicap = coalesce(excluded.handicap, public.club_membership.handicap)
                 returning id
               )
               insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
               select id, $2, $1, $3, $4, $5::public.membership_role, true
               from club_member
               on conflict (person_id, club_id, league_id, team_name, role) do update
               set active = true,
                   club_membership_id = excluded.club_membership_id`,
              [team.club_id, personId, team.league_id, team.name, desiredRole.role, handicap]
            );
            await client.query(
              `insert into public.team_membership (team_id, person_id, role, active)
               values ($1, $2, $3, true)
               on conflict (team_id, person_id, role) do update set active = true`,
              [desiredRole.teamId, personId, desiredRole.role]
            );
          }
        }

        if (submittedLeagueChair !== null) {
          await client.query(
            `update public.club_membership
             set active = false
             where person_id = $1
               and role = 'League Chair'`,
            [personId]
          );

          if (submittedLeagueChair) {
            const anchorClubId = existingClubIds[0] ?? editableClubIds[0];
            if (!anchorClubId) throw new Error("Add this person to a club or team before assigning Interclub League Chair.");
            await client.query(
              `insert into public.club_membership (club_id, person_id, role, handicap, active)
               values ($1, $2, 'League Chair', $3, true)
               on conflict (club_id, person_id, role) do update
               set active = true,
                   handicap = coalesce(excluded.handicap, public.club_membership.handicap)`,
              [anchorClubId, personId, handicap]
            );
          }
        }

        if (submittedPublisher !== null) {
          await client.query(`insert into public.app_publisher(person_id,active,assigned_by) values($1,$2,$3)
            on conflict(person_id) do update set active=excluded.active,assigned_by=excluded.assigned_by,updated_at=now()`,[personId,submittedPublisher,user.personId]);
        }
        return personResult.rows[0];
      });

      return NextResponse.json({ ok: true, person: updated });
    }

    assertPlatformAdmin(access);
    const loginActive = Boolean(body.loginActive);
    if (personId === user.personId && !loginActive) {
      return NextResponse.json({ error: "You cannot disable your own login." }, { status: 400 });
    }

    const result = await dbQuery<{ id: string }>(
      `update public.user_account
       set active = $2
       where person_id = $1
       returning id`,
      [personId, loginActive]
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: "This person does not have a login account yet." }, { status: 404 });
    }

    if (!loginActive) {
      await dbQuery(
        `delete from public.app_session
         where user_account_id in (
           select id
           from public.user_account
           where person_id = $1
         )`,
        [personId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update user." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await adminAccess();
    assertPlatformAdmin(access);
    const user = access.user;
    const body = await request.json().catch(() => ({}));
    const personId = String(body.personId ?? "").trim();

    if (!personId) {
      return NextResponse.json({ error: "Person is required." }, { status: 400 });
    }
    if (personId === user.personId) {
      return NextResponse.json({ error: "You cannot delete your own user." }, { status: 400 });
    }

    const deleted = await withTransaction(async (client) => {
      const personResult = await client.query<{ first_name: string; last_name: string }>(
        `update public.person
         set active = false
         where id = $1
           and active = true
         returning first_name, last_name`,
        [personId]
      );

      if (!personResult.rowCount) return null;

      await client.query("update public.user_account set active = false where person_id = $1", [personId]);
      await client.query(
        `delete from public.app_session
         where user_account_id in (
           select id
           from public.user_account
           where person_id = $1
         )`,
        [personId]
      );
      await client.query("update public.club_membership set active = false where person_id = $1", [personId]);
      await client.query("update public.person_team_role set active = false where person_id = $1", [personId]);
      await client.query("update public.team_membership set active = false where person_id = $1", [personId]);
      await client.query("update public.club_admin set active = false where person_id = $1", [personId]);
      await client.query("update public.app_operator set active = false where person_id = $1", [personId]);

      const person = personResult.rows[0];
      return `${person.first_name} ${person.last_name}`.trim();
    });

    if (!deleted) {
      return NextResponse.json({ error: "User was not found or is already inactive." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, name: deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete user." },
      { status: 400 }
    );
  }
}
