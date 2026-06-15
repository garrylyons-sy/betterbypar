import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { loadCompetitionDetail } from "@/lib/server/competitions";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params;
    const competition = await loadCompetitionDetail(user, id);
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    return NextResponse.json({ competition });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Competition unavailable." },
      { status: 500 }
    );
  }
}
