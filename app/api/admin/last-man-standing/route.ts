import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function requirePlatformAdmin() {
  const user = await currentUser();
  if (!user) return { user: null, allowed: false };
  const result = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  return { user, allowed: Boolean(result.rowCount) };
}

export async function GET() {
  try {
    const access = await requirePlatformAdmin();
    if (!access.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!access.allowed) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    const [competitions, seasons, fixtureWeeks] = await Promise.all([
      dbQuery(
        `select c.id::text, c.name, c.audience, c.status, c.entry_opens_at::text, c.entry_closes_at::text,
                s.id::text as season_id, s.name as season_name,
                count(distinct e.id)::int as entrant_count,
                count(distinct e.id) filter (where e.status in ('Entered', 'Standing', 'Winner'))::int as standing_count,
                coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', r.id::text, 'name', r.name, 'cycleNumber', r.cycle_number,
                    'roundNumber', r.round_number, 'status', r.status, 'decidingRound', r.deciding_round,
                    'schedules', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', rs.id::text, 'tier', rs.tier, 'fixtureWeekId', rs.fixture_week_id::text,
                      'defaultMatchDate', rs.default_match_date::text, 'deadlineTime', rs.deadline_time::text,
                      'leagueName', l.name, 'weekLabel', fw.week_label
                    ) order by rs.tier) from public.last_man_standing_round_schedule rs
                      join public.league l on l.id = rs.league_id
                      join public.fixture_week fw on fw.id = rs.fixture_week_id where rs.round_id = r.id), '[]'::jsonb)
                  ) order by r.cycle_number, r.round_number)
                  from public.last_man_standing_round r where r.competition_id = c.id
                ), '[]'::jsonb) as rounds,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'id', ev.id::text, 'eventType', ev.event_type, 'createdAt', ev.created_at::text, 'payload', ev.payload
                ) order by ev.created_at desc) from (
                  select * from public.last_man_standing_event where competition_id = c.id order by created_at desc limit 30
                ) ev), '[]'::jsonb) as events
         from public.last_man_standing_competition c
         join public.season s on s.id = c.season_id
         left join public.last_man_standing_entry e on e.competition_id = c.id and e.status <> 'Withdrawn'
         group by c.id, s.id
         order by c.created_at desc`
      ),
      dbQuery("select id::text, name, active from public.season order by active desc, starts_on desc nulls last, name desc"),
      dbQuery(
        `select fw.id::text, fw.season_id::text, fw.league_id::text, l.name as league_name,
                fw.week_number, fw.week_label, fw.starts_on::text,
                coalesce(min((f.fixture_date at time zone 'Europe/Dublin')::date)::text, fw.starts_on::text) as match_date
         from public.fixture_week fw
         join public.league l on l.id = fw.league_id
         left join public.fixture_week_match fwm on fwm.week_id = fw.id
         left join public.match m on m.id = fwm.match_id
         left join public.fixture f on f.id = m.fixture_id
         group by fw.id, l.id order by fw.season_id, l.name, fw.week_number`
      )
    ]);
    return NextResponse.json({ competitions: competitions.rows, seasons: seasons.rows, fixtureWeeks: fixtureWeeks.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Last Man Standing admin could not be loaded." }, { status: 500 });
  }
}

type ScheduleInput = { tier?: unknown; fixtureWeekId?: unknown };
type RoundInput = { name?: unknown; decidingRound?: unknown; schedules?: ScheduleInput[] };

export async function POST(request: Request) {
  try {
    const access = await requirePlatformAdmin();
    if (!access.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!access.allowed) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const seasonId = String(body.seasonId ?? "").trim();
    const audience = body.audience === "Everyone" ? "Everyone" : "League Chair";
    const entryOpensAt = String(body.entryOpensAt ?? "");
    const entryClosesAt = String(body.entryClosesAt ?? "");
    const rounds: RoundInput[] = Array.isArray(body.rounds) ? body.rounds : [];
    if (!name || !seasonId || !entryOpensAt || !entryClosesAt || new Date(entryClosesAt) <= new Date(entryOpensAt)) {
      return NextResponse.json({ error: "Name, season, and a valid entry window are required." }, { status: 400 });
    }
    if (!rounds.length) return NextResponse.json({ error: "Add at least one round." }, { status: 400 });

    const id = await withTransaction(async (client) => {
      const competition = await client.query<{ id: string }>(
        `insert into public.last_man_standing_competition (
           season_id, name, audience, entry_opens_at, entry_closes_at, status, created_by
         ) values ($1, $2, $3, $4, $5, 'Draft', $6) returning id::text`,
        [seasonId, name, audience, entryOpensAt, entryClosesAt, access.user!.personId]
      );
      for (const [index, roundInput] of rounds.entries()) {
        const schedules = Array.isArray(roundInput.schedules) ? roundInput.schedules : [];
        const tiers = schedules.map((schedule) => String(schedule.tier));
        if (tiers.length !== 3 || !["A", "B", "C"].every((tier) => tiers.includes(tier))) {
          throw new Error(`Round ${index + 1} needs A, B and C fixture weeks.`);
        }
        const round = await client.query<{ id: string }>(
          `insert into public.last_man_standing_round (
             competition_id, round_number, name, deciding_round, status
           ) values ($1, $2, $3, $4, 'Planned') returning id::text`,
          [competition.rows[0].id, index + 1, String(roundInput.name ?? `Round ${index + 1}`).trim() || `Round ${index + 1}`, Boolean(roundInput.decidingRound)]
        );
        for (const schedule of schedules) {
          const tier = String(schedule.tier);
          const weekId = String(schedule.fixtureWeekId ?? "");
          const week = await client.query<{ league_id: string; match_date: string }>(
            `select fw.league_id::text,
                    coalesce(min((f.fixture_date at time zone 'Europe/Dublin')::date), fw.starts_on)::text as match_date
             from public.fixture_week fw
             left join public.fixture_week_match fwm on fwm.week_id = fw.id
             left join public.match m on m.id = fwm.match_id
             left join public.fixture f on f.id = m.fixture_id
             where fw.id = $1 and fw.season_id = $2 group by fw.id`,
            [weekId, seasonId]
          );
          if (!week.rows[0]?.match_date) throw new Error(`Choose a valid ${tier} League fixture week.`);
          await client.query(
            `insert into public.last_man_standing_round_schedule (
               round_id, tier, league_id, fixture_week_id, default_match_date
             ) values ($1, $2, $3, $4, $5)`,
            [round.rows[0].id, tier, week.rows[0].league_id, weekId, week.rows[0].match_date]
          );
        }
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/last-man-standing', 'Created Last Man Standing competition',
           jsonb_build_object('action', 'Created competition', 'competition_id', $2::text, 'competition_name', $3::text, 'round_count', $4::int))`,
        [access.user!.personId, competition.rows[0].id, name, rounds.length]
      );
      return competition.rows[0].id;
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competition could not be created." }, { status: 400 });
  }
}
