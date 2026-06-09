import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { accountByLoginIdentifier, recordLogin, setSessionCookie, verifyPassword } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "User ID/email and password are required." }, { status: 400 });
    }

    const account = await accountByLoginIdentifier(identifier);
    if (!account || !verifyPassword(password, account.password_hash)) {
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }

    await dbQuery("update public.user_account set last_login = now() where id = $1", [account.id]);

    const user = {
      accountId: account.id,
      personId: account.person_id,
      username: account.username,
      email: account.email ?? "",
      name: `${account.first_name} ${account.last_name}`.trim(),
      profileImage: account.profile_image ?? ""
    };

    await setSessionCookie(account.id);
    await recordLogin(user, "password", (await headers()).get("user-agent") ?? "");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 }
    );
  }
}
