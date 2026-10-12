import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { hasLastManStandingPilotAccess, listLastManStandingCompetitions } from "@/lib/server/last-man-standing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!await hasLastManStandingPilotAccess(user.personId)) {
      return NextResponse.json({ error: "League Chair access required." }, { status: 403 });
    }
    return NextResponse.json({ competitions: await listLastManStandingCompetitions(user) });
  } catch (error) {
    console.error("last-man-standing:list", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competitions could not be loaded." }, { status: 500 });
  }
}
