import { NextRequest, NextResponse } from "next/server";

import { createToken, currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

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
    const deliveryEmail = "garlyons@gmail.com";
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
    const invitation = await withTransaction(async (client) => {
      const clubResult = await client.query("select id, name, logo_path, primary_color, accent_color from public.club where id = $1 and active = true limit 1", [clubId]);
      const club = clubResult.rows[0];
      if (!club) throw new Error("Club not found.");

      const teamRoles = normalizedRoles.filter((item) => item.role === "Player" || item.role === "Manager");
      const memberRoles = normalizedRoles.filter((item) => item.role === "Club Member" || item.role === "Club Admin");
      const invitedRole = teamRoles[0]?.role ?? "Player";

      const invitationResult = await client.query(
        `insert into public.invitation (email, phone, invitation_code, invited_person_name, invited_club_id, invited_role, invite_administrator, expires_at, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending', $9)
         returning id, invitation_code`,
        [email, phone || null, code, name, clubId, invitedRole, administratorInvite, expiresAt.toISOString(), administrator.personId]
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

      const activationUrl = new URL(`/activate?invite=${encodeURIComponent(invitationResult.rows[0].invitation_code)}`, request.url).toString();
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
        "For testing this invite email is delivered to garlyons@gmail.com."
      ].join("\n");
      const bodyHtml = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f4f6f8;padding:24px;color:#10233f">
          <div style="max-width:560px;margin:0 auto;background:white;border-radius:18px;overflow:hidden;border:1px solid #dfe5ec">
            <div style="background:${club.primary_color || "#10233f"};padding:24px;color:white">
              <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;opacity:.75">Interclub Snooker League</p>
              <h1 style="margin:0;font-size:28px;line-height:1.05">You have been invited</h1>
            </div>
            <div style="padding:24px">
              <p style="font-size:17px;font-weight:700;margin:0 0 12px">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;line-height:1.5">You have been invited to join Interclub Snooker for <strong>${escapeHtml(club.name)}</strong>.</p>
              <div style="background:#f4f6f8;border-left:5px solid ${club.accent_color || "#1b8a72"};padding:14px 16px;border-radius:10px;margin-bottom:20px">
                <strong>Role access</strong><br />${escapeHtml(roleSummary || "Platform access")}
              </div>
              <a href="${activationUrl}" style="display:inline-block;background:${club.accent_color || "#1b8a72"};color:white;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px">Click here to join</a>
              <p style="margin:20px 0 0;color:#607086;font-size:13px">For testing, this email is queued to ${deliveryEmail}.</p>
            </div>
          </div>
        </div>`;

      await client.query(
        `insert into public.invitation_email (invitation_id, to_email, subject, body_html, body_text, status)
         values ($1, $2, $3, $4, $5, 'Queued')`,
        [invitationId, deliveryEmail, subject, bodyHtml, bodyText]
      );

      return { ...invitationResult.rows[0], activation_url: activationUrl, email_to: deliveryEmail, email_subject: subject, email_preview: bodyText };
    });

    return NextResponse.json({
      ok: true,
      invitation_code: invitation.invitation_code,
      activation_url: invitation.activation_url,
      email_to: invitation.email_to,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
