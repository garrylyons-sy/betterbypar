import { NextResponse } from "next/server";

import { processDueLastManStandingWork } from "@/lib/server/last-man-standing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await processDueLastManStandingWork();
    return NextResponse.json({ ok: true, processed: results.filter((result) => result.changed).length });
  } catch (error) {
    console.error("last-man-standing:scheduled-process", error);
    return NextResponse.json({ error: "Scheduled processing failed." }, { status: 500 });
  }
}
