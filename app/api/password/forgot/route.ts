import { NextResponse } from "next/server";

import { accountByLoginIdentifier, createToken } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { appBaseUrl, escapeHtml, sendAppEmail } from "@/lib/server/email";
import { hashSecretToken } from "@/lib/server/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim().toLowerCase();

  if (identifier) {
    const account = await accountByLoginIdentifier(identifier).catch(() => null);
    if (account?.email) {
      const resetToken = createToken(32);
      const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(resetToken)}`, appBaseUrl(request.url)).toString();
      await dbQuery(
        `insert into public.password_reset_token (user_account_id, token_hash, expires_at)
         values ($1, $2, now() + interval '45 minutes')`,
        [account.id, hashSecretToken(resetToken)]
      );

      const subject = "Reset your Better By Par password";
      const text = [
        `Hi ${account.first_name},`,
        "",
        "Use this link to set a new Better By Par password:",
        resetUrl,
        "",
        "This link expires in 45 minutes. If you did not request it, you can ignore this email."
      ].join("\n");
      const html = `
        <div style="margin:0;background:#f3f6f8;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#10233f">
          <div style="max-width:600px;margin:0 auto;background:white;border-radius:24px;overflow:hidden;border:1px solid #dfe7ee;box-shadow:0 18px 48px rgba(16,35,63,.14)">
            <div style="background:linear-gradient(135deg,#10233f 0%,#1b8a72 100%);padding:30px 28px;color:white">
              <div style="display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Better By Par</div>
              <h1 style="margin:18px 0 8px;font-size:34px;line-height:1.02">Reset your password</h1>
              <p style="margin:0;font-size:16px;font-weight:700;opacity:.84">Create a new password for your account.</p>
            </div>
            <div style="padding:28px">
              <p style="font-size:18px;font-weight:800;margin:0 0 12px">Hi ${escapeHtml(account.first_name)},</p>
              <p style="margin:0 0 20px;color:#4e6074;font-weight:600;line-height:1.55">We received a request to reset your Better By Par password.</p>
              <a href="${resetUrl}" style="display:block;text-align:center;background:#1b8a72;color:white;text-decoration:none;font-weight:900;padding:15px 20px;border-radius:14px;font-size:16px">Set new password</a>
              <p style="margin:18px 0 0;color:#6c7788;font-size:13px;line-height:1.45">This link expires in 45 minutes. If you did not request it, you can ignore this email.</p>
            </div>
          </div>
        </div>`;

      await sendAppEmail({ to: account.email, subject, html, text });
    }
  }

  return NextResponse.json({ ok: true, message: "If an account exists for those details, a reset email has been sent." });
}
