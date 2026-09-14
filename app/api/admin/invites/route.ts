import { NextRequest, NextResponse } from "next/server";

import { createToken, currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";
import { appBaseUrl, escapeHtml, sendAppEmail } from "@/lib/server/email";
import { hashSecretToken } from "@/lib/server/tokens";

export const runtime = "nodejs";

type InviteRoleInput = {
  role?: string;
  teamId?: string;
  clubId?: string;
};

async function assertAdministrator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Administrator access is required.");
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const administrator = await assertAdministrator();
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const deliveryEmail = process.env.INVITE_EMAIL_TEST_TO?.trim() || email;
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const clubId = String(body.clubId ?? "").trim();
    const administratorInvite = Boolean(body.administrator);
    const roles = Array.isArray(body.roles) ? body.roles as InviteRoleInput[] : [{ role: body.role, teamId: body.teamId, clubId: body.clubId }];
    const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

    if (!email || !name || !clubId) {
      return NextResponse.json({ error: "Name, email and club are required." }, { status: 400 });
    }

    const normalizedRoles = roles
      .map((item) => ({
        role: String(item.role ?? "").trim(),
        teamId: String(item.teamId ?? "").trim(),
        clubId: String(item.clubId ?? clubId).trim()
      }))
      .filter((item) => ["Player", "Manager", "Club Member", "Club Admin"].includes(item.role));

    if (!normalizedRoles.length && !administratorInvite) {
      return NextResponse.json({ error: "Add at least one role or administrator access." }, { status: 400 });
    }

    const code = `IS-${createToken(8).toUpperCase()}`;
    const inviteToken = createToken(32);
    const inviteTokenHash = hashSecretToken(inviteToken);
    const invitation = await withTransaction(async (client) => {
      const clubResult = await client.query("select id, name, logo_path, primary_color, accent_color from public.club where id = $1 and active = true limit 1", [clubId]);
      const club = clubResult.rows[0];
      if (!club) throw new Error("Club not found.");

      const teamRoles = normalizedRoles.filter((item) => item.role === "Player" || item.role === "Manager");
      const memberRoles = normalizedRoles.filter((item) => item.role === "Club Member" || item.role === "Club Admin");
      const invitedRole = teamRoles[0]?.role ?? "Player";

      const invitationResult = await client.query(
        `insert into public.invitation (email, phone, invitation_code, invitation_token_hash, invited_person_name, invited_club_id, invited_role, invite_administrator, expires_at, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10)
         returning id, invitation_code`,
        [email, phone || null, code, inviteTokenHash, name, clubId, invitedRole, administratorInvite, expiresAt.toISOString(), administrator.personId]
      );
      const invitationId = invitationResult.rows[0].id;

      for (const inviteRole of teamRoles) {
        const teamResult = await client.query("select id, name from public.team where id = $1 and club_id = $2 and active = true limit 1", [inviteRole.teamId, clubId]);
        if (!teamResult.rows[0]) throw new Error(`Team role ${inviteRole.role} needs a valid team for this club.`);
        await client.query(
          "insert into public.invitation_membership (invitation_id, team_id, role) values ($1, $2, $3) on conflict do nothing",
          [invitationId, inviteRole.teamId, inviteRole.role]
        );
      }

      for (const inviteRole of memberRoles) {
        await client.query(
          "insert into public.invitation_club_membership (invitation_id, club_id, role) values ($1, $2, $3) on conflict do nothing",
          [invitationId, inviteRole.clubId || clubId, inviteRole.role]
        );
      }

      const activationUrl = new URL(`/activate?token=${encodeURIComponent(inviteToken)}`, appBaseUrl(request.url)).toString();
      const roleSummary = [
        ...teamRoles.map((item) => `${item.role} role`),
        ...memberRoles.map((item) => item.role),
        administratorInvite ? "Administrator" : ""
      ].filter(Boolean).join(", ");
      const subject = "You have been invited to join Interclub Snooker";
      const bodyText = [
        `Hi ${name},`,
        "",
        `You have been invited to join Interclub Snooker for ${club.name}.`,
        `Role access: ${roleSummary || "Platform access"}.`,
        "",
        `Click here to join: ${activationUrl}`,
        "",
        deliveryEmail !== email ? `For testing this invite email is delivered to ${deliveryEmail}.` : ""
      ].join("\n");
      const bodyHtml = `
        <div style="margin:0;background:#f3f6f8;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#10233f">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dfe7ee;box-shadow:0 18px 48px rgba(16,35,63,.14)">
            <div style="background:linear-gradient(135deg,${club.primary_color || "#10233f"} 0%,${club.accent_color || "#1b8a72"} 100%);padding:30px 28px;color:white">
              <div style="display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Interclub Snooker</div>
              <h1 style="margin:18px 0 8px;font-size:34px;line-height:1.02;letter-spacing:-.02em">You have been invited</h1>
              <p style="margin:0;font-size:16px;font-weight:700;opacity:.84">Join ${escapeHtml(club.name)} on the Interclub Snooker platform.</p>
            </div>
            <div style="padding:28px">
              <p style="font-size:18px;font-weight:800;margin:0 0 12px">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 18px;line-height:1.55;color:#4e6074;font-weight:600">Your club or league administrator has set up an account invitation for you. Use the button below to activate your account securely.</p>
              <div style="background:#f5f7fa;border:1px solid #e5ebf1;border-radius:16px;padding:16px;margin-bottom:22px">
                <p style="margin:0 0 6px;color:#6c7788;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Your access</p>
                <p style="margin:0;font-size:17px;font-weight:900;color:#10233f">${escapeHtml(roleSummary || "Platform access")}</p>
              </div>
              <a href="${activationUrl}" style="display:block;text-align:center;background:${club.accent_color || "#1b8a72"};color:white;text-decoration:none;font-weight:900;padding:15px 20px;border-radius:14px;font-size:16px">Activate your account</a>
              <p style="margin:18px 0 0;color:#6c7788;font-size:13px;line-height:1.45">This link is unique to you and expires on ${escapeHtml(expiresAt.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }))}. If you were not expecting this invitation, you can ignore this email.</p>
            </div>
          </div>
        </div>`;

      const emailResult = await sendAppEmail({ to: deliveryEmail, subject, html: bodyHtml, text: bodyText });

      const emailInsert = await client.query(
        `insert into public.invitation_email (invitation_id, to_email, subject, body_html, body_text, status)
         values ($1, $2, $3, $4, $5, 'Queued')
         returning id`,
        [invitationId, deliveryEmail, subject, bodyHtml, bodyText]
      );
      await client.query(
        `update public.invitation_email
         set status = $2,
             sent_at = case when $2 = 'Sent' then now() else sent_at end
         where id = $1`,
        [emailInsert.rows[0]?.id, emailResult.status]
      );
      if (emailResult.status === "Sent") {
        await client.query("update public.invitation set sent_at = now() where id = $1", [invitationId]);
      }

      return { ...invitationResult.rows[0], activation_url: activationUrl, email_to: deliveryEmail, email_subject: subject, email_preview: bodyText, email_status: emailResult.status, email_error: emailResult.error };
    });

    return NextResponse.json({
      ok: true,
      invitation_code: invitation.invitation_code,
      activation_url: invitation.activation_url,
      email_to: invitation.email_to,
      email_status: invitation.email_status,
      email_error: invitation.email_error,
      email_subject: invitation.email_subject,
      email_preview: invitation.email_preview
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invite." },
      { status: 400 }
    );
  }
}
