import { NextResponse } from "next/server";

import { currentUser, loadSessionPayload } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ authenticated: false });

    return NextResponse.json(await loadSessionPayload(user));
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: error instanceof Error ? error.message : "Session unavailable" },
      { status: 503 }
    );
  }
}
