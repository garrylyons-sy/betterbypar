import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { canManageCompetition, loadCompetitionDetail } from "@/lib/server/competitions";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedClubMembershipId = String(body.clubMembershipId ?? "").trim();
    const canManage = await canManageCompetition(user, id);

    const competition = await loadCompetitionDetail(user, id);
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    if (!canManage && competition.status !== "Open") {
      return NextResponse.json({ error: "Entries are closed." }, { status: 400 });
    }

    const membershipResult = await dbQuery<{ id: string }>(
      `select cm.id
       from public.club_membership cm
       join public.competition c on c.id = $1
       where cm.id = coalesce(nullif($2, '')::uuid, cm.id)
         and cm.club_id = c.club_id
         and cm.active = true
         and ($3::boolean = true or cm.person_id = $4)
       order by cm.created_at
       limit 1`,
      [id, requestedClubMembershipId, canManage, user.personId]
    );
    const clubMembershipId = membershipResult.rows[0]?.id;
    if (!clubMembershipId) {
      return NextResponse.json({ error: "No eligible club membership found." }, { status: 403 });
    }

    await dbQuery(
      `insert into public.competition_entry (competition_id, club_membership_id, entered_by, status)
       values ($1, $2, $3, 'Entered')
       on conflict (competition_id, club_membership_id) do update
       set status = 'Entered',
           entered_by = excluded.entered_by,
           entered_at = now()`,
      [id, clubMembershipId, user.personId]
    );

    return NextResponse.json({ ok: true, competition: await loadCompetitionDetail(user, id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not enter competition." },
      { status: 400 }
    );
  }
}
