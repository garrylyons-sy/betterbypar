import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminMatchStats } from "../lib/server/admin-match-stats.mjs";

test("buildAdminMatchStats counts match outcomes, scorelines, and guest players used by team", () => {
  const stats = buildAdminMatchStats({
    fixtures: [
      {
        fixture_id: "fixture-1",
        league_name: "A League",
        home_team_id: "castle-a",
        home_team_name: "Castle A",
        away_team_id: "milltown-a",
        away_team_name: "Milltown A",
        fixture_date: "2026-10-01T19:30:00.000Z",
        week_starts_on: "2026-10-01",
        status: "Completed",
        home_team_score: 7,
        away_team_score: 0
      },
      {
        fixture_id: "fixture-2",
        league_name: "C League",
        home_team_id: "castle-c",
        home_team_name: "Castle C",
        away_team_id: "newlands-c",
        away_team_name: "Newlands C",
        fixture_date: "2026-09-28T19:30:00.000Z",
        week_starts_on: "2026-09-28",
        status: "Complete",
        home_team_score: 2,
        away_team_score: 5
      },
      {
        fixture_id: "fixture-3",
        league_name: "B League",
        home_team_id: "castle-b",
        home_team_name: "Castle B",
        away_team_id: "grange-b",
        away_team_name: "Grange B",
        fixture_date: "2026-10-15T19:30:00.000Z",
        week_starts_on: "2026-10-08",
        status: "Scheduled",
        home_team_score: 0,
        away_team_score: 0
      }
    ],
    appearances: [
      { league_name: "A League", team_id: "castle-a", team_name: "Castle A", person_id: "person-1", guest_name: null },
      { league_name: "A League", team_id: "castle-a", team_name: "Castle A", person_id: "person-2", guest_name: null },
      { league_name: "A League", team_id: "castle-a", team_name: "Castle A", person_id: null, guest_name: "Guest One" },
      { league_name: "A League", team_id: "castle-a", team_name: "Castle A", person_id: null, guest_name: " guest one " },
      { league_name: "A League", team_id: "castle-a", team_name: "Castle A", person_id: null, guest_name: "Guest Two" },
      { league_name: "C League", team_id: "newlands-c", team_name: "Newlands C", person_id: "person-3", guest_name: null }
    ]
  });

  assert.equal(stats.totals.matches, 3);
  assert.equal(stats.totals.played, 2);
  assert.equal(stats.totals.postponed, 1);
  assert.equal(stats.totals.homeWins, 1);
  assert.equal(stats.totals.awayWins, 1);
  assert.equal(stats.totals.homeWinPct, 50);
  assert.deepEqual(
    stats.scorelines.map((row) => [row.scoreline, row.count]),
    [
      ["2-5", 1],
      ["7-0", 1]
    ]
  );
  assert.deepEqual(
    stats.playersUsedByTeam.map((row) => [row.teamName, row.count]),
    [
      ["Castle A", 4],
      ["Newlands C", 1]
    ]
  );
  assert.equal(stats.mostCommonScoreline, "2-5");
});

test("buildAdminMatchStats provides complete views for all leagues and each league", () => {
  const stats = buildAdminMatchStats({
    fixtures: [
      { fixture_id: "a-1", league_name: "A League", status: "Completed", home_team_score: 7, away_team_score: 0 },
      { fixture_id: "b-1", league_name: "B League", status: "Completed", home_team_score: 3, away_team_score: 4 },
      { fixture_id: "c-1", league_name: "C League", status: "Scheduled", home_team_score: 0, away_team_score: 0 }
    ],
    appearances: [
      { league_name: "A League", team_id: "a-team", team_name: "A Team", person_id: "a-player", guest_name: null },
      { league_name: "B League", team_id: "b-team", team_name: "B Team", person_id: null, guest_name: "B Guest" }
    ]
  });

  assert.deepEqual(stats.scopes.map((scope) => scope.leagueName), ["All leagues", "A League", "B League", "C League"]);
  assert.equal(stats.scopes[0].totals.matches, 3);
  assert.equal(stats.scopes[1].totals.matches, 1);
  assert.equal(stats.scopes[1].totals.homeWins, 1);
  assert.deepEqual(stats.scopes[1].playersUsedByTeam.map((row) => row.teamName), ["A Team"]);
  assert.equal(stats.scopes[2].totals.awayWins, 1);
  assert.deepEqual(stats.scopes[2].playersUsedByTeam.map((row) => row.teamName), ["B Team"]);
  assert.equal(stats.scopes[3].totals.scheduled, 1);
});
