import { appBaseUrl, escapeHtml, sendAppEmail } from "@/lib/server/email";
import type { AppUser } from "@/lib/server/auth";

export function buildWelcomeEmail(user: AppUser, requestUrl?: string) {
  const baseUrl = appBaseUrl(requestUrl);
  const appUrl = `${baseUrl}/`;
  const firstName = user.name.split(" ")[0] || "there";
  const subject = "Welcome to Interclub Snooker";
  const text = [
    `Hi ${firstName},`,
    "",
    "Welcome to the Interclub Snooker platform. Your account is active and ready to use.",
    "",
    `Open the app here: ${appUrl}`,
    "",
    "Please bookmark that link in your browser so it is easy to find on match nights.",
    "",
    "See you on the baize,"
  ].join("\n");

  const html = `
    <div style="margin:0;background:#f3f6f8;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#10233f">
      <div style="width:100%;max-width:620px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #dfe7ee;box-shadow:0 18px 48px rgba(16,35,63,.12)">
        <div style="background:linear-gradient(135deg,#071426 0%,#10233f 70%,#1b8a72 100%);padding:28px;color:#ffffff">
          <p style="margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.72)">Interclub Snooker</p>
          <h1 style="margin:0;font-size:30px;line-height:1.08;font-weight:900">Welcome to the platform</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.45;font-weight:700;color:rgba(255,255,255,.84)">Your account is active and ready for fixtures, tables and club competitions.</p>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 14px;font-size:18px;font-weight:850">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#4e6074;font-weight:650">
            Thanks for activating your Interclub Snooker account. You can now sign in and use the app from your phone, tablet or computer.
          </p>
          <div style="background:#f5f7fa;border:1px solid #e5ebf1;border-radius:16px;padding:16px;margin:0 0 22px">
            <p style="margin:0 0 4px;color:#6c7788;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Quick tip</p>
            <p style="margin:0;font-size:15px;line-height:1.45;font-weight:750;color:#10233f">Bookmark the app in your browser so it is one tap away on match nights.</p>
          </div>
          <a href="${escapeHtml(appUrl)}" style="display:block;text-align:center;background:#10233f;color:white;text-decoration:none;font-weight:900;padding:15px 20px;border-radius:14px;font-size:16px">Open Interclub Snooker</a>
          <p style="margin:18px 0 0;color:#6c7788;font-size:13px;line-height:1.45">
            Link: <a href="${escapeHtml(appUrl)}" style="color:#1b8a72;font-weight:800">${escapeHtml(appUrl)}</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, html, text };
}

export async function sendWelcomeEmail(user: AppUser, requestUrl?: string) {
  if (!user.email) return { status: "Queued" as const, error: "No email address on account." };
  const email = buildWelcomeEmail(user, requestUrl);
  return sendAppEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}
