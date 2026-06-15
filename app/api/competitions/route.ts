import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { canManageClub, clubAdminClubIds, clubMembershipsForPerson, isPlatformAdmin, listCompetitions } from "@/lib/server/competitions";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

function validDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const [competitions, memberships, adminClubIds, platformAdmin, clubs] = await Promise.all([
      listCompetitions(user),
      clubMembershipsForPerson(user.personId),
      clubAdminClubIds(user.personId),
      isPlatformAdmin(user.personId),
      dbQuery<{ club_id: string; club_name: string }>("select id as club_id, name as club_name from public.club where active = true order by name")
    ]);
    return NextResponse.json({
      competitions,
      memberships,
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

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const body = await request.json();
    const clubId = String(body.clubId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const competitionType = String(body.competitionType ?? "Scratch").trim();
    const entryClosesAt = validDate(body.entryClosesAt);
    const rules = String(body.rules ?? "").trim();

    if (!clubId || !name || !entryClosesAt) {
      return NextResponse.json({ error: "Club, name and closing date are required." }, { status: 400 });
    }
    if (!["Handicap", "Scratch"].includes(competitionType)) {
      return NextResponse.json({ error: "Competition type must be Handicap or Scratch." }, { status: 400 });
    }
    if (!await canManageClub(user, clubId)) {
      return NextResponse.json({ error: "Club admin access is required." }, { status: 403 });
    }

    const competitionId = await withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `insert into public.competition (club_id, managed_by_platform, name, competition_type, entry_closes_at, rules, status, created_by)
         values ($1, false, $2, $3, $4::date, $5, 'Open', $6)
         returning id`,
        [clubId, name, competitionType, entryClosesAt, rules, user.personId]
      );
      return result.rows[0].id;
    });

    return NextResponse.json({ ok: true, competitionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create competition." },
      { status: 400 }
    );
  }
}
