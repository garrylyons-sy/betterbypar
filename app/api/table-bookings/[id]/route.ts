import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const { id } = await params;
    const { rowCount } = await dbQuery(
      `update public.table_booking
       set cancelled_at = now(),
           cancelled_by = $2
       where id = $1
         and person_id = $2
         and cancelled_at is null`,
      [id, user.personId]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Only the person who made this booking can cancel it." }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cancellation failed." },
      { status: 500 }
    );
  }
}
