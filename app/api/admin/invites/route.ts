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

type InviteEmailContent = {
  activationUrl: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

type ExistingPersonInviteResult = {
  personId: string;
  email: string;
  name: string;
  status: "Sent" | "Queued" | "Failed" | "Skipped";
  error?: string;
};

const garryInviteBcc = "garlyons@gmail.com";

function inviteBcc(enabled: unknown) {
  return enabled === true ? garryInviteBcc : undefined;
}

async function assertAdministrator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Administrator access is required.");
  return user;
}

function buildInviteEmail({
  request,
  inviteToken,
  email,
  name,
  club,
  roleLabels,
  expiresAt,
  isClubOnlyInvite
}: {
  request: NextRequest;
  inviteToken: string;
  email: string;
  name: string;
  club: { name: string; logo_path?: string | null; primary_color?: string | null; accent_color?: string | null };
  roleLabels: string[];
  expiresAt: Date;
  isClubOnlyInvite: boolean;
}): InviteEmailContent {
  const publicBaseUrl = appBaseUrl(request.url);
  const activationUrl = new URL(`/activate?token=${encodeURIComponent(inviteToken)}`, publicBaseUrl).toString();
  const logoUrl = club.logo_path ? new URL(club.logo_path, publicBaseUrl).toString() : "";
  const roleSummary = roleLabels.join("\n");
  const roleSummaryHtml = roleLabels.length
    ? roleLabels.map((role) => `<span style="display:block">${escapeHtml(role)}</span>`).join("")
    : "Platform access";
  const roleCount = roleLabels.length;
  const roleLabel = roleCount > 1 ? "Your roles" : "Your role";
  const welcomeHeadline = isClubOnlyInvite
    ? `Welcome to the ${club.name} Snooker platform.`
    : "Welcome to the Interclub Snooker Platform.";
  const welcomeBody = isClubOnlyInvite
    ? `${club.name} has invited you to activate your club snooker account.`
    : `${club.name} has invited you to activate your Interclub Snooker account.`;
  const subject = "You have been invited to join Interclub Snooker";
  const bodyText = [
    `Hi ${name},`,
    "",
    welcomeHeadline,
    welcomeBody,
    `${roleLabel}: ${roleSummary || "Platform access"}.`,
    "",
    `Click here to join: ${activationUrl}`
  ].join("\n");
  const bodyHtml = `
        <style>
          body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          .invite-shell { padding: 28px 16px; }
          .invite-card { width: 100%; max-width: 640px; }
          .invite-hero { padding: 30px 28px; }
          .invite-logo { width: 62px; height: 62px; border-radius: 18px; }
          .invite-logo img { max-width: 52px; max-height: 52px; }
          .invite-kicker { font-size: 12px; }
          .invite-title { font-size: 34px; line-height: 1.02; }
          .invite-subtitle { font-size: 16px; line-height: 1.35; }
          .invite-body { padding: 28px; }
          .invite-greeting { font-size: 18px; }
          .invite-copy { font-size: 16px; line-height: 1.55; }
          .invite-role-value { font-size: 17px; line-height: 1.25; }
          .invite-button { font-size: 16px; }
          @media only screen and (max-width: 480px) {
            .invite-shell { padding: 12px 8px !important; }
            .invite-card { border-radius: 18px !important; }
            .invite-hero { padding: 22px 20px !important; }
            .invite-brand { display: block !important; }
            .invite-logo { width: 54px !important; height: 54px !important; border-radius: 15px !important; margin-bottom: 12px !important; }
            .invite-logo img { max-width: 46px !important; max-height: 46px !important; }
            .invite-kicker { font-size: 10px !important; padding: 6px 10px !important; letter-spacing: .05em !important; }
            .invite-title { font-size: 28px !important; line-height: 1.05 !important; margin-top: 16px !important; }
            .invite-subtitle { font-size: 14px !important; line-height: 1.35 !important; }
            .invite-body { padding: 22px 20px !important; }
            .invite-greeting { font-size: 16px !important; }
            .invite-copy { font-size: 14px !important; line-height: 1.5 !important; }
            .invite-role { padding: 14px !important; border-radius: 14px !important; }
            .invite-role-label { font-size: 10px !important; }
            .invite-role-value { font-size: 15px !important; line-height: 1.28 !important; }
            .invite-button { font-size: 15px !important; padding: 14px 16px !important; border-radius: 12px !important; }
            .invite-footer { font-size: 12px !important; line-height: 1.45 !important; }
          }
        </style>
        <div class="invite-shell" style="margin:0;background:#f3f6f8;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#10233f;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
          <div class="invite-card" style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dfe7ee;box-shadow:0 18px 48px rgba(16,35,63,.14)">
            <div class="invite-hero" style="background:linear-gradient(135deg,${club.primary_color || "#10233f"} 0%,${club.accent_color || "#1b8a72"} 100%);padding:30px 28px;color:white">
              <div class="invite-brand" style="display:flex;align-items:center;gap:14px">
                ${logoUrl ? `<div class="invite-logo" style="width:62px;height:62px;border-radius:18px;background:#ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 34px rgba(0,0,0,.18);overflow:hidden"><img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="${escapeHtml(club.name)} crest" style="display:block;max-width:52px;max-height:52px;object-fit:contain;border:0" /></div>` : ""}
                <div class="invite-kicker" style="display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">Interclub Snooker</div>
              </div>
              <h1 class="invite-title" style="margin:18px 0 8px;font-size:34px;line-height:1.02;letter-spacing:-.02em">You have been invited</h1>
              <p class="invite-subtitle" style="margin:0;font-size:16px;line-height:1.35;font-weight:700;opacity:.9">${escapeHtml(welcomeHeadline)}</p>
            </div>
            <div class="invite-body" style="padding:28px">
              <p class="invite-greeting" style="font-size:18px;font-weight:800;margin:0 0 12px">Hi ${escapeHtml(name)},</p>
              <p class="invite-copy" style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#4e6074;font-weight:600">${escapeHtml(welcomeBody)} Use the button below to activate your account securely.</p>
              <div class="invite-role" style="background:#f5f7fa;border:1px solid #e5ebf1;border-radius:16px;padding:16px;margin-bottom:22px">
                <p class="invite-role-label" style="margin:0 0 6px;color:#6c7788;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em">${roleLabel}</p>
                <p class="invite-role-value" style="margin:0;font-size:17px;line-height:1.25;font-weight:900;color:#10233f">${roleSummaryHtml}</p>
              </div>
              <a class="invite-button" href="${activationUrl}" style="display:block;text-align:center;background:${club.accent_color || "#1b8a72"};color:white;text-decoration:none;font-weight:900;padding:15px 20px;border-radius:14px;font-size:16px">Activate your account</a>
              <p class="invite-footer" style="margin:18px 0 0;color:#6c7788;font-size:13px;line-height:1.45">This link is unique to you and expires on ${escapeHtml(expiresAt.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }))}. If you were not expecting this invitation, you can ignore this email.</p>
            </div>
          </div>
        </div>`;

  return { activationUrl, subject, bodyHtml, bodyText };
}

export async function POST(request: NextRequest) {
  try {
    const administrator = await assertAdministrator();
    const body = await request.json();
    const bcc = inviteBcc(body.bccGarry);
    const personIds: string[] = Array.isArray(body.personIds)
      ? Array.from(new Set(body.personIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean)))
      : [];

    if (personIds.length) {
      const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
      const results: ExistingPersonInviteResult[] = [];

      for (const personId of personIds) {
        try {
          const result = await withTransaction(async (client) => {
            const personResult = await client.query<{
              id: string;
              first_name: string;
              last_name: string;
              email: string | null;
              phone: string | null;
              invite_administrator: boolean;
              club_id: string;
              club_name: string;
              logo_path: string | null;
              primary_color: string | null;
              accent_color: string | null;
            }>(
              `with primary_club as (
                 select cm.club_id
                 from public.club_membership cm
                 where cm.person_id = $1
                   and cm.active = true
                 order by cm.created_at desc
                 limit 1
               )
               select
                 p.id,
                 p.first_name,
                 p.last_name,
                 p.email,
                 p.phone,
                 exists (
                   select 1
                   from public.app_operator ao
                   where ao.person_id = p.id
                     and ao.active = true
                 ) as invite_administrator,
                 c.id as club_id,
                 c.name as club_name,
                 c.logo_path,
                 c.primary_color,
                 c.accent_color
               from public.person p
               join primary_club pc on true
               join public.club c on c.id = pc.club_id
               where p.id = $1
                 and p.active = true
               limit 1
               for update of p`,
              [personId]
            );
            const person = personResult.rows[0];
            if (!person) throw new Error("Person was not found or has no active club.");
            if (!person.email) throw new Error("Person does not have an email address.");

            const existingInvite = await client.query<{ id: string; status: string }>(
              `select id, status::text
               from public.invitation
               where lower(email) = lower($1)
                 and status = 'Pending'
                 and expires_at > now()
               order by created_at desc
               limit 1`,
              [person.email]
            );
            if (existingInvite.rows[0]) {
              return {
                personId: person.id,
                email: person.email,
                name: `${person.first_name} ${person.last_name}`.trim(),
                status: "Skipped" as const,
                error: "Pending invite already exists"
              };
            }

            const teamRoles = await client.query<{ team_id: string; role: string; team_name: string }>(
              `select distinct on (ptr.league_id, ptr.team_name, ptr.role)
                 t.id as team_id,
                 ptr.role::text as role,
                 ptr.team_name
               from public.person_team_role ptr
               join public.team t
                 on t.club_id = ptr.club_id
                and t.league_id = ptr.league_id
                and t.name = ptr.team_name
                and t.active = true
               join public.season s on s.id = t.season_id
               where ptr.person_id = $1
                 and ptr.active = true
                 and ptr.role in ('Player', 'Manager')
               order by ptr.league_id, ptr.team_name, ptr.role, s.starts_on desc nulls last, s.name desc`,
              [person.id]
            );
            const clubRoles = await client.query<{ club_id: string; role: string }>(
              `select cm.club_id, 'Club Member' as role
               from public.club_membership cm
               where cm.person_id = $1
                 and cm.active = true
                 and not exists (
                   select 1
                   from public.person_team_role ptr
                   where ptr.person_id = cm.person_id
                     and ptr.club_id = cm.club_id
                     and ptr.active = true
                 )
               union
               select ca.club_id, 'Club Admin' as role
               from public.club_admin ca
               where ca.person_id = $1
                 and ca.active = true
               order by role`,
              [person.id]
            );

            if (!teamRoles.rowCount && !clubRoles.rowCount && !person.invite_administrator) {
              throw new Error("Person has no role to invite.");
            }

            const code = `IS-${createToken(8).toUpperCase()}`;
            const inviteToken = createToken(32);
            const invitedRole = teamRoles.rows[0]?.role ?? "Player";
            const invitationResult = await client.query<{ id: string; invitation_code: string }>(
              `insert into public.invitation (email, phone, invitation_code, invitation_token_hash, invited_person_name, invited_club_id, invited_role, invite_administrator, expires_at, status, created_by)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10)
               returning id, invitation_code`,
              [
                person.email,
                person.phone,
                code,
                hashSecretToken(inviteToken),
                `${person.first_name} ${person.last_name}`.trim(),
                person.club_id,
                invitedRole,
                person.invite_administrator,
                expiresAt.toISOString(),
                administrator.personId
              ]
            );
            const invitationId = invitationResult.rows[0].id;

            for (const role of teamRoles.rows) {
              await client.query(
                `insert into public.invitation_membership (invitation_id, team_id, role)
                 values ($1, $2, $3)
                 on conflict do nothing`,
                [invitationId, role.team_id, role.role]
              );
            }

            for (const role of clubRoles.rows) {
              await client.query(
                `insert into public.invitation_club_membership (invitation_id, club_id, role)
                 values ($1, $2, $3)
                 on conflict do nothing`,
                [invitationId, role.club_id, role.role]
              );
            }

            const roleLabels = [
              ...teamRoles.rows.map((role) => `${role.role} - ${role.team_name}`),
              ...clubRoles.rows.map((role) => role.role),
              person.invite_administrator ? "Administrator" : ""
            ].filter(Boolean);
            const { subject, bodyHtml, bodyText } = buildInviteEmail({
              request,
              inviteToken,
              email: person.email,
              name: `${person.first_name} ${person.last_name}`.trim(),
              club: {
                name: person.club_name,
                logo_path: person.logo_path,
                primary_color: person.primary_color,
                accent_color: person.accent_color
              },
              roleLabels,
              expiresAt,
              isClubOnlyInvite: !teamRoles.rowCount && (clubRoles.rowCount ?? 0) > 0
            });
            const emailResult = await sendAppEmail({ to: person.email, bcc, subject, html: bodyHtml, text: bodyText });
            const emailInsert = await client.query(
              `insert into public.invitation_email (invitation_id, to_email, subject, body_html, body_text, status)
               values ($1, $2, $3, $4, $5, 'Queued')
               returning id`,
              [invitationId, person.email, subject, bodyHtml, bodyText]
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

            return {
              personId: person.id,
              email: person.email,
              name: `${person.first_name} ${person.last_name}`.trim(),
              status: emailResult.status as ExistingPersonInviteResult["status"],
              error: emailResult.error
            };
          });
          results.push(result);
        } catch (error) {
          results.push({
            personId,
            email: "",
            name: "",
            status: "Failed",
            error: error instanceof Error ? error.message : "Could not send invite."
          });
        }
      }

      return NextResponse.json({ ok: true, results });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
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
      const teamRoleLabels: string[] = [];

      for (const inviteRole of teamRoles) {
        const teamResult = await client.query("select id, name from public.team where id = $1 and club_id = $2 and active = true limit 1", [inviteRole.teamId, clubId]);
        if (!teamResult.rows[0]) throw new Error(`Team role ${inviteRole.role} needs a valid team for this club.`);
        teamRoleLabels.push(`${inviteRole.role} - ${teamResult.rows[0].name}`);
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

      const roleLabels = [
        ...teamRoleLabels,
        ...memberRoles.map((item) => item.role),
        administratorInvite ? "Administrator" : ""
      ].filter(Boolean);
      const isClubOnlyInvite = teamRoles.length === 0 && memberRoles.length > 0;
      const { activationUrl, subject, bodyHtml, bodyText } = buildInviteEmail({
        request,
        inviteToken,
        email,
        name,
        club,
        roleLabels,
        expiresAt,
        isClubOnlyInvite
      });

      const emailResult = await sendAppEmail({ to: email, bcc, subject, html: bodyHtml, text: bodyText });

      const emailInsert = await client.query(
        `insert into public.invitation_email (invitation_id, to_email, subject, body_html, body_text, status)
         values ($1, $2, $3, $4, $5, 'Queued')
         returning id`,
        [invitationId, email, subject, bodyHtml, bodyText]
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

      return { ...invitationResult.rows[0], activation_url: activationUrl, email_to: email, email_subject: subject, email_preview: bodyText, email_status: emailResult.status, email_error: emailResult.error };
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

export async function PATCH(request: NextRequest) {
  try {
    await assertAdministrator();
    const body = await request.json();
    const bcc = inviteBcc(body.bccGarry);
    const invitationId = String(body.invitationId ?? "").trim();

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation is required." }, { status: 400 });
    }

    const resent = await withTransaction(async (client) => {
      const invitationResult = await client.query<{
        id: string;
        email: string;
        invited_person_name: string;
        invited_club_id: string;
        invite_administrator: boolean;
        status: string;
        expires_at: string;
        club_name: string;
        logo_path: string | null;
        primary_color: string | null;
        accent_color: string | null;
      }>(
        `select
           i.id,
           i.email,
           i.invited_person_name,
           i.invited_club_id,
           i.invite_administrator,
           i.status::text,
           i.expires_at::text,
           c.name as club_name,
           c.logo_path,
           c.primary_color,
           c.accent_color
         from public.invitation i
         join public.club c on c.id = i.invited_club_id
         where i.id = $1
         limit 1
         for update`,
        [invitationId]
      );
      const invitation = invitationResult.rows[0];
      if (!invitation) throw new Error("Invitation not found.");
      if (invitation.status !== "Pending") throw new Error(`Invitation is ${invitation.status.toLowerCase()} and cannot be resent.`);
      if (new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("Invitation has expired. Create a new invite.");

      const teamRoles = await client.query<{ role: string; team_name: string }>(
        `select im.role::text as role, t.name as team_name
         from public.invitation_membership im
         join public.team t on t.id = im.team_id
         where im.invitation_id = $1
         order by t.name, im.role::text`,
        [invitationId]
      );
      const memberRoles = await client.query<{ role: string }>(
        `select role
         from public.invitation_club_membership
         where invitation_id = $1
         order by role`,
        [invitationId]
      );

      const inviteToken = createToken(32);
      const roleLabels = [
        ...teamRoles.rows.map((role) => `${role.role} - ${role.team_name}`),
        ...memberRoles.rows.map((role) => role.role),
        invitation.invite_administrator ? "Administrator" : ""
      ].filter(Boolean);
      const { activationUrl, subject, bodyHtml, bodyText } = buildInviteEmail({
        request,
        inviteToken,
        email: invitation.email,
        name: invitation.invited_person_name,
        club: {
          name: invitation.club_name,
          logo_path: invitation.logo_path,
          primary_color: invitation.primary_color,
          accent_color: invitation.accent_color
        },
        roleLabels,
        expiresAt: new Date(invitation.expires_at),
        isClubOnlyInvite: !teamRoles.rows.length && memberRoles.rows.length > 0
      });

      const emailResult = await sendAppEmail({ to: invitation.email, bcc, subject, html: bodyHtml, text: bodyText });
      if (emailResult.status !== "Failed") {
        await client.query(
          "update public.invitation set invitation_token_hash = $2 where id = $1",
          [invitationId, hashSecretToken(inviteToken)]
        );
      }
      const emailInsert = await client.query(
        `insert into public.invitation_email (invitation_id, to_email, subject, body_html, body_text, status)
         values ($1, $2, $3, $4, $5, 'Queued')
         returning id`,
        [invitationId, invitation.email, subject, bodyHtml, bodyText]
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

      return {
        activation_url: activationUrl,
        email_to: invitation.email,
        email_status: emailResult.status,
        email_error: emailResult.error
      };
    });

    return NextResponse.json({ ok: true, ...resent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resend invite." },
      { status: 400 }
    );
  }
}
