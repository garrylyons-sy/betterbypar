import { NextRequest, NextResponse } from "next/server";

import { applyAffiliateCodeToAdvertUrl } from "@/lib/ads";
import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type AdAudience = "Everyone" | "League Chair";

async function requirePlatformAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const result = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!result.rowCount) throw new Error("Platform administrator access is required.");
  return user;
}

function normalizeAudience(value: unknown): AdAudience {
  return value === "Everyone" ? "Everyone" : "League Chair";
}

function normalizeAdBody(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const imagePath = String(body.imagePath ?? body.image_path ?? "").trim();
  const rawLinkUrl = String(body.linkUrl ?? body.link_url ?? "").trim();
  const affiliateCode = String(body.affiliateCode ?? body.affiliate_code ?? "").trim();
  const altText = String(body.altText ?? body.alt_text ?? "").trim();
  const audience = normalizeAudience(body.audience);
  const active = body.active === undefined ? true : Boolean(body.active);
  const sortOrderInput = Number(body.sortOrder ?? body.sort_order ?? 100);
  const sortOrder = Number.isFinite(sortOrderInput) ? Math.trunc(sortOrderInput) : 100;
  const startsAt = String(body.startsAt ?? body.starts_at ?? "").trim() || null;
  const endsAt = String(body.endsAt ?? body.ends_at ?? "").trim() || null;

  if (!name) throw new Error("Advert name is required.");
  if (!imagePath) throw new Error("Advert image is required.");
  if (!rawLinkUrl) throw new Error("Advert link URL is required.");
  if (!/^https?:\/\//i.test(rawLinkUrl)) throw new Error("Advert link URL must start with http:// or https://.");

  const linkUrl = applyAffiliateCodeToAdvertUrl(rawLinkUrl, affiliateCode);

  return { name, imagePath, linkUrl, affiliateCode, altText, audience, active, sortOrder, startsAt, endsAt };
}

function adResponse(row: {
  id: string;
  name: string;
  placement: string;
  audience: string;
  image_path: string;
  link_url: string;
  affiliate_code: string | null;
  alt_text: string;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    placement: row.placement,
    audience: row.audience,
    image_path: row.image_path,
    link_url: row.link_url,
    affiliate_code: row.affiliate_code,
    alt_text: row.alt_text,
    active: row.active,
    sort_order: row.sort_order,
    starts_at: row.starts_at,
    ends_at: row.ends_at
  };
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const input = normalizeAdBody(await request.json());
    const result = await dbQuery<ReturnType<typeof adResponse>>(
      `insert into public.ads (name, placement, audience, image_path, link_url, affiliate_code, alt_text, active, sort_order, starts_at, ends_at)
       values ($1, 'league-chair-banner', $2, $3, $4, nullif($5, ''), $6, $7, $8, $9::timestamptz, $10::timestamptz)
       returning id::text, name, placement, audience, image_path, link_url, affiliate_code, alt_text, active, sort_order, starts_at::text, ends_at::text`,
      [input.name, input.audience, input.imagePath, input.linkUrl, input.affiliateCode, input.altText, input.active, input.sortOrder, input.startsAt, input.endsAt]
    );
    return NextResponse.json({ advert: adResponse(result.rows[0]) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create advert." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Advert is required.");
    const action = String(body.action ?? "details");
    if (action === "delete") {
      await dbQuery("delete from public.ads where id = $1", [id]);
      return NextResponse.json({ ok: true });
    }

    const input = normalizeAdBody(body);
    const result = await dbQuery<ReturnType<typeof adResponse>>(
      `update public.ads
       set name = $2,
           audience = $3,
           image_path = $4,
           link_url = $5,
           affiliate_code = nullif($6, ''),
           alt_text = $7,
           active = $8,
           sort_order = $9,
           starts_at = $10::timestamptz,
           ends_at = $11::timestamptz,
           updated_at = now()
       where id = $1
       returning id::text, name, placement, audience, image_path, link_url, affiliate_code, alt_text, active, sort_order, starts_at::text, ends_at::text`,
      [id, input.name, input.audience, input.imagePath, input.linkUrl, input.affiliateCode, input.altText, input.active, input.sortOrder, input.startsAt, input.endsAt]
    );
    if (!result.rowCount) throw new Error("Advert was not found.");
    return NextResponse.json({ advert: adResponse(result.rows[0]) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update advert." }, { status: 400 });
  }
}
