import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await request.json();
    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, user_agent, metadata)
       values ($1, 'Page Visit', $2, $3, $4, $5::jsonb)`,
      [
        user.personId,
        String(body.pagePath ?? "/"),
        String(body.pageLabel ?? "Page"),
        String(body.userAgent ?? ""),
        JSON.stringify(body.metadata ?? {})
      ]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
