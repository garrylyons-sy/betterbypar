import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { PoolClient } from "pg";

import { loadAppearanceConfig } from "@/lib/server/appearance";
import { dbQuery, withTransaction } from "@/lib/server/db";
import { hashSecretToken } from "@/lib/server/tokens";
import type { PlayerBreakStat, PlayerGameResult, Role, Standing, TeamContext } from "@/lib/types";

export const sessionCookieName = "is_session";
const knownDeviceCookieName = "is_known_device";
const oauthStateCookieName = "is_oauth_state";
const oauthNextCookieName = "is_oauth_next";
const oauthInviteCookieName = "is_oauth_invite";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile_image: string | null;
};

type AccountRow = {
  id: string;
  person_id: string;
  username: string;
  google_id: string | null;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  profile_image: string | null;
  active: boolean;
};

export type AppUser = {
  accountId: string;
  personId: string;
  username: string;
  email: string;
  name: string;
  profileImage: string;
};

async function publicOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3500";
  const proto = headerList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function googleRedirectUri() {
  const origin = await publicOrigin();
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${origin}/auth/google/callback`;
  }
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`;
}

export function createToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function usernameFromEmail(email: string) {
  return email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, "") || "player";
}

export function hashPassword(password: string) {
  const salt = createToken(16);
  const hash = crypto.scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [method, salt, hash] = storedHash.split("$");
  if (method !== "scrypt" || !salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function setSessionCookie(accountId: string) {
  const sessionId = `session_${createToken(32)}`;
  await dbQuery(
    `insert into public.app_session (id, user_account_id, expires_at)
     values ($1, $2, now() + interval '30 days')`,
    [sessionId, accountId]
  );

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: (await publicOrigin()).startsWith("https://"),
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
  cookieStore.set(knownDeviceCookieName, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: (await publicOrigin()).startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;
  if (sessionId) {
    await dbQuery("delete from public.app_session where id = $1", [sessionId]).catch(() => {});
  }
  cookieStore.delete(sessionCookieName);
}

export async function setOAuthCookies(state: string, nextPath: string, invitationCode?: string | null) {
  const cookieStore = await cookies();
  const secure = (await publicOrigin()).startsWith("https://");
  cookieStore.set(oauthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600
  });
  if (nextPath && nextPath.startsWith("/")) {
    cookieStore.set(oauthNextCookieName, nextPath, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600
    });
  }
  if (invitationCode) {
    cookieStore.set(oauthInviteCookieName, invitationCode, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600
    });
  }
}

export function readOAuthCookies() {
  return cookies().then((cookieStore) => ({
    state: cookieStore.get(oauthStateCookieName)?.value,
    next: cookieStore.get(oauthNextCookieName)?.value,
    invitationCode: cookieStore.get(oauthInviteCookieName)?.value
  }));
}

export async function clearOAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(oauthStateCookieName);
  cookieStore.delete(oauthNextCookieName);
  cookieStore.delete(oauthInviteCookieName);
}

export async function currentUser() {
  const sessionId = (await cookies()).get(sessionCookieName)?.value;
  if (!sessionId) return null;

  const { rows } = await dbQuery<AccountRow>(
    `select
       ua.id,
       ua.person_id,
       ua.username,
       ua.google_id,
       ua.password_hash,
       ua.active,
       p.first_name,
       p.last_name,
       p.email,
       p.profile_image
     from public.app_session s
     join public.user_account ua on ua.id = s.user_account_id
     join public.person p on p.id = ua.person_id
     where s.id = $1
       and s.expires_at > now()
       and ua.active = true
       and p.active = true
     limit 1`,
    [sessionId]
  );

  const account = rows[0];
  if (!account) return null;

  return {
    accountId: account.id,
    personId: account.person_id,
    username: account.username,
    email: account.email ?? "",
    name: `${account.first_name} ${account.last_name}`.trim(),
    profileImage: account.profile_image ?? ""
  } satisfies AppUser;
}

export async function testUserFromEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  if (!normalizedEmail.endsWith("@notrealmail.com")) return null;

  const account = await accountByLoginIdentifier(normalizedEmail);
  if (!account || !account.active) return null;

  return {
    accountId: account.id,
    personId: account.person_id,
    username: account.username,
    email: account.email ?? normalizedEmail,
    name: `${account.first_name} ${account.last_name}`.trim(),
    profileImage: account.profile_image ?? ""
  } satisfies AppUser;
}

export async function currentUserFromRequest(request: Request) {
  const url = new URL(request.url);
  return await testUserFromEmail(url.searchParams.get("testUser")) ?? await currentUser();
}

export async function accountByLoginIdentifier(identifier: string) {
  const { rows } = await dbQuery<AccountRow>(
    `select
       ua.id,
       ua.person_id,
       ua.username,
       ua.google_id,
       ua.password_hash,
       ua.active,
       p.first_name,
       p.last_name,
       p.email,
       p.profile_image
     from public.user_account ua
     join public.person p on p.id = ua.person_id
     where ua.active = true
       and p.active = true
       and (
         lower(ua.username) = lower($1)
         or lower(p.email) = lower($1)
       )
     limit 1`,
    [identifier.trim()]
  );
  return rows[0] ?? null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() || "Player";
  return {
    firstName,
    lastName: parts.join(" ") || ""
  };
}

async function uniqueUsername(client: PoolClient, baseUsername: string) {
  const cleaned = baseUsername.toLowerCase().replace(/[^a-z0-9_]+/g, "") || "player";
  let candidate = cleaned;
  let suffix = 1;

  while (true) {
    const { rowCount } = await client.query(
      "select 1 from public.user_account where lower(username) = lower($1) limit 1",
      [candidate]
    );
    if (!rowCount) return candidate;
    suffix += 1;
    candidate = `${cleaned.slice(0, 20)}_${suffix}`;
  }
}

export async function claimInvitationForAccount({
  email,
  username,
  passwordHash,
  googleId,
  profileImage,
  invitationCode
}: {
  email: string;
  username?: string;
  passwordHash?: string | null;
  googleId?: string | null;
  profileImage?: string | null;
  invitationCode?: string;
}) {
  const lowerEmail = email.toLowerCase();
  const inviteToken = invitationCode?.trim();
  if (!inviteToken) {
    throw new Error("A valid invitation link is required.");
  }
  const inviteTokenHash = hashSecretToken(inviteToken);

  return withTransaction(async (client) => {
    const invitationResult = await client.query(
      `select *
       from public.invitation
       where lower(email) = lower($1)
         and status = 'Pending'
         and (
           invitation_token_hash = $2
           or (
             invitation_token_hash is null
             and invitation_code = $3
           )
         )
       order by created_at desc
       limit 1
       for update`,
      [lowerEmail, inviteTokenHash, inviteToken]
    );
    const invitation = invitationResult.rows[0];

    if (!invitation) {
      throw new Error("No pending invite found for this email.");
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await client.query("update public.invitation set status = 'Expired' where id = $1", [invitation.id]);
      throw new Error("Invitation has expired.");
    }

    const membershipResult = await client.query(
      "select team_id, role from public.invitation_membership where invitation_id = $1",
      [invitation.id]
    );
    const clubMembershipResult = await client.query(
      "select club_id, role from public.invitation_club_membership where invitation_id = $1",
      [invitation.id]
    );

    if (membershipResult.rowCount === 0 && clubMembershipResult.rowCount === 0 && !invitation.invite_administrator) {
      throw new Error("Invitation has no role attached.");
    }

    const { firstName, lastName } = splitName(invitation.invited_person_name);
    let person = (await client.query<PersonRow>(
      "select * from public.person where lower(email) = lower($1) limit 1",
      [lowerEmail]
    )).rows[0];

    if (!person) {
      person = (await client.query<PersonRow>(
        `select *
         from public.person
         where email is null
           and lower(first_name) = lower($1)
           and lower(last_name) = lower($2)
         order by created_at
         limit 1`,
        [firstName, lastName]
      )).rows[0];
    }

    if (!person) {
      const result = await client.query<PersonRow>(
        `insert into public.person (first_name, last_name, email, phone, profile_image, active)
         values ($1, $2, $3, $4, $5, true)
         returning *`,
        [firstName, lastName, lowerEmail, invitation.phone ?? null, profileImage ?? null]
      );
      person = result.rows[0];
    } else {
      const result = await client.query<PersonRow>(
        `update public.person
         set email = coalesce(email, $2),
             phone = coalesce(nullif($3, ''), phone),
             profile_image = coalesce(nullif($4, ''), profile_image),
             active = true
         where id = $1
         returning *`,
        [person.id, lowerEmail, invitation.phone ?? "", profileImage ?? ""]
      );
      person = result.rows[0];
    }

    const existingAccount = (await client.query<AccountRow>(
      `select ua.*, p.first_name, p.last_name, p.email, p.profile_image
       from public.user_account ua
       join public.person p on p.id = ua.person_id
       where ua.person_id = $1
          or ($2::text is not null and ua.google_id = $2)
       limit 1`,
      [person.id, googleId ?? null]
    )).rows[0];

    const nextUsername = existingAccount?.username ?? await uniqueUsername(client, username || usernameFromEmail(lowerEmail));
    let account = existingAccount;
    if (existingAccount) {
      await client.query(
        `update public.user_account
         set password_hash = coalesce($2, password_hash),
             google_id = coalesce($3, google_id),
             last_login = now(),
             active = true
         where id = $1`,
        [existingAccount.id, passwordHash ?? null, googleId ?? null]
      );
    } else {
      account = (await client.query<AccountRow>(
        `insert into public.user_account (person_id, username, password_hash, google_id, last_login, active)
         values ($1, $2, $3, $4, now(), true)
         returning id, person_id, username, google_id, password_hash, active,
                   $5::text as first_name, $6::text as last_name, $7::text as email, $8::text as profile_image`,
        [person.id, nextUsername, passwordHash ?? null, googleId ?? null, person.first_name, person.last_name, person.email, person.profile_image]
      )).rows[0];
    }

    for (const membership of membershipResult.rows) {
      await client.query(
        `with team_scope as (
           select club_id, league_id, name as team_name
           from public.team
           where id = $1
         ),
         club_member as (
           insert into public.club_membership (club_id, person_id, role, active)
           select club_id, $2, 'Club Member', true
           from team_scope
           on conflict (club_id, person_id, role) do update
           set active = true
           returning id, club_id
         )
         insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
         select cm.id, $2, ts.club_id, ts.league_id, ts.team_name, $3, true
         from team_scope ts
         join club_member cm on cm.club_id = ts.club_id
         on conflict (club_membership_id, league_id, team_name, role) do update
         set active = true`,
        [membership.team_id, person.id, membership.role]
      );

      await client.query(
        `insert into public.team_membership (team_id, person_id, role, active)
         values ($1, $2, $3, true)
         on conflict (team_id, person_id, role) do update
         set active = true`,
        [membership.team_id, person.id, membership.role]
      );

      if (membership.role === "Player") {
        await client.query(
          `insert into public.team_membership (team_id, person_id, role, active)
           select historical_team.id, $2, $3, true
           from public.team invited_team
           join public.team historical_team
             on historical_team.name = invited_team.name
            and historical_team.club_id = invited_team.club_id
            and historical_team.league_id = invited_team.league_id
            and historical_team.active = true
           where invited_team.id = $1
           on conflict (team_id, person_id, role) do update
           set active = true`,
          [membership.team_id, person.id, membership.role]
        );
      }
    }

    for (const membership of clubMembershipResult.rows) {
      await client.query(
        `insert into public.club_membership (club_id, person_id, role, is_club_admin, active)
         values ($1, $2, 'Club Member', $3, true)
         on conflict (club_id, person_id, role) do update
         set active = true,
             is_club_admin = public.club_membership.is_club_admin or excluded.is_club_admin`,
        [membership.club_id, person.id, membership.role === "Club Admin"]
      );
      if (membership.role === "Club Admin") {
        await client.query(
          `insert into public.club_admin (club_id, person_id, active)
           values ($1, $2, true)
           on conflict (club_id, person_id) do update
           set active = true`,
          [membership.club_id, person.id]
        );
      }
    }

    if (invitation.invite_administrator) {
      await client.query(
        `insert into public.app_operator (person_id, active)
         values ($1, true)
         on conflict (person_id) do update
         set active = true`,
        [person.id]
      );
    }

    await client.query(
      "update public.invitation set status = 'Accepted', accepted_at = now() where id = $1",
      [invitation.id]
    );

    return {
      accountId: account.id,
      personId: person.id,
      username: nextUsername,
      email: person.email ?? lowerEmail,
      name: `${person.first_name} ${person.last_name}`.trim(),
      profileImage: person.profile_image ?? ""
    } satisfies AppUser;
  });
}

export async function signInExistingGoogleUser(googleId: string, email: string, profileImage?: string) {
  const lowerEmail = email.toLowerCase();
  const { rows } = await dbQuery<AccountRow>(
    `select
       ua.id,
       ua.person_id,
       ua.username,
       ua.google_id,
       ua.password_hash,
       ua.active,
       p.first_name,
       p.last_name,
       p.email,
       p.profile_image
     from public.user_account ua
     join public.person p on p.id = ua.person_id
     where ua.active = true
       and p.active = true
       and (ua.google_id = $1 or lower(p.email) = lower($2))
     limit 1`,
    [googleId, lowerEmail]
  );
  const account = rows[0];
  if (!account) return null;

  await dbQuery(
    `update public.user_account
     set google_id = coalesce(google_id, $2),
         last_login = now()
     where id = $1`,
    [account.id, googleId]
  );

  if (profileImage) {
    await dbQuery("update public.person set profile_image = coalesce(profile_image, $2) where id = $1", [account.person_id, profileImage]);
  }

  return {
    accountId: account.id,
    personId: account.person_id,
    username: account.username,
    email: account.email ?? lowerEmail,
    name: `${account.first_name} ${account.last_name}`.trim(),
    profileImage: account.profile_image ?? profileImage ?? ""
  } satisfies AppUser;
}

export async function loadTeamOptions() {
  const { rows } = await dbQuery<{
    club_id: string;
    club_name: string;
    team_id: string;
    team_name: string;
    league_name: string;
    season_name: string;
  }>(
    `select
       c.id as club_id,
       c.name as club_name,
       t.id as team_id,
       t.name as team_name,
       l.name as league_name,
       s.name as season_name
     from public.team t
     join public.club c on c.id = t.club_id
     join public.league l on l.id = t.league_id
     join public.season s on s.id = t.season_id
     where t.active = true
       and c.active = true
     order by c.name, l.name, t.name`
  );
  return rows;
}

export async function loadSessionPayload(user: AppUser) {
  const teamContexts = (await dbQuery<{
    context_id: string;
    role_assignment_id: string;
    team_id: string;
    role: Role;
    team_name: string;
    club_name: string;
    logo_path: string;
    primary_color: string;
    accent_color: string;
    league_name: TeamContext["league"];
    season_name: string;
    league_position: number | null;
    matches_played: number | null;
    matches_won: number | null;
    matches_lost: number | null;
    points_for: number | null;
    points_against: number | null;
    league_points: number | null;
  }>(
    `with role_assignments as (
       select
         ptr.id::text as role_assignment_id,
         cm.person_id,
         cm.club_id,
         ptr.league_id,
         ptr.team_name,
         ptr.role,
         ptr.active
       from public.person_team_role ptr
       join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
       where cm.person_id = $1
         and ptr.active = true
       union all
       select
         tm.id::text as role_assignment_id,
         tm.person_id,
         t.club_id,
         t.league_id,
         t.name as team_name,
         tm.role,
         tm.active
       from public.team_membership tm
       join public.team t on t.id = tm.team_id
       where tm.person_id = $1
         and tm.active = true
         and not exists (
           select 1
           from public.person_team_role ptr
           join public.club_membership cm on cm.id = ptr.club_membership_id
           where cm.person_id = tm.person_id
             and cm.club_id = t.club_id
             and ptr.league_id = t.league_id
             and ptr.team_name = t.name
             and ptr.role = tm.role
         )
     )
     select
       ra.role_assignment_id || ':' || t.id::text as context_id,
       ra.role_assignment_id,
       t.id as team_id,
       ra.role,
       t.name as team_name,
       c.name as club_name,
       c.logo_path,
       c.primary_color,
       coalesce(c.accent_color, '#10233F') as accent_color,
       l.name as league_name,
       s.name as season_name,
       ltv.position as league_position,
       ltv.matches_played,
       ltv.matches_won,
       ltv.matches_lost,
       ltv.points_for,
       ltv.points_against,
       ltv.league_points
     from role_assignments ra
     join public.team t
       on t.club_id = ra.club_id
      and t.league_id = ra.league_id
      and t.name = ra.team_name
      and t.active = true
     join public.club c on c.id = t.club_id and c.active = true
     join public.league l on l.id = t.league_id
     join public.season s on s.id = t.season_id
     left join public.league_table_view ltv on ltv.team_id = t.id
     order by coalesce(s.active, false) desc, s.name desc, l.name, t.name, ra.role`,
    [user.personId]
  )).rows.map((row) => ({
    id: row.context_id,
    personId: user.personId,
    teamId: row.team_id,
    name: row.team_name,
    club: row.club_name,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    league: row.league_name,
    season: row.season_name,
    role: row.role,
    leaguePosition: row.league_position ?? 0,
    leagueMatchesPlayed: Number(row.matches_played ?? 0),
    matchesWon: Number(row.matches_won ?? 0),
    matchesLost: Number(row.matches_lost ?? 0),
    pointsFor: Number(row.points_for ?? 0),
    pointsAgainst: Number(row.points_against ?? 0),
    leaguePoints: Number(row.league_points ?? 0)
  } satisfies TeamContext));

  const clubContexts = (await dbQuery<{
    membership_id: string;
    club_name: string;
    logo_path: string;
    primary_color: string;
    accent_color: string;
  }>(
    `select
       cm.id as membership_id,
       c.name as club_name,
       c.logo_path,
       c.primary_color,
       coalesce(c.accent_color, '#10233F') as accent_color
     from public.club_membership cm
     join public.club c on c.id = cm.club_id and c.active = true
     where cm.person_id = $1
       and cm.active = true
       and not exists (
         select 1
         from public.person_team_role ptr
         join public.club_membership role_cm on role_cm.id = ptr.club_membership_id
         where role_cm.person_id = cm.person_id
           and ptr.active = true
           and role_cm.club_id = cm.club_id
       )
     order by c.name`,
    [user.personId]
  )).rows.map((row) => ({
    id: row.membership_id,
    personId: user.personId,
    name: row.club_name,
    club: row.club_name,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    league: "A League",
    season: "Club",
    role: "Club Member",
    leaguePosition: 0,
    leagueMatchesPlayed: 0
  } satisfies TeamContext));

  const clubAdminContexts = (await dbQuery<{
    membership_id: string;
    club_name: string;
    logo_path: string;
    primary_color: string;
    accent_color: string;
  }>(
    `select
       cm.id as membership_id,
       c.name as club_name,
       c.logo_path,
       c.primary_color,
       coalesce(c.accent_color, '#10233F') as accent_color
     from public.club_membership cm
     join public.club c on c.id = cm.club_id and c.active = true
     left join public.club_admin ca
       on ca.club_id = cm.club_id
      and ca.person_id = cm.person_id
      and ca.active = true
     where cm.person_id = $1
       and cm.active = true
       and (cm.is_club_admin = true or ca.id is not null)
     order by c.name`,
    [user.personId]
  )).rows.map((row) => ({
    id: `${row.membership_id}:club-admin`,
    personId: user.personId,
    name: row.club_name,
    club: row.club_name,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    league: "A League",
    season: "Club",
    role: "Club Admin",
    leaguePosition: 0,
    leagueMatchesPlayed: 0
  } satisfies TeamContext));

  const contexts = [...teamContexts, ...clubContexts, ...clubAdminContexts];
  const standings = (await dbQuery<{
    position: number;
    team_name: string;
    league_name: TeamContext["league"];
    season_name: string;
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    points_for: number;
    points_against: number;
    league_points: number;
  }>(
    `select
       ltv.position,
       t.name as team_name,
       l.name as league_name,
       s.name as season_name,
       ltv.matches_played,
       ltv.matches_won,
       ltv.matches_lost,
       ltv.points_for,
       ltv.points_against,
       ltv.league_points
     from public.league_table_view ltv
     join public.team t on t.id = ltv.team_id and t.active = true
     join public.league l on l.id = ltv.league_id
     join public.season s on s.id = ltv.season_id
     where ltv.matches_played > 0
        or ltv.points_for > 0
        or ltv.points_against > 0
        or ltv.league_points > 0
     order by s.name desc, l.name, ltv.position`
  )).rows.map((row) => ({
    position: Number(row.position),
    team: row.team_name,
    league: row.league_name,
    season: row.season_name,
    played: Number(row.matches_played),
    won: Number(row.matches_won),
    lost: Number(row.matches_lost),
    pointsFor: Number(row.points_for),
    pointsAgainst: Number(row.points_against),
    leaguePoints: Number(row.league_points)
  } satisfies Standing));

  const playerGameResults = (await dbQuery<{
    game_id: string;
    season_name: string;
    league_name: TeamContext["league"];
    player_1_id: string;
    player_1_name: string;
    player_2_id: string;
    player_2_name: string;
    result: number;
    source_week: string | null;
    home_team_name: string | null;
    home_team_score: number | null;
    away_team_name: string | null;
    away_team_score: number | null;
    game_number: number | null;
    game_ordinal: number | null;
    game_type: "Singles" | "Doubles" | null;
    home_player_1_id: string | null;
    home_player_1_name: string | null;
    home_player_2_id: string | null;
    home_player_2_name: string | null;
    away_player_1_id: string | null;
    away_player_1_name: string | null;
    away_player_2_id: string | null;
    away_player_2_name: string | null;
    is_doubles_partner_row: boolean;
    source_key: string;
  }>(
    `select
       pgrv.game_id,
       pgrv.season_name,
       pgrv.league_name,
       pgrv.player_1_id,
       pgrv.player_1_name,
       pgrv.player_2_id,
       pgrv.player_2_name,
       pgrv.result,
       pgrv.source_week,
       pgrv.home_team_name,
       pgrv.home_team_score,
       pgrv.away_team_name,
       pgrv.away_team_score,
       pgrv.game_number,
       pgrv.game_ordinal,
       g.game_type::text as game_type,
       g.home_player_1_id,
       concat_ws(' ', hp1.first_name, hp1.last_name) as home_player_1_name,
       g.home_player_2_id,
       concat_ws(' ', hp2.first_name, hp2.last_name) as home_player_2_name,
       g.away_player_1_id,
       concat_ws(' ', ap1.first_name, ap1.last_name) as away_player_1_name,
       g.away_player_2_id,
       concat_ws(' ', ap2.first_name, ap2.last_name) as away_player_2_name,
       pgrv.is_doubles_partner_row,
       pgrv.source_key
     from public.player_game_result_view pgrv
     left join public.game g on g.id = pgrv.game_id
     left join public.person hp1 on hp1.id = g.home_player_1_id
     left join public.person hp2 on hp2.id = g.home_player_2_id
     left join public.person ap1 on ap1.id = g.away_player_1_id
     left join public.person ap2 on ap2.id = g.away_player_2_id
     where
       (pgrv.source_key like 'live-%' and pgrv.player_1_id = $1)
       or (pgrv.source_key not like 'live-%' and (pgrv.player_1_id = $1 or pgrv.player_2_id = $1))
     order by pgrv.source_fixture_index desc, pgrv.game_ordinal
     limit 120`,
    [user.personId]
  )).rows.map((row) => {
    const isPlayerOne = row.player_1_id === user.personId;
    const won = isPlayerOne ? row.result === 1 : row.result === 0;
    const isHomePlayer = row.home_player_1_id === user.personId || row.home_player_2_id === user.personId;
    const partnerName = row.game_type === "Doubles"
      ? isHomePlayer
        ? row.home_player_1_id === user.personId ? row.home_player_2_name : row.home_player_1_name
        : row.away_player_1_id === user.personId ? row.away_player_2_name : row.away_player_1_name
      : null;
    const opponentNames = row.game_type === "Doubles"
      ? (isHomePlayer ? [row.away_player_1_name, row.away_player_2_name] : [row.home_player_1_name, row.home_player_2_name]).filter(Boolean) as string[]
      : [isPlayerOne ? row.player_2_name : row.player_1_name].filter(Boolean) as string[];
    return {
      gameId: row.game_id,
      season: row.season_name,
      league: row.league_name,
      playerId: user.personId,
      opponentId: isPlayerOne ? row.player_2_id : row.player_1_id,
      opponentName: isPlayerOne ? row.player_2_name : row.player_1_name,
      opponentNames,
      partnerName,
      result: won ? "Won" : "Lost",
      sourceWeek: row.source_week ?? "2025/26",
      homeTeamName: row.home_team_name ?? "Home",
      awayTeamName: row.away_team_name ?? "Away",
      matchScore: `${row.home_team_score ?? "-"}-${row.away_team_score ?? "-"}`,
      gameNumber: row.game_number ?? row.game_ordinal ?? 0,
      gameOrdinal: row.game_ordinal ?? 0,
      gameType: row.game_type,
      isDoublesPartnerRow: row.is_doubles_partner_row
    } satisfies PlayerGameResult;
  });

  const playerBreakStats = (await dbQuery<{
    season_name: string;
    league_name: TeamContext["league"];
    highest_break: number;
    total_breaks: string;
    fifty_plus_breaks: string;
    century_breaks: string;
  }>(
    `select
       season_name,
       league_name,
       max(break_value) as highest_break,
       count(*) as total_breaks,
       count(*) filter (where break_value >= 50) as fifty_plus_breaks,
       count(*) filter (where break_value >= 100) as century_breaks
     from public.player_break_leaderboard_view
     where player_id = $1
       and season_name is not null
       and league_name is not null
     group by season_name, league_name
     order by season_name desc, league_name`,
    [user.personId]
  )).rows.map((row) => ({
    season: row.season_name,
    league: row.league_name,
    highestBreak: Number(row.highest_break),
    totalBreaks: Number(row.total_breaks),
    fiftyPlusBreaks: Number(row.fifty_plus_breaks),
    centuryBreaks: Number(row.century_breaks)
  } satisfies PlayerBreakStat));

  const matchResults = (await dbQuery<{
    fixture_id: string;
    league_name: TeamContext["league"];
    season_name: string;
    week_id: string | null;
    week_number: number | null;
    week_label: string | null;
    fixture_date: string;
    home_team_name: string;
    away_team_name: string;
    home_team_score: number;
    away_team_score: number;
    status: "Scheduled" | "Completed";
  }>(
    `select
       f.id as fixture_id,
       l.name as league_name,
       s.name as season_name,
       fw.id as week_id,
       fw.week_number,
       fw.week_label,
       f.fixture_date,
       ht.name as home_team_name,
       at.name as away_team_name,
       m.home_team_score,
       m.away_team_score,
       f.status
     from public.fixture f
     join public.match m on m.fixture_id = f.id
     join public.team ht on ht.id = f.home_team_id
     join public.team at on at.id = f.away_team_id
     join public.league l on l.id = f.league_id
     join public.season s on s.id = f.season_id
     left join public.fixture_week_match fwm on fwm.match_id = m.id
     left join public.fixture_week fw on fw.id = fwm.week_id
     where f.status = 'Completed'
     order by s.name desc, l.name, coalesce(fw.week_number, 0) desc, f.fixture_date desc, ht.name, at.name`
  )).rows.map((row) => ({
    id: row.fixture_id,
    league: row.league_name,
    season: row.season_name,
    weekId: row.week_id ?? undefined,
    weekNumber: row.week_number === null ? undefined : Number(row.week_number),
    weekLabel: row.week_label ?? undefined,
    fixtureDate: row.fixture_date,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    homeTeamScore: Number(row.home_team_score),
    awayTeamScore: Number(row.away_team_score),
    status: row.status
  }));
  const activeMatchCount = Number((await dbQuery<{ count: string }>(
    `select count(*) as count
     from public.fixture f
     where f.fixture_date::date = (now() at time zone 'Europe/Dublin')::date
       and (now() at time zone 'Europe/Dublin')::time >= time '19:30'
       and (now() at time zone 'Europe/Dublin')::time < time '23:30'`
  )).rows[0]?.count ?? 0);

  const appearance = await loadAppearanceConfig();

  return {
    authenticated: true,
    user,
    contexts,
    standings,
    playerGameResults,
    playerBreakStats,
    matchResults,
    activeMatchCount,
    appearance
  };
}

export async function recordLogin(user: AppUser, provider: string, userAgent: string) {
  await dbQuery(
    `insert into public.user_activity_log (person_id, activity_type, user_agent, metadata)
     values ($1, 'Login', $2, $3::jsonb)`,
    [user.personId, userAgent, JSON.stringify({ provider })]
  ).catch(() => {});
}
