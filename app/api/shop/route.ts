import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type ProductRow = {
  id: string;
  product_name: string;
  description: string;
  image_path: string;
  price_euros: string;
};

async function canViewShop(personId: string) {
  const { rows } = await dbQuery<{ can_view: boolean }>(
    `select exists (
       select 1
       from public.club_membership cm
       where cm.person_id = $1
         and cm.active = true
         and cm.role = 'League Chair'
     ) as can_view`,
    [personId]
  );
  return Boolean(rows[0]?.can_view);
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    if (!await canViewShop(user.personId)) {
      return NextResponse.json({ error: "League Chair access required." }, { status: 403 });
    }

    const { rows } = await dbQuery<ProductRow>(
      `select
         id::text,
         product_name,
         description,
         image_path,
         price_euros::text
       from public.product
       where active = true
       order by sort_order, product_name`
    );

    return NextResponse.json({
      products: rows.map((row) => ({
        id: row.id,
        productName: row.product_name,
        description: row.description,
        imagePath: row.image_path,
        priceEuros: Number(row.price_euros)
      }))
    });
  } catch (error) {
    console.error("shop:get", error);
    return NextResponse.json({ error: "Shop products could not be loaded." }, { status: 500 });
  }
}
