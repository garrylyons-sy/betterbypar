import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { hashPassword, recordLogin, setSessionCookie } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { hashSecretToken } from "@/lib/server/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");

    if (!token || !password) {
      return NextResponse.json({ error: "Reset link and new password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const tokenHash = hashSecretToken(token);
    const user = await withTransaction(async (client) => {
      const tokenResult = await client.query<{
        id: string;
        user_account_id: string;
        person_id: string;
        username: string;
        email: string | null;
        first_name: string;
        last_name: string;
        profile_image: string | null;
      }>(
        `select
           prt.id,
           ua.id as user_account_id,
           ua.person_id,
           ua.username,
           p.email,
           p.first_name,
           p.last_name,
           p.profile_image
         from public.password_reset_token prt
         join public.user_account ua on ua.id = prt.user_account_id
         join public.person p on p.id = ua.person_id
         where prt.token_hash = $1
           and prt.used_at is null
           and prt.expires_at > now()
           and ua.active = true
           and p.active = true
         limit 1
         for update`,
        [tokenHash]
      );
      const reset = tokenResult.rows[0];
      if (!reset) throw new Error("This reset link is invalid or has expired.");

      await client.query("update public.user_account set password_hash = $2, last_login = now() where id = $1", [reset.user_account_id, hashPassword(password)]);
      await client.query("update public.password_reset_token set used_at = now() where id = $1", [reset.id]);

      return {
        accountId: reset.user_account_id,
        personId: reset.person_id,
        username: reset.username,
        email: reset.email ?? "",
        name: `${reset.first_name} ${reset.last_name}`.trim(),
        profileImage: reset.profile_image ?? ""
      };
    });

    await setSessionCookie(user.accountId);
    await recordLogin(user, "password_reset", (await headers()).get("user-agent") ?? "");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password reset failed." },
      { status: 400 }
    );
  }
}
