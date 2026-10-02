import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await request.json();
    const pagePath = String(body.pagePath ?? "/");
    const pageLabel = String(body.pageLabel ?? "Page");
    const userAgent = String(body.userAgent ?? "");
    const metadata = JSON.stringify(body.metadata ?? {});

    const recentDuplicate = await dbQuery(
      `select id
       from public.user_activity_log
       where person_id = $1
         and activity_type = 'Page Visit'
         and coalesce(page_path, '') = coalesce($2, '')
         and coalesce(page_label, '') = coalesce($3, '')
         and created_at >= now() - interval '5 minutes'
       limit 1`,
      [user.personId, pagePath, pageLabel]
    );

    if (recentDuplicate.rowCount) {
      return NextResponse.json({ ok: true, recorded: false, duplicate: true });
    }

    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, user_agent, metadata)
       values ($1, 'Page Visit', $2, $3, $4, $5::jsonb)`,
      [
        user.personId,
        pagePath,
        pageLabel,
        userAgent,
        metadata
      ]
    );

    return NextResponse.json({ ok: true, recorded: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
