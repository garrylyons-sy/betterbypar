import { NextResponse } from "next/server";

import { normalizeLadderSettings } from "@/lib/club-ladder.mjs";
import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Access = { personId: string; platform: boolean; clubIds: string[] };

async function ladderAdminAccess(request: Request): Promise<Access | null> {
  const user = await currentUserFromRequest(request);
  if (!user) return null;
  const [operator, clubs] = await Promise.all([
    dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]),
    dbQuery<{ club_id: string }>(
      `select club_id from public.club_admin where person_id = $1 and active = true
       union
       select club_id from public.club_membership where person_id = $1 and active = true and is_club_admin = true`,
      [user.personId]
    )
  ]);
  return { personId: user.personId, platform: Boolean(operator.rowCount), clubIds: clubs.rows.map((row) => row.club_id) };
}

export async function GET(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const result = await dbQuery<{
      club_id: string;
      club_name: string;
      logo_path: string | null;
      primary_color: string | null;
      accent_color: string | null;
      ladder_id: string | null;
      ladder_name: string | null;
      match_format: "1 Frame" | "Best of 3" | "Best of 5" | null;
      challenge_range: number | null;
      response_hours: number | null;
      play_within_days: number | null;
      active: boolean | null;
      entry_count: string;
    }>(
      `select c.id::text as club_id, c.name as club_name, c.logo_path, c.primary_color, c.accent_color,
              cl.id::text as ladder_id, cl.name as ladder_name, cl.match_format, cl.challenge_range,
              cl.response_hours, cl.play_within_days, cl.active,
              count(cle.id) filter (where cle.status = 'Active')::text as entry_count
       from public.club c
       left join public.club_ladder cl on cl.club_id = c.id
       left join public.club_ladder_entry cle on cle.ladder_id = cl.id
       where c.active = true
         and ($1::boolean = true or c.id = any($2::uuid[]))
       group by c.id, cl.id
       order by c.name`,
      [access.platform, access.clubIds]
    );

    return NextResponse.json({
      clubs: result.rows.map((row) => ({
        clubId: row.club_id,
        clubName: row.club_name,
        logoPath: row.logo_path,
        primaryColor: row.primary_color,
        accentColor: row.accent_color,
        ladder: row.ladder_id ? {
          id: row.ladder_id,
          name: row.ladder_name,
          matchFormat: row.match_format,
          challengeRange: row.challenge_range,
          responseHours: row.response_hours,
          playWithinDays: row.play_within_days,
          active: row.active,
          entryCount: Number(row.entry_count)
        } : null
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladders could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const clubId = String(body.clubId ?? "").trim();
    if (!clubId) throw new Error("Club is required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
    }
    const settings = normalizeLadderSettings(body);

    const ladder = await withTransaction(async (client) => {
      const club = await client.query<{ name: string }>("select name from public.club where id = $1 and active = true", [clubId]);
      if (!club.rowCount) throw new Error("Club was not found.");
      const saved = await client.query<{
        id: string;
        name: string;
        match_format: string;
        challenge_range: number;
        response_hours: number;
        play_within_days: number;
        active: boolean;
      }>(
        `insert into public.club_ladder
           (club_id, name, match_format, challenge_range, response_hours, play_within_days, active, created_by, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (club_id) do update
         set name = excluded.name,
             match_format = excluded.match_format,
             challenge_range = excluded.challenge_range,
             response_hours = excluded.response_hours,
             play_within_days = excluded.play_within_days,
             active = excluded.active,
             updated_at = now()
         returning id::text, name, match_format, challenge_range, response_hours, play_within_days, active`,
        [clubId, settings.name, settings.matchFormat, settings.challengeRange, settings.responseHours, settings.playWithinDays, settings.active, access.personId]
      );
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder settings saved',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'match_format', $4::text))`,
        [access.personId, clubId, club.rows[0].name, settings.matchFormat]
      );
      return saved.rows[0];
    });

    return NextResponse.json({
      ladder: {
        id: ladder.id,
        name: ladder.name,
        matchFormat: ladder.match_format,
        challengeRange: ladder.challenge_range,
        responseHours: ladder.response_hours,
        playWithinDays: ladder.play_within_days,
        active: ladder.active
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ladder settings could not be saved." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await ladderAdminAccess(request);
    if (!access) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!access.platform && !access.clubIds.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const clubId = String(body.clubId ?? "").trim();
    if (!clubId) throw new Error("Club is required.");
    if (!access.platform && !access.clubIds.includes(clubId)) {
      return NextResponse.json({ error: "Club administrator access is required for this club." }, { status: 403 });
    }

    await withTransaction(async (client) => {
      const ladder = await client.query<{ id: string; name: string; club_name: string }>(
        `select cl.id::text, cl.name, c.name as club_name
         from public.club_ladder cl
         join public.club c on c.id = cl.club_id
         where cl.club_id = $1
         for update of cl`,
        [clubId]
      );
      if (!ladder.rowCount) throw new Error("Club ladder was not found.");
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/ladders', 'Club ladder deleted',
           jsonb_build_object('club_id', $2::text, 'club_name', $3::text, 'ladder_name', $4::text))`,
        [access.personId, clubId, ladder.rows[0].club_name, ladder.rows[0].name]
      );
      await client.query("delete from public.club_ladder where id = $1", [ladder.rows[0].id]);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Club ladder could not be deleted." }, { status: 400 });
  }
}
