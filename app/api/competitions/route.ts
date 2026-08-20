import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { clubAdminClubIds, clubMembershipsForPerson, isPlatformAdmin, listCompetitions } from "@/lib/server/competitions";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const url = new URL(request.url);
    const contextClubName = url.searchParams.has("testUser") ? url.searchParams.get("contextClub")?.trim() ?? "" : "";
    const [competitions, memberships, adminClubIds, platformAdmin, clubs] = await Promise.all([
      listCompetitions(user, { contextClubName }),
      clubMembershipsForPerson(user.personId),
      clubAdminClubIds(user.personId),
      isPlatformAdmin(user.personId),
      dbQuery<{ club_id: string; club_name: string }>("select id as club_id, name as club_name from public.club where active = true order by name")
    ]);
    const visibleMemberships = contextClubName
      ? memberships.filter((membership) => membership.club_name === contextClubName)
      : memberships;
    return NextResponse.json({
      competitions,
      memberships: visibleMemberships,
      manageableClubs: clubs.rows.filter((club) => platformAdmin || adminClubIds.has(club.club_id)),
      platformAdmin
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Competitions unavailable." },
      { status: 500 }
    );
  }
}
