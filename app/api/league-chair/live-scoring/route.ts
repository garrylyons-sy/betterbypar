import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import {
  LiveScoringError,
  loadLiveScoringFixture,
  performLiveScoringAction,
  requireLeagueChairScoringAccess,
  type LiveScoringInput
} from "@/lib/server/live-scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actions = new Set([
  "recordResult", "start", "pot", "foul", "endVisit", "selectPlayer", "undo",
  "correctBalls", "setState", "concede", "respotBlack", "takeover", "handover", "pause", "resume", "complete", "abandon"
]);

function errorResponse(error: unknown) {
  if (error instanceof LiveScoringError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error("league-chair-live-scoring", error);
  return NextResponse.json({ error: "Live scoring is unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

async function authorisedUser() {
  const user = await currentUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }), user: null };
  if (!await requireLeagueChairScoringAccess(user.personId)) {
    return { response: NextResponse.json({ error: "League Chair access required." }, { status: 403 }), user: null };
  }
  return { response: null, user };
}

export async function GET(request: NextRequest) {
  try {
    const access = await authorisedUser();
    if (!access.user) return access.response!;
    const fixtureId = request.nextUrl.searchParams.get("fixtureId")?.trim() ?? "";
    if (!fixtureId) return NextResponse.json({ error: "Fixture is required." }, { status: 400 });
    return NextResponse.json(await loadLiveScoringFixture(fixtureId, access.user.personId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorisedUser();
    if (!access.user) return access.response!;
    const body = await request.json().catch(() => ({})) as LiveScoringInput;
    if (!actions.has(String(body.action ?? ""))) {
      return NextResponse.json({ error: "Unsupported live scoring action." }, { status: 400 });
    }
    return NextResponse.json(await performLiveScoringAction(access.user.personId, body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
