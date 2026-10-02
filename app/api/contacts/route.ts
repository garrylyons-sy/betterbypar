import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type ContactRow = {
  id: string;
  contact_type: "League Official" | "Team Contact" | "Club Contact";
  contact_label: string;
  display_name: string;
  phone: string | null;
  club_name: string | null;
  club_logo_path: string | null;
  club_primary_color: string | null;
  club_accent_color: string | null;
  league_name: string | null;
  team_name: string | null;
  sort_order: number;
};

async function canViewContacts(personId: string) {
  const { rows } = await dbQuery<{ can_view: boolean }>(
    `select exists (
       select 1
       from public.app_operator ao
       where ao.person_id = $1
         and ao.active = true
       union
       select 1
       from public.club_admin ca
       where ca.person_id = $1
         and ca.active = true
       union
       select 1
       from public.club_membership cm
       where cm.person_id = $1
         and cm.active = true
         and cm.is_club_admin = true
       union
       select 1
       from public.club_membership cm
       where cm.person_id = $1
         and cm.active = true
         and cm.role = 'League Chair'
       union
       select 1
       from public.person_team_role ptr
       where ptr.person_id = $1
         and ptr.active = true
         and ptr.role = 'Manager'
     ) as can_view`,
    [personId]
  );
  return Boolean(rows[0]?.can_view);
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    if (!await canViewContacts(user.personId)) {
      return NextResponse.json({ error: "Manager or club admin access required." }, { status: 403 });
    }

    const { rows } = await dbQuery<ContactRow>(
      `select
         cd.id::text,
         cd.contact_type::text as contact_type,
         cd.contact_label,
         concat_ws(' ', p.first_name, p.last_name) as display_name,
         coalesce(nullif(cd.phone_override, ''), nullif(p.phone, '')) as phone,
         c.name as club_name,
         c.logo_path as club_logo_path,
         c.primary_color as club_primary_color,
         coalesce(c.accent_color, '#10233F') as club_accent_color,
         l.name as league_name,
         cd.team_name,
         cd.sort_order
       from public.contact_directory cd
       join public.person p on p.id = cd.person_id and p.active = true
       left join public.club c on c.id = cd.club_id
       left join public.league l on l.id = cd.league_id
       where cd.active = true
       order by
         case cd.contact_type
           when 'League Official' then 0
           when 'Team Contact' then 1
           else 2
         end,
         cd.sort_order,
         c.name nulls first,
         cd.contact_label,
         p.last_name,
         p.first_name`
    );

    return NextResponse.json({
      contacts: rows.map((row) => ({
        id: row.id,
        contactType: row.contact_type,
        contactLabel: row.contact_label,
        displayName: row.display_name,
        phone: row.phone ?? "",
        clubName: row.club_name,
        clubLogoPath: row.club_logo_path,
        clubPrimaryColor: row.club_primary_color,
        clubAccentColor: row.club_accent_color,
        leagueName: row.league_name,
        teamName: row.team_name,
        sortOrder: row.sort_order
      }))
    });
  } catch (error) {
    console.error("contacts:get", error);
    return NextResponse.json({ error: "Contacts could not be loaded." }, { status: 500 });
  }
}
