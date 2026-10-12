import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const operator = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!operator.rowCount) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  try {
    const { competitionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const pickId = String(body.pickId ?? "").trim();
    const playerId = String(body.playerId ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!pickId || !playerId || !reason) {
      return NextResponse.json({ error: "Pick, player and reason are required." }, { status: 400 });
    }

    await withTransaction(async (client) => {
      const pick = await client.query<{
        id: string;
        entry_id: string;
        round_id: string;
        slot_number: number;
        tier: string;
        cycle_number: number;
      }>(
        `select p.id::text, p.entry_id::text, p.round_id::text, p.slot_number, e.tier, r.cycle_number
         from public.last_man_standing_pick p
         join public.last_man_standing_entry e on e.id = p.entry_id
         join public.last_man_standing_round r on r.id = p.round_id
         where p.id = $1 and r.competition_id = $2
           and p.state = 'Needs Review' and r.status = 'Needs Review'
         for update of p`,
        [pickId, competitionId]
      );
      if (!pick.rows[0]) throw new Error("Pick not found.");

      const lineup = await client.query<{ fixture_id: string; lineup_slot_id: string }>(
        `select fl.fixture_id::text, fls.id::text as lineup_slot_id
         from public.last_man_standing_round_schedule rs
         join public.fixture_week mapped_week on mapped_week.id = rs.fixture_week_id
         join public.fixture_week_match fwm on fwm.week_id = rs.fixture_week_id
         join public.match m on m.id = fwm.match_id
         join public.fixture f on f.id = m.fixture_id
         join public.fixture_lineup fl on fl.fixture_id = m.fixture_id and fl.status = 'Published'
         join public.fixture_lineup_slot fls on fls.lineup_id = fl.id
         join public.team lineup_team on lineup_team.id = fl.team_id
         join public.person candidate on candidate.id = $3 and candidate.active = true
         join public.person_team_role candidate_role
           on candidate_role.person_id = candidate.id
          and candidate_role.club_id = lineup_team.club_id
          and candidate_role.league_id = lineup_team.league_id
          and lower(candidate_role.team_name) = lower(lineup_team.name)
          and candidate_role.role = 'Player' and candidate_role.active = true
         join public.league candidate_league on candidate_league.id = candidate_role.league_id
         where rs.round_id = $1 and rs.tier = $2
           and $3::uuid in (fls.player_1_id, fls.player_2_id)
           and f.status <> 'Cancelled'
           and (f.fixture_date at time zone 'Europe/Dublin')::date
             between mapped_week.starts_on and mapped_week.starts_on + 6
           and case when candidate_league.name = 'A League' then 'A'
                    when candidate_league.name = 'B League' then 'B' else 'C' end = $2
         order by fls.slot_number limit 1`,
        [pick.rows[0].round_id, pick.rows[0].tier, playerId]
      );
      if (!lineup.rows[0]) throw new Error("Choose a player from a published lineup in this round.");

      const alreadyUsed = await client.query(
        `select 1
         from public.last_man_standing_pick other_pick
         join public.last_man_standing_round other_round on other_round.id = other_pick.round_id
         where other_pick.entry_id = $1 and other_pick.id <> $2
           and coalesce(other_pick.effective_player_id, other_pick.selected_player_id) = $3
           and (
             other_pick.round_id = $4
             or other_round.cycle_number = $5
           )
         limit 1`,
        [pick.rows[0].entry_id, pickId, playerId, pick.rows[0].round_id, pick.rows[0].cycle_number]
      );
      if (alreadyUsed.rowCount) throw new Error("That player is already used by this entrant in the current cycle.");

      await client.query(
        `update public.last_man_standing_pick
         set selected_player_id = $2, effective_player_id = $2,
             source_fixture_id = $3, source_lineup_slot_id = $4,
             state = 'Automatic', automatic_reason = $5, outcome = 'Pending',
             locked_at = now(), settled_at = null, version = version + 1, updated_at = now()
         where id = $1`,
        [pickId, playerId, lineup.rows[0].fixture_id, lineup.rows[0].lineup_slot_id, `Admin override: ${reason}`]
      );
      await client.query(
        `update public.last_man_standing_round
         set status = case when exists (
           select 1 from public.last_man_standing_pick
           where round_id = $1 and state = 'Needs Review'
         ) then 'Needs Review' else 'Locked' end,
         updated_at = now()
         where id = $1`,
        [pick.rows[0].round_id]
      );
      await client.query(
        `insert into public.last_man_standing_event (
           competition_id, entry_id, round_id, pick_id, actor_person_id, event_type, payload
         ) values ($1, $2, $3, $4, $5, 'Admin Override',
           jsonb_build_object('slot_number', $6::int, 'player_id', $7::text, 'reason', $8::text))`,
        [competitionId, pick.rows[0].entry_id, pick.rows[0].round_id, pickId, user.personId,
          pick.rows[0].slot_number, playerId, reason]
      );
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/last-man-standing', 'Resolved Last Man Standing pick',
           jsonb_build_object('action', 'Admin Override', 'competition_id', $2::text,
             'pick_id', $3::text, 'player_id', $4::text, 'reason', $5::text))`,
        [user.personId, competitionId, pickId, playerId, reason]
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pick could not be resolved." }, { status: 400 });
  }
}
