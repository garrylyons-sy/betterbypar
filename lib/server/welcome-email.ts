import { appBaseUrl, escapeHtml, sendAppEmail } from "@/lib/server/email";
import { dbQuery } from "@/lib/server/db";
import type { AppUser } from "@/lib/server/auth";

type WelcomeClubBrand = {
  name: string;
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
};

async function loadWelcomeClubBrand(personId: string): Promise<WelcomeClubBrand | null> {
  const { rows } = await dbQuery<WelcomeClubBrand>(
    `select
       c.name,
       c.logo_path as "logoPath",
       c.primary_color as "primaryColor",
       c.accent_color as "accentColor"
     from public.club_membership cm
     join public.club c on c.id = cm.club_id
     where cm.person_id = $1
       and cm.active = true
       and c.active = true
     order by cm.is_club_admin desc, cm.created_at asc
     limit 1`,
    [personId]
  );
  return rows[0] ?? null;
}

export function buildWelcomeEmail(user: AppUser, requestUrl?: string, club?: WelcomeClubBrand | null) {
  const baseUrl = appBaseUrl(requestUrl);
  const appUrl = `${baseUrl}/`;
  const logoUrl = club?.logoPath ? new URL(club.logoPath, baseUrl).toString() : "";
  const primaryColor = club?.primaryColor || "#10233f";
  const accentColor = club?.accentColor || "#1b8a72";
  const firstName = user.name.split(" ")[0] || "there";
  const subject = "Welcome to Better By Par";
  const text = [
    `Hi ${firstName},`,
    "",
    "Welcome to the Better By Par. Your account is active and ready to use.",
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
        <div style="background:linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%);padding:28px;color:#ffffff">
          <div style="display:flex;align-items:center;gap:14px;margin:0 0 16px">
            ${logoUrl ? `<div style="width:58px;height:58px;border-radius:16px;background:#ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 34px rgba(0,0,0,.18);overflow:hidden"><img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="${escapeHtml(club?.name ?? "Club")} crest" style="display:block;max-width:48px;max-height:48px;object-fit:contain;border:0" /></div>` : ""}
            <p style="margin:0;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.72)">Better By Par</p>
          </div>
          <h1 style="margin:0;font-size:30px;line-height:1.08;font-weight:900">Welcome to the platform</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.45;font-weight:700;color:rgba(255,255,255,.84)">Your account is active${club?.name ? ` for ${escapeHtml(club.name)}` : ""} and ready to use.</p>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 14px;font-size:18px;font-weight:850">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#4e6074;font-weight:650">
            Thanks for activating your Better By Par account. You can now sign in and use the app from your phone, tablet or computer.
          </p>
          <div style="background:#f5f7fa;border:1px solid #e5ebf1;border-radius:16px;padding:16px;margin:0 0 22px">
            <p style="margin:0 0 4px;color:#6c7788;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Quick tip</p>
            <p style="margin:0;font-size:15px;line-height:1.45;font-weight:750;color:#10233f">Bookmark the app in your browser so it is one tap away on match nights.</p>
          </div>
          <a href="${escapeHtml(appUrl)}" style="display:block;text-align:center;background:${accentColor};color:white;text-decoration:none;font-weight:900;padding:15px 20px;border-radius:14px;font-size:16px">Open Better By Par</a>
          <p style="margin:18px 0 0;color:#6c7788;font-size:13px;line-height:1.45">
            Link: <a href="${escapeHtml(appUrl)}" style="color:${accentColor};font-weight:800">${escapeHtml(appUrl)}</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, html, text };
}

export async function sendWelcomeEmail(user: AppUser, requestUrl?: string) {
  if (!user.email) return { status: "Queued" as const, error: "No email address on account." };
  const club = await loadWelcomeClubBrand(user.personId);
  const email = buildWelcomeEmail(user, requestUrl, club);
  return sendAppEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}
