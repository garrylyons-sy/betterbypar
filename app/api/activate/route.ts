import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { claimInvitationForAccount, hashPassword, recordLogin, setSessionCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const invitationCode = String(body.invitationCode ?? "").trim();

    if (!email || !username || !password) {
      return NextResponse.json({ error: "Email, user ID and password are required." }, { status: 400 });
    }

    const user = await claimInvitationForAccount({
      email,
      username,
      passwordHash: hashPassword(password),
      invitationCode: invitationCode || undefined
    });

    await setSessionCookie(user.accountId);
    await recordLogin(user, "password_activation", (await headers()).get("user-agent") ?? "");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Activation failed." },
      { status: 400 }
    );
  }
}
