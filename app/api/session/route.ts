import { NextResponse } from "next/server";

import { currentUser, loadSessionPayload } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json(await loadSessionPayload(user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: error instanceof Error ? error.message : "Session unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
