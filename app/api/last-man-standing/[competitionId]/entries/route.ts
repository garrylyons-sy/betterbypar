import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import {
  enterLastManStandingCompetition,
  LastManStandingError
} from "@/lib/server/last-man-standing";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { competitionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const entry = await enterLastManStandingCompetition(user, {
      competitionId,
      tier: body.tier,
      sourceTeamId: body.sourceTeamId
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const status = error instanceof LastManStandingError ? error.status : 500;
    const code = error instanceof LastManStandingError ? error.code : "ENTRY_FAILED";
    return NextResponse.json({ error: error instanceof Error ? error.message : "Entry could not be created.", code }, { status });
  }
}
