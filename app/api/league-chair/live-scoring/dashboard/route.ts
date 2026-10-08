import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import {
  loadLiveScoringDashboard,
  loadLiveScoringStatuses,
  requireLeagueChairScoringAccess
} from "@/lib/server/live-scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!await requireLeagueChairScoringAccess(user.personId)) {
      return NextResponse.json({ error: "League Chair access required." }, { status: 403 });
    }

    const fixtureIds = request.nextUrl.searchParams.get("fixtureIds")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];
    const payload = fixtureIds.length
      ? { statuses: await loadLiveScoringStatuses(fixtureIds) }
      : await loadLiveScoringDashboard();

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("league-chair-live-scoring-dashboard", error);
    return NextResponse.json(
      { error: "Live scoring fixtures are unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
