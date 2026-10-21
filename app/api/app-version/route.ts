import { NextResponse } from "next/server";

import { deploymentAppVersion } from "@/lib/app-version.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { version: deploymentAppVersion() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
