import { NextResponse } from "next/server";

import { loadTeamOptions } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ teams: await loadTeamOptions() });
  } catch (error) {
    return NextResponse.json(
      { teams: [], error: error instanceof Error ? error.message : "Could not load teams." },
      { status: 503 }
    );
  }
}
