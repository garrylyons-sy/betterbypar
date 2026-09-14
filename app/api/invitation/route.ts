import { NextRequest, NextResponse } from "next/server";

import { dbQuery } from "@/lib/server/db";
import { hashSecretToken } from "@/lib/server/tokens";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() || request.nextUrl.searchParams.get("invite")?.trim() || request.nextUrl.searchParams.get("code")?.trim();
  if (!token) return NextResponse.json({ error: "Invitation link is required." }, { status: 400 });
  const tokenHash = hashSecretToken(token);

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
       coalesce(m.memberships, '[]'::jsonb) as memberships
     from public.invitation i
     left join public.club c on c.id = i.invited_club_id
     left join lateral (
       select jsonb_agg(item order by sort_key, team_name) as memberships
       from (
         select
           l.name as sort_key,
           t.name as team_name,
           jsonb_build_object(
             'team_name', t.name,
             'league_name', l.name,
             'role', im.role::text
           ) as item
         from public.invitation_membership im
         join public.team t on t.id = im.team_id
         join public.league l on l.id = t.league_id
         where im.invitation_id = i.id
         union all
         select
           'Club' as sort_key,
           c2.name as team_name,
           jsonb_build_object(
             'team_name', c2.name,
             'league_name', 'Club',
             'role', icm.role
           ) as item
         from public.invitation_club_membership icm
         join public.club c2 on c2.id = icm.club_id
         where icm.invitation_id = i.id
       ) role_rows
     ) m on true
     where i.invitation_code = $1
        or i.invitation_token_hash = $2
     limit 1`,
    [token, tokenHash]
  );

  const invitation = rows[0];
  if (!invitation) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  if (invitation.status !== "Pending") return NextResponse.json({ error: `Invitation is ${invitation.status.toLowerCase()}.` }, { status: 410 });
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Invitation has expired." }, { status: 410 });

  return NextResponse.json({
    invitation: {
      code: token,
      token,
      email: invitation.email,
      name: invitation.invited_person_name,
      role: invitation.invited_role,
      club: invitation.club_name,
      memberships: invitation.memberships
    }
  });
}
