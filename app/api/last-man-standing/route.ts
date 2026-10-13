import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { LastManStandingError, listLastManStandingCompetitions } from "@/lib/server/last-man-standing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    return NextResponse.json({ competitions: await listLastManStandingCompetitions(user) });
  } catch (error) {
    console.error("last-man-standing:list", error);
    const status = error instanceof LastManStandingError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competitions could not be loaded." }, { status });
  }
}
