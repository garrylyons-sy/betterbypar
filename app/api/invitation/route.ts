import { NextRequest, NextResponse } from "next/server";

import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Invitation code is required." }, { status: 400 });

  const { rows } = await dbQuery<{
    id: string;
    email: string;
    invited_person_name: string;
    invited_role: string;
    status: string;
    expires_at: string;
    club_name: string | null;
    memberships: Array<{ team_name: string; league_name: string; role: string }>;
  }>(
    `select
       i.id,
       i.email,
       i.invited_person_name,
       i.invited_role::text,
       i.status::text,
       i.expires_at::text,
       c.name as club_name,
       coalesce(
         jsonb_agg(
           jsonb_build_object(
             'team_name', t.name,
             'league_name', l.name,
             'role', im.role::text
           )
           order by l.name, t.name
         ) filter (where im.id is not null),
         '[]'::jsonb
       ) as memberships
     from public.invitation i
     left join public.club c on c.id = i.invited_club_id
     left join public.invitation_membership im on im.invitation_id = i.id
     left join public.team t on t.id = im.team_id
     left join public.league l on l.id = t.league_id
     where i.invitation_code = $1
     group by i.id, c.name
     limit 1`,
    [code]
  );

  const invitation = rows[0];
  if (!invitation) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  if (invitation.status !== "Pending") return NextResponse.json({ error: `Invitation is ${invitation.status.toLowerCase()}.` }, { status: 410 });
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Invitation has expired." }, { status: 410 });

  return NextResponse.json({
    invitation: {
      code,
      email: invitation.email,
      name: invitation.invited_person_name,
      role: invitation.invited_role,
      club: invitation.club_name,
      memberships: invitation.memberships
    }
  });
}
