import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import {
  LastManStandingError,
  saveLastManStandingPicks
} from "@/lib/server/last-man-standing";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { competitionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.playerIds) || body.playerIds.length !== 2 || !body.roundId) {
      return NextResponse.json({ error: "Choose two players for the current round.", code: "TWO_PICKS_REQUIRED" }, { status: 400 });
    }
    const result = await saveLastManStandingPicks(user, {
      competitionId,
      roundId: String(body.roundId),
      playerIds: [String(body.playerIds[0]), String(body.playerIds[1])],
      versions: Array.isArray(body.versions) ? [body.versions[0] ?? null, body.versions[1] ?? null] : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof LastManStandingError ? error.status : 500;
    const code = error instanceof LastManStandingError ? error.code : "PICKS_FAILED";
    return NextResponse.json({ error: error instanceof Error ? error.message : "Picks could not be saved.", code }, { status });
  }
}
