alter table public.cup_competition
  drop constraint if exists cup_competition_audience_check;

alter table public.cup_competition
  add constraint cup_competition_audience_check
  check (audience in ('Everyone', 'All Players', 'All Managers', 'All Players and Managers', 'Specific Leagues', 'League Chairs'));

create or replace function public.can_person_view_cup(competition_uuid uuid, person_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.cup_competition cc
    where cc.id = competition_uuid
      and (
        exists (
          select 1 from public.app_operator ao
          where ao.person_id = person_uuid and ao.active = true
        )
        or (
          cc.audience = 'Everyone'
          and exists (
            select 1 from public.person p
            where p.id = person_uuid and p.active = true
          )
        )
        or (
          cc.audience = 'League Chairs'
          and exists (
            select 1 from public.club_membership cm
            where cm.person_id = person_uuid and cm.role = 'League Chair' and cm.active = true
          )
        )
        or (
          cc.audience = 'All Players'
          and (
            exists (
              select 1 from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role = 'Player' and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role = 'Player' and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'All Managers'
          and (
            exists (
              select 1 from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role = 'Manager' and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role = 'Manager' and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'All Players and Managers'
          and (
            exists (
              select 1 from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role in ('Player', 'Manager') and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role in ('Player', 'Manager') and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'Specific Leagues'
          and exists (
            select 1
            from public.cup_competition_visibility_league cvl
            where cvl.competition_id = cc.id
              and (
                exists (
                  select 1 from public.person_team_role ptr
                  join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
                  where ptr.person_id = person_uuid
                    and ptr.league_id = cvl.league_id
                    and ptr.role in ('Player', 'Manager')
                    and ptr.active = true
                )
                or exists (
                  select 1 from public.team_membership tm
                  join public.team t on t.id = tm.team_id
                  where tm.person_id = person_uuid
                    and t.league_id = cvl.league_id
                    and tm.role in ('Player', 'Manager')
                    and tm.active = true
                )
              )
          )
        )
      )
  );
$$;

revoke all on function public.can_person_view_cup(uuid, uuid) from public;
grant execute on function public.can_person_view_cup(uuid, uuid) to authenticated;
