import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { eligibleAdvertSql } from "@/lib/server/adverts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const adId = String(body.adId ?? "").trim();
    if (!adId || adId.length > 100) return NextResponse.json({ ok: false }, { status: 400 });
    const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 1000);

    const result = await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, user_agent, metadata)
       select $1, 'Advert Click', a.link_url, 'Advert', $3,
         jsonb_build_object('ad_id',a.id::text,'ad_name',a.name,'placement',a.placement,'audience',a.audience)
       from public.ads a where a.id::text=$2 and ${eligibleAdvertSql}
       returning person_id`,
      [user.personId, adId, userAgent]
    );
    if (!result.rows.length) return NextResponse.json({ ok: false }, { status: 404 });

    return NextResponse.json({ ok: true, recorded: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
