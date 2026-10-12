import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import {
  hasLastManStandingPilotAccess,
  LastManStandingError,
  loadLastManStandingCompetition
} from "@/lib/server/last-man-standing";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!await hasLastManStandingPilotAccess(user.personId)) {
      return NextResponse.json({ error: "League Chair access required." }, { status: 403 });
    }
    const { competitionId } = await context.params;
    return NextResponse.json(await loadLastManStandingCompetition(user, competitionId));
  } catch (error) {
    const status = error instanceof LastManStandingError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competition could not be loaded." }, { status });
  }
}
