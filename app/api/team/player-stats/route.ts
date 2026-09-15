import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type TeamRow = {
  team_id: string;
  team_name: string;
  club_id: string;
  league_id: string;
  season_id: string;
};

type PlayerStatRow = {
  person_id: string;
  player_name: string;
  played: string;
  won: string;
  lost: string;
  highest_break: number | null;
};

async function canViewTeam(personId: string, team: TeamRow) {
  const { rowCount } = await dbQuery(
    `select 1
     from (
       select ptr.person_id
       from public.person_team_role ptr
       join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
       where ptr.person_id = $1
         and ptr.club_id = $2
         and ptr.league_id = $3
         and ptr.team_name = $4
         and ptr.active = true
       union
       select tm.person_id
       from public.team_membership tm
       where tm.person_id = $1
         and tm.team_id = $5
         and tm.active = true
       union
       select ao.person_id
       from public.app_operator ao
       where ao.person_id = $1
         and ao.active = true
     ) access
     limit 1`,
    [personId, team.club_id, team.league_id, team.team_name, team.team_id]
  );
  return Boolean(rowCount);
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
    if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });

    const teamResult = await dbQuery<TeamRow>(
      `select
         t.id as team_id,
         t.name as team_name,
         t.club_id,
         t.league_id,
         t.season_id
       from public.team t
       where t.id = $1
         and t.active = true
       limit 1`,
      [teamId]
    );
    const team = teamResult.rows[0];
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    if (!await canViewTeam(user.personId, team)) {
      return NextResponse.json({ error: "Team access required." }, { status: 403 });
    }

    const stats = await dbQuery<PlayerStatRow>(
      `with team_players as (
         select distinct ptr.person_id
         from public.person_team_role ptr
         join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
         where ptr.club_id = $1
           and ptr.league_id = $2
           and ptr.team_name = $3
           and ptr.role = 'Player'
           and ptr.active = true
         union
         select distinct tm.person_id
         from public.team_membership tm
         where tm.team_id = $4
           and tm.role = 'Player'
           and tm.active = true
       ),
       game_stats as (
         select
           tp.person_id,
           count(pgr.game_id) filter (
             where pgr.player_1_id = tp.person_id or pgr.player_2_id = tp.person_id
           ) as played,
           count(pgr.game_id) filter (
             where (pgr.player_1_id = tp.person_id and pgr.result = 1)
                or (pgr.player_2_id = tp.person_id and pgr.result = 0)
           ) as won,
           count(pgr.game_id) filter (
             where (pgr.player_1_id = tp.person_id and pgr.result = 0)
                or (pgr.player_2_id = tp.person_id and pgr.result = 1)
           ) as lost
         from team_players tp
         left join public.player_game_result_view pgr
           on pgr.season_id = $5
          and pgr.league_id = $2
          and (pgr.player_1_id = tp.person_id or pgr.player_2_id = tp.person_id)
         group by tp.person_id
       ),
       break_stats as (
         select b.player_id as person_id, max(b.break_value) as highest_break
         from public.break b
         where b.season_id = $5
           and b.league_id = $2
         group by b.player_id
       )
       select
         p.id as person_id,
         concat_ws(' ', p.first_name, p.last_name) as player_name,
         coalesce(gs.played, 0)::text as played,
         coalesce(gs.won, 0)::text as won,
         coalesce(gs.lost, 0)::text as lost,
         bs.highest_break
       from team_players tp
       join public.person p on p.id = tp.person_id and p.active = true
       left join game_stats gs on gs.person_id = tp.person_id
       left join break_stats bs on bs.person_id = tp.person_id
       where coalesce(gs.played, 0) > 0
       order by
         case
           when coalesce(gs.played, 0) > 0 then coalesce(gs.won, 0)::numeric / coalesce(gs.played, 0)::numeric
           else -1
         end desc,
         coalesce(gs.played, 0) desc,
         coalesce(gs.won, 0) desc,
         p.last_name,
         p.first_name`,
      [team.club_id, team.league_id, team.team_name, team.team_id, team.season_id]
    );

    return NextResponse.json({
      teamId: team.team_id,
      players: stats.rows.map((row) => {
        const played = Number(row.played);
        const won = Number(row.won);
        const lost = Number(row.lost);
        return {
          personId: row.person_id,
          name: row.player_name,
          played,
          won,
          lost,
          winPercentage: played ? Math.round((won / played) * 100) : 0,
          highestBreak: row.highest_break ?? null
        };
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Player stats unavailable." },
      { status: 500 }
    );
  }
}
