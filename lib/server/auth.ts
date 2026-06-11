import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { PoolClient } from "pg";

import { dbQuery, withTransaction } from "@/lib/server/db";
import type { PlayerGameResult, Role, Standing, TeamContext } from "@/lib/types";

export const sessionCookieName = "is_session";
const oauthStateCookieName = "is_oauth_state";
const oauthNextCookieName = "is_oauth_next";
const oauthInviteCookieName = "is_oauth_invite";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
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
  return process.env.GOOGLE_REDIRECT_URI || `${await publicOrigin()}/auth/google/callback`;
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

  return withTransaction(async (client) => {
    const invitationResult = await client.query(
      `select *
       from public.invitation
       where lower(email) = lower($1)
         and status = 'Pending'
         and ($2::text is null or invitation_code = $2)
       order by created_at desc
       limit 1
       for update`,
      [lowerEmail, invitationCode?.trim() || null]
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

    if (membershipResult.rowCount === 0) {
      throw new Error("Invitation has no team role attached.");
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
        `insert into public.person (first_name, last_name, email, profile_image, active)
         values ($1, $2, $3, $4, true)
         returning *`,
        [firstName, lastName, lowerEmail, profileImage ?? null]
      );
      person = result.rows[0];
    } else {
      const result = await client.query<PersonRow>(
        `update public.person
         set email = coalesce(email, $2),
             profile_image = coalesce(nullif($3, ''), profile_image),
             active = true
         where id = $1
         returning *`,
        [person.id, lowerEmail, profileImage ?? ""]
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
    membership_id: string;
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
    `select
       tm.id as membership_id,
       t.id as team_id,
       tm.role,
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
     from public.team_membership tm
     join public.team t on t.id = tm.team_id and t.active = true
     join public.club c on c.id = t.club_id and c.active = true
     join public.league l on l.id = t.league_id
     join public.season s on s.id = t.season_id
     left join public.league_table_view ltv on ltv.team_id = t.id
     where tm.person_id = $1
       and tm.active = true
     order by coalesce(ltv.matches_played, 0) desc, s.name desc, l.name, t.name`,
    [user.personId]
  )).rows.map((row) => ({
    id: row.membership_id,
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
         from public.team_membership tm
         join public.team t on t.id = tm.team_id
         where tm.person_id = cm.person_id
           and tm.active = true
           and t.club_id = cm.club_id
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

  const contexts = [...teamContexts, ...clubContexts];
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
    `with relevant_competitions as (
       select distinct t.league_id, t.season_id
       from public.team_membership tm
       join public.team t on t.id = tm.team_id
       where tm.person_id = $1
         and tm.active = true
     )
     select
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
     join relevant_competitions rc on rc.league_id = ltv.league_id and rc.season_id = ltv.season_id
     where ltv.matches_played > 0
     order by s.name desc, l.name, ltv.position`,
    [user.personId]
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
    is_doubles_partner_row: boolean;
  }>(
    `select
       game_id,
       player_1_id,
       player_1_name,
       player_2_id,
       player_2_name,
       result,
       source_week,
       home_team_name,
       home_team_score,
       away_team_name,
       away_team_score,
       game_number,
       game_ordinal,
       is_doubles_partner_row
     from public.player_game_result_view
     where player_1_id = $1 or player_2_id = $1
     order by source_fixture_index desc, game_ordinal
     limit 120`,
    [user.personId]
  )).rows.map((row) => {
    const isPlayerOne = row.player_1_id === user.personId;
    const won = isPlayerOne ? row.result === 1 : row.result === 0;
    return {
      gameId: row.game_id,
      playerId: user.personId,
      opponentId: isPlayerOne ? row.player_2_id : row.player_1_id,
      opponentName: isPlayerOne ? row.player_2_name : row.player_1_name,
      result: won ? "Won" : "Lost",
      sourceWeek: row.source_week ?? "2025/26",
      homeTeamName: row.home_team_name ?? "Home",
      awayTeamName: row.away_team_name ?? "Away",
      matchScore: `${row.home_team_score ?? "-"}-${row.away_team_score ?? "-"}`,
      gameNumber: row.game_number ?? row.game_ordinal ?? 0,
      gameOrdinal: row.game_ordinal ?? 0,
      isDoublesPartnerRow: row.is_doubles_partner_row
    } satisfies PlayerGameResult;
  });

  const matchResults = (await dbQuery<{
    fixture_id: string;
    league_name: TeamContext["league"];
    season_name: string;
    fixture_date: string;
    home_team_name: string;
    away_team_name: string;
    home_team_score: number;
    away_team_score: number;
    status: "Scheduled" | "Completed";
  }>(
    `with relevant_competitions as (
       select distinct t.league_id, t.season_id
       from public.team_membership tm
       join public.team t on t.id = tm.team_id
       where tm.person_id = $1
         and tm.active = true
     )
     select
       f.id as fixture_id,
       l.name as league_name,
       s.name as season_name,
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
     join relevant_competitions rc on rc.league_id = f.league_id and rc.season_id = f.season_id
     where f.status = 'Completed'
     order by f.fixture_date desc, ht.name, at.name`,
    [user.personId]
  )).rows.map((row) => ({
    id: row.fixture_id,
    league: row.league_name,
    season: row.season_name,
    fixtureDate: row.fixture_date,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    homeTeamScore: Number(row.home_team_score),
    awayTeamScore: Number(row.away_team_score),
    status: row.status
  }));

  return {
    authenticated: true,
    user,
    contexts,
    standings,
    playerGameResults,
    matchResults
  };
}

export async function recordLogin(user: AppUser, provider: string, userAgent: string) {
  await dbQuery(
    `insert into public.user_activity_log (person_id, activity_type, user_agent, metadata)
     values ($1, 'Login', $2, $3::jsonb)`,
    [user.personId, userAgent, JSON.stringify({ provider })]
  ).catch(() => {});
}
