from __future__ import annotations

from pathlib import Path

import openpyxl


SOURCE = Path("/Users/garrylyons/Downloads/Snooker A League 25-26.xlsx")
OUTPUT = Path("supabase/a_league_2025_26_results.sql")


CLUBS = [
    "Castle Golf Club",
    "Grange Golf Club",
    "Milltown Golf Club",
    "Elm Park Golf Club",
    "Stackstown Golf Club",
    "Woodbrook Golf Club",
    "Newlands Golf Club",
    "Dun Laoghaire Golf Club",
    "Fitzwilliam Lawn Tennis Club",
]

TEAM_TO_CLUB = {
    "Castle A": "Castle Golf Club",
    "Grange A": "Grange Golf Club",
    "Milltown A": "Milltown Golf Club",
    "Elm Park A": "Elm Park Golf Club",
    "Stackstown A": "Stackstown Golf Club",
    "Woodbrook A": "Woodbrook Golf Club",
    "Newlands A": "Newlands Golf Club",
    "Dun Laoghaire A": "Dun Laoghaire Golf Club",
    "Fitzwilliam A": "Fitzwilliam Lawn Tennis Club",
}


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def extract_fixtures() -> list[tuple[int, str, str, int, str, int]]:
    workbook = openpyxl.load_workbook(SOURCE, data_only=True)
    sheet = workbook.active

    fixtures: list[tuple[int, str, str, int, str, int]] = []
    current_round: int | str | None = None
    current_date = None

    for row in sheet.iter_rows(values_only=True):
        round_value, date_value, home, home_score, away, away_score = row[:6]

        if isinstance(round_value, int):
            current_round = round_value
            current_date = date_value
        elif isinstance(round_value, str) and round_value.strip().lower() in {"semi-final", "final"}:
            current_round = round_value
            current_date = date_value

        if (
            isinstance(current_round, int)
            and home
            and away
            and home != "Home"
            and away != "Away"
            and away != "No match"
            and isinstance(home_score, (int, float))
            and isinstance(away_score, (int, float))
        ):
            fixtures.append(
                (
                    current_round,
                    current_date.date().isoformat(),
                    str(home),
                    int(home_score),
                    str(away),
                    int(away_score),
                )
            )

    return fixtures


def build_sql(fixtures: list[tuple[int, str, str, int, str, int]]) -> str:
    club_values = ",\n".join(f"  ({q(club)}, {q(club)}, true)" for club in CLUBS)
    team_values = ",\n".join(f"    ({q(team)}, {q(club)})" for team, club in TEAM_TO_CLUB.items())
    fixture_values = ",\n".join(
        f"    ({round_number}, {q(fixture_date)}, {q(home)}, {home_score}, {q(away)}, {away_score})"
        for round_number, fixture_date, home, home_score, away, away_score in fixtures
    )

    return f"""-- Generated from Snooker A League 25-26.xlsx.
-- Regular season only; the two semi-finals and final are intentionally excluded.

insert into public.season (name, starts_on, ends_on, active)
values ('2025/26', '2025-10-01', '2026-03-31', false)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into public.league (name, playing_day)
values ('A League', 'Thursday')
on conflict (name) do update set playing_day = excluded.playing_day;

insert into public.club (name, venue, active)
values
{club_values}
on conflict (name) do update
set venue = excluded.venue,
    active = excluded.active;

with requested_teams (team_name, club_name) as (
  values
{team_values}
)
insert into public.team (club_id, league_id, season_id, name, active)
select c.id, l.id, s.id, rt.team_name, true
from requested_teams rt
join public.club c on c.name = rt.club_name
join public.league l on l.name = 'A League'
join public.season s on s.name = '2025/26'
on conflict (league_id, season_id, name) do update
set club_id = excluded.club_id,
    active = excluded.active;

with source_fixtures (round_number, fixture_date, home_team_name, home_points, away_team_name, away_points) as (
  values
{fixture_values}
),
resolved as (
  select sf.*, s.id as season_id, l.id as league_id, ht.id as home_team_id, at.id as away_team_id
  from source_fixtures sf
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'A League'
  join public.team ht on ht.name = sf.home_team_name and ht.season_id = s.id and ht.league_id = l.id
  join public.team at on at.name = sf.away_team_name and at.season_id = s.id and at.league_id = l.id
),
inserted_fixtures as (
  insert into public.fixture (season_id, league_id, fixture_date, home_team_id, away_team_id, status)
  select season_id, league_id, fixture_date::date::timestamptz, home_team_id, away_team_id, 'Completed'::fixture_status
  from resolved r
  where not exists (
    select 1
    from public.fixture f
    where f.season_id = r.season_id
      and f.league_id = r.league_id
      and f.fixture_date = r.fixture_date::date::timestamptz
      and f.home_team_id = r.home_team_id
      and f.away_team_id = r.away_team_id
  )
  returning id
)
insert into public.match (fixture_id, home_team_score, away_team_score, entered_at)
select f.id, r.home_points, r.away_points, now()
from resolved r
join public.fixture f on f.season_id = r.season_id
  and f.league_id = r.league_id
  and f.fixture_date = r.fixture_date::date::timestamptz
  and f.home_team_id = r.home_team_id
  and f.away_team_id = r.away_team_id
on conflict (fixture_id) do update
set home_team_score = excluded.home_team_score,
    away_team_score = excluded.away_team_score,
    entered_at = excluded.entered_at;
"""


def main() -> None:
    fixtures = extract_fixtures()
    if len(fixtures) != 72:
        raise RuntimeError(f"Expected 72 regular-season fixtures, found {len(fixtures)}")

    OUTPUT.write_text(build_sql(fixtures), encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(fixtures)} fixtures")


if __name__ == "__main__":
    main()
