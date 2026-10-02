import { NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const adId = String(body.adId ?? "").trim();
    const adName = String(body.adName ?? "Advert").trim() || "Advert";
    const linkUrl = String(body.linkUrl ?? "").trim();
    const placement = String(body.placement ?? "").trim();
    const audience = String(body.audience ?? "").trim();
    const userAgent = String(body.userAgent ?? "");

    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, user_agent, metadata)
       values ($1, 'Advert Click', $2, 'Advert', $3, $4::jsonb)`,
      [
        user.personId,
        linkUrl || null,
        userAgent,
        JSON.stringify({
          ad_id: adId || null,
          ad_name: adName,
          placement: placement || null,
          audience: audience || null
        })
      ]
    );

    return NextResponse.json({ ok: true, recorded: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
