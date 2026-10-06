import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

type ProductRow = {
  id: string;
  product_name: string;
  description: string;
  image_path: string;
  price_euros: string;
  option_name: string | null;
  option_values: string[];
};
type CheckoutItemRequest = {
  productId?: unknown;
  selectedOption?: unknown;
  quantity?: unknown;
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
         price_euros::text,
         option_name,
         option_values
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
        priceEuros: Number(row.price_euros),
        optionName: row.option_name,
        optionValues: row.option_values ?? []
      }))
    });
  } catch (error) {
    console.error("shop:get", error);
    return NextResponse.json({ error: "Shop products could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    if (!await canViewShop(user.personId)) {
      return NextResponse.json({ error: "League Chair access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const buyerName = String(body.buyerName ?? "").trim();
    const buyerEmail = String(body.buyerEmail ?? user.email ?? "").trim();
    const buyerPhone = String(body.buyerPhone ?? "").trim();
    const items: CheckoutItemRequest[] = Array.isArray(body.items) ? body.items : [];

    if (!buyerName) return NextResponse.json({ error: "Name is required for checkout." }, { status: 400 });
    if (!buyerEmail || !buyerEmail.includes("@")) return NextResponse.json({ error: "A valid email is required for checkout." }, { status: 400 });
    if (!items.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

    const order = await withTransaction(async (client) => {
      const productIds = Array.from(new Set(items.map((item) => String(item.productId ?? "").trim()).filter(Boolean)));
      if (!productIds.length) throw new Error("Your cart is empty.");

      const products = await client.query<ProductRow>(
        `select
           id::text,
           product_name,
           description,
           image_path,
           price_euros::text,
           option_name,
           option_values
         from public.product
         where active = true
           and id = any($1::uuid[])`,
        [productIds]
      );
      const productById = new Map(products.rows.map((product) => [product.id, product]));
      let total = 0;
      const normalizedItems = items.map((item) => {
        const productId = String(item.productId ?? "").trim();
        const product = productById.get(productId);
        if (!product) throw new Error("One of the products is no longer available.");
        const quantity = Math.max(1, Math.min(10, Number(item.quantity ?? 1) || 1));
        const selectedOption = String(item.selectedOption ?? "").trim();
        const optionValues = product.option_values ?? [];
        if (optionValues.length && !optionValues.includes(selectedOption)) {
          throw new Error(`Choose a ${product.option_name || "option"} for ${product.product_name}.`);
        }
        const unitPrice = Number(product.price_euros);
        const lineTotal = unitPrice * quantity;
        total += lineTotal;
        return { product, quantity, selectedOption: selectedOption || null, unitPrice, lineTotal };
      });

      const orderResult = await client.query<{ id: string; status: string; total_euros: string }>(
        `insert into public.shop_order (person_id, buyer_name, buyer_email, buyer_phone, total_euros)
         values ($1, $2, $3, nullif($4, ''), $5)
         returning id::text, status, total_euros::text`,
        [user.personId, buyerName, buyerEmail, buyerPhone, total.toFixed(2)]
      );
      const orderRow = orderResult.rows[0];

      for (const item of normalizedItems) {
        await client.query(
          `insert into public.shop_order_item (
             order_id,
             product_id,
             product_name,
             selected_option,
             quantity,
             unit_price_euros,
             line_total_euros
           )
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderRow.id,
            item.product.id,
            item.product.product_name,
            item.selectedOption,
            item.quantity,
            item.unitPrice.toFixed(2),
            item.lineTotal.toFixed(2)
          ]
        );
      }

      return orderRow;
    });

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        totalEuros: Number(order.total_euros)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be completed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
