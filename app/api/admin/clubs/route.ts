import { NextResponse } from "next/server";

import { changedClubFields, clubAuditLabel, clubMutationPolicy, normalizeClubInput, type ClubAdminMode, type ClubSettings } from "@/lib/server/admin-clubs";
import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

type ClubRow = {
  id: string;
  name: string;
  venue: string | null;
  address: string | null;
  logo_path: string | null;
  primary_color: string | null;
  accent_color: string | null;
  allow_unlimited_lower_team_players: boolean;
  active: boolean;
  updated_at: string;
};

function clubResponse(row: ClubRow) {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    address: row.address,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    allowUnlimitedLowerTeamPlayers: row.allow_unlimited_lower_team_players,
    active: row.active,
    updatedAt: row.updated_at
  };
}

function rowSettings(row: ClubRow): ClubSettings {
  const club = clubResponse(row);
  return {
    name: club.name,
    venue: club.venue,
    address: club.address,
    logoPath: club.logoPath,
    primaryColor: club.primaryColor,
    accentColor: club.accentColor,
    allowUnlimitedLowerTeamPlayers: club.allowUnlimitedLowerTeamPlayers,
    active: club.active
  };
}

async function requireClubAdminAccess() {
  const user = await currentUser();
  if (!user) return { user: null, mode: null, clubIds: [] as string[] };
  const [operator, clubs] = await Promise.all([
    dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]),
    dbQuery<{ club_id: string }>(
      `select club_id from public.club_admin where person_id = $1 and active = true
       union
       select club_id from public.club_membership where person_id = $1 and active = true and is_club_admin = true`,
      [user.personId]
    )
  ]);
  const mode: ClubAdminMode | null = operator.rowCount ? "platform" : clubs.rowCount ? "club" : null;
  return { user, mode, clubIds: clubs.rows.map((row) => row.club_id) };
}

function duplicateNameError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function GET() {
  try {
    const access = await requireClubAdminAccess();
    if (!access.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.mode) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const clubs = await dbQuery<ClubRow>(
      `select id::text, name, venue, address, logo_path, primary_color, accent_color, allow_unlimited_lower_team_players, active, updated_at::text
       from public.club
       where $1::boolean = true
          or (active = true and id = any($2::uuid[]))
       order by active desc, name`,
      [access.mode === "platform", access.clubIds]
    );
    return NextResponse.json({ clubs: clubs.rows.map(clubResponse) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clubs could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireClubAdminAccess();
    if (!access.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (access.mode !== "platform" || !clubMutationPolicy("platform").canCreate) {
      return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    }
    const input = normalizeClubInput(await request.json(), "create");
    const club = await withTransaction(async (client) => {
      const result = await client.query<ClubRow>(
        `insert into public.club (name, venue, address, logo_path, primary_color, accent_color, allow_unlimited_lower_team_players, active, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         returning id::text, name, venue, address, logo_path, primary_color, accent_color, allow_unlimited_lower_team_players, active, updated_at::text`,
        [input.name, input.venue, input.address, input.logoPath, input.primaryColor, input.accentColor, input.allowUnlimitedLowerTeamPlayers, input.active]
      );
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/clubs', $2, jsonb_build_object('club_id', $3::text, 'club_name', $4, 'changed_fields', $5::jsonb))`,
        [access.user!.personId, clubAuditLabel("create", ["name"], input.active), result.rows[0].id, result.rows[0].name, JSON.stringify(clubMutationPolicy("platform").writableFields)]
      );
      return result.rows[0];
    });
    return NextResponse.json({ club: clubResponse(club) }, { status: 201 });
  } catch (error) {
    const message = duplicateNameError(error) ? "A club with this name already exists." : error instanceof Error ? error.message : "Could not create club.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireClubAdminAccess();
    if (!access.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.mode) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const mode = access.mode;

    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Club is required.");

    const result = await withTransaction(async (client) => {
      const existing = await client.query<ClubRow>(
        `select id::text, name, venue, address, logo_path, primary_color, accent_color, allow_unlimited_lower_team_players, active, updated_at::text
         from public.club where id = $1 for update`,
        [id]
      );
      if (!existing.rowCount) throw new Error("Club was not found.");
      if (mode === "club" && (!access.clubIds.includes(id) || !existing.rows[0].active)) {
        const forbidden = new Error("Club administrator access is required for this club.");
        Object.assign(forbidden, { status: 403 });
        throw forbidden;
      }

      const current = rowSettings(existing.rows[0]);
      if (mode === "club") {
        if ((body.name !== undefined && String(body.name).trim() !== current.name) || (body.active !== undefined && Boolean(body.active) !== current.active)) {
          const forbidden = new Error("Club administrators cannot rename or deactivate clubs.");
          Object.assign(forbidden, { status: 403 });
          throw forbidden;
        }
      }
      const next = normalizeClubInput({ ...current, ...body }, mode);
      const changes = changedClubFields(current, next);
      if (!changes.length) return existing.rows[0];

      const updated = await client.query<ClubRow>(
        `update public.club
         set name = $2, venue = $3, address = $4, logo_path = $5, primary_color = $6, accent_color = $7,
             allow_unlimited_lower_team_players = $8, active = $9, updated_at = now()
         where id = $1
         returning id::text, name, venue, address, logo_path, primary_color, accent_color, allow_unlimited_lower_team_players, active, updated_at::text`,
        [id, next.name, next.venue, next.address, next.logoPath, next.primaryColor, next.accentColor, next.allowUnlimitedLowerTeamPlayers, next.active]
      );
      const label = clubAuditLabel("update", changes, next.active);
      if (!label) return updated.rows[0];
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/clubs', $2, jsonb_build_object('club_id', $3::text, 'club_name', $4, 'changed_fields', $5::jsonb))`,
        [access.user!.personId, label, id, next.name, JSON.stringify(changes)]
      );
      return updated.rows[0];
    });
    return NextResponse.json({ club: clubResponse(result) });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && error.status === 403 ? 403 : 400;
    const message = duplicateNameError(error) ? "A club with this name already exists." : error instanceof Error ? error.message : "Could not update club.";
    return NextResponse.json({ error: message }, { status });
  }
}
