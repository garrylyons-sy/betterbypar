import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type AccountRow = {
  account_id: string;
  person_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_platform_admin: boolean;
};

type RoleRow = {
  account_id: string;
  role: string;
  label: string;
};

function isLocalRequest(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  return host.includes("localhost") || host.includes("127.0.0.1");
}

async function isAllowed(request: NextRequest) {
  if (isLocalRequest(request)) return true;
  const user = await currentUser();
  if (!user) return false;
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return Boolean(rowCount);
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAllowed(request)) {
      return NextResponse.json({ error: "Test harness access requires localhost or a platform administrator." }, { status: 403 });
    }

    const [accounts, roles] = await Promise.all([
      dbQuery<AccountRow>(
        `select
           ua.id as account_id,
           p.id as person_id,
           ua.username,
           p.first_name,
           p.last_name,
           p.email,
           coalesce(ao.active, false) as is_platform_admin
         from public.user_account ua
         join public.person p on p.id = ua.person_id
         left join public.app_operator ao on ao.person_id = p.id and ao.active = true
         where ua.active = true
           and p.active = true
         order by coalesce(p.email, ua.username), p.last_name, p.first_name
         limit 120`
      ),
      dbQuery<RoleRow>(
        `select distinct ua.id as account_id, ptr.role::text as role, concat(ptr.team_name, ' - ', ptr.role::text) as label
         from public.user_account ua
         join public.club_membership cm on cm.person_id = ua.person_id and cm.active = true
         join public.person_team_role ptr on ptr.club_membership_id = cm.id and ptr.active = true
         where ua.active = true
         union
         select distinct ua.id as account_id, tm.role::text as role, concat(t.name, ' - ', tm.role::text) as label
         from public.user_account ua
         join public.team_membership tm on tm.person_id = ua.person_id and tm.active = true
         join public.team t on t.id = tm.team_id and t.active = true
         where ua.active = true
         union
         select distinct ua.id as account_id, 'Club Member' as role, concat(c.name, ' - Club Member') as label
         from public.user_account ua
         join public.club_membership cm on cm.person_id = ua.person_id and cm.active = true
         join public.club c on c.id = cm.club_id and c.active = true
         where ua.active = true
         union
         select distinct ua.id as account_id, 'Club Admin' as role, concat(c.name, ' - Club Admin') as label
         from public.user_account ua
         join public.club_membership cm on cm.person_id = ua.person_id and cm.active = true
         join public.club c on c.id = cm.club_id and c.active = true
         left join public.club_admin ca on ca.club_id = c.id and ca.person_id = ua.person_id and ca.active = true
         where ua.active = true
           and (cm.is_club_admin = true or ca.id is not null)
         union
         select distinct ua.id as account_id, 'Platform Admin' as role, 'Platform Admin' as label
         from public.user_account ua
         join public.app_operator ao on ao.person_id = ua.person_id and ao.active = true
         where ua.active = true
         order by account_id, role, label`
      )
    ]);

    const rolesByAccount = new Map<string, RoleRow[]>();
    for (const role of roles.rows) {
      rolesByAccount.set(role.account_id, [...(rolesByAccount.get(role.account_id) ?? []), role]);
    }

    return NextResponse.json({
      actors: accounts.rows.map((account) => {
        const actorRoles = rolesByAccount.get(account.account_id) ?? [];
        return {
          accountId: account.account_id,
          personId: account.person_id,
          username: account.username,
          name: `${account.first_name} ${account.last_name}`.trim() || account.username,
          email: account.email,
          isPlatformAdmin: account.is_platform_admin,
          roleTypes: Array.from(new Set(actorRoles.map((role) => role.role))),
          roleLabels: actorRoles.map((role) => role.label)
        };
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test actors unavailable." },
      { status: 500 }
    );
  }
}
