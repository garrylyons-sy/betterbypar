import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cupTeamCountError, toggleCupTeamSelection } from "../lib/cup-competition-form.mjs";
import { buildCupBracket, nextCupTieTarget } from "../lib/server/cup-draw.mjs";

const migration = readFileSync(new URL("../supabase/interclub_cup_competitions.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");
const managerRoute = readFileSync(new URL("../app/api/manager/lineup/route.ts", import.meta.url), "utf8");
const fixtureRoute = readFileSync(new URL("../app/api/fixtures/weeks/route.ts", import.meta.url), "utf8");
const cupAdmin = readFileSync(new URL("../components/admin-cup-competitions.tsx", import.meta.url), "utf8");
const cupAdminRoute = readFileSync(new URL("../app/api/admin/cup-competitions/route.ts", import.meta.url), "utf8");
const expandedVisibilityMigration = readFileSync(new URL("../supabase/cup_competition_expanded_visibility.sql", import.meta.url), "utf8");

test("cup bracket creates first-round byes and every later-round placeholder", () => {
  const bracket = buildCupBracket({
    teamIds: ["a", "b", "c", "d", "e", "f"],
    roundCount: 3,
    random: () => 0.5
  });

  assert.equal(bracket.length, 7);
  assert.equal(bracket.filter((tie) => tie.roundNumber === 1).length, 4);
  assert.equal(bracket.filter((tie) => tie.roundNumber === 1 && tie.status === "Bye").length, 2);
  assert.equal(bracket.filter((tie) => tie.roundNumber === 2 && tie.status === "Awaiting Teams").length, 2);
  assert.deepEqual(nextCupTieTarget(1, 3), { roundNumber: 2, matchNumber: 2, side: "home" });
  assert.deepEqual(nextCupTieTarget(1, 4), { roundNumber: 2, matchNumber: 2, side: "away" });
});

test("cup bracket rejects a round count that cannot exactly contain the entrants", () => {
  assert.throws(
    () => buildCupBracket({ teamIds: ["a", "b", "c", "d", "e"], roundCount: 2 }),
    /more than 2 rounds/
  );
  assert.throws(
    () => buildCupBracket({ teamIds: ["a", "b"], roundCount: 3 }),
    /fewer rounds/
  );
});

test("cup setup prevents selecting more teams than the chosen draw can hold", () => {
  const selected = ["a", "b", "c", "d", "e", "f", "g", "h"];

  assert.deepEqual(toggleCupTeamSelection({ teamIds: selected, teamId: "i", capacity: 8 }), selected);
  assert.deepEqual(toggleCupTeamSelection({ teamIds: selected, teamId: "h", capacity: 8 }), ["a", "b", "c", "d", "e", "f", "g"]);
  assert.deepEqual(toggleCupTeamSelection({ teamIds: selected.slice(0, 7), teamId: "h", capacity: 8 }), selected);
});

test("cup setup explains team-count errors for the selected number of rounds", () => {
  assert.equal(cupTeamCountError({ teamCount: 9, roundCount: 3 }), "A 3-round cup can include no more than 8 teams. Remove 1 team.");
  assert.equal(cupTeamCountError({ teamCount: 4, roundCount: 3 }), "A 3-round cup needs between 5 and 8 teams.");
  assert.equal(cupTeamCountError({ teamCount: 5, roundCount: 3 }), "");
  assert.equal(cupTeamCountError({ teamCount: 8, roundCount: 3 }), "");
});

test("cup schema stores format, entrants, dated rounds, ties and fixture links", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /create table(?: if not exists)? public\.cup_competition\b/);
    assert.match(source, /create table(?: if not exists)? public\.cup_competition_format_slot\b/);
    assert.match(source, /create table(?: if not exists)? public\.cup_competition_entry\b/);
    assert.match(source, /create table(?: if not exists)? public\.cup_competition_round\b/);
    assert.match(source, /create table(?: if not exists)? public\.cup_competition_tie\b/);
    assert.match(source, /fixture_type in \('League', 'Friendly', 'Cup'\)/);
  }
});

test("admin has a standalone Cup Competitions section with a draw action", () => {
  assert.match(adminConsole, /"cup-competitions"/);
  assert.match(adminConsole, /label: "Cup Competitions"/);
  assert.match(adminConsole, /AdminCupCompetitions/);
});

test("cup fixtures use stored format slots and progress after completion", () => {
  assert.match(managerRoute, /loadFixtureLineupMeta/);
  assert.match(managerRoute, /cup_competition_format_slot/);
  assert.match(managerRoute, /advanceCupFixture/);
  assert.match(managerRoute, /fixture_type: "League" \| "Friendly" \| "Cup"/);
});

test("fixture calendar includes cup fixtures and unresolved cup placeholders", () => {
  assert.match(fixtureRoute, /cup_competition_tie/);
  assert.match(fixtureRoute, /cupPlaceholders/);
  assert.match(fixtureRoute, /fixtureType: "League" \| "Cup"/);
});

test("cup visibility supports everyone, combined roles, selected leagues and league chairs", () => {
  for (const source of [migration, schema, expandedVisibilityMigration]) {
    assert.match(source, /'Everyone', 'All Players', 'All Managers', 'All Players and Managers', 'Specific Leagues', 'League Chairs'/);
    assert.match(source, /cup_competition_visibility_league/);
    assert.match(source, /can_person_view_cup/);
  }
  assert.match(expandedVisibilityMigration, /cc\.audience = 'Everyone'/);
  assert.match(expandedVisibilityMigration, /cc\.audience = 'All Players and Managers'/);
  assert.match(expandedVisibilityMigration, /ptr\.role in \('Player', 'Manager'\)/);
  assert.match(cupAdmin, /Everyone/);
  assert.match(cupAdmin, /All Players/);
  assert.match(cupAdmin, /All Managers/);
  assert.match(cupAdmin, /All Players and Managers/);
  assert.match(cupAdmin, /Specific Leagues/);
  assert.match(cupAdmin, /League Chairs/);
  assert.match(cupAdmin, /md:items-end/);
  assert.match(cupAdmin, /flex min-h-10 items-center/);
  assert.match(fixtureRoute, /can_person_view_cup/);
  assert.match(cupAdminRoute, /All Players and Managers/);
  assert.match(cupAdminRoute, /Everyone/);
});

test("deleting a cup removes generated fixtures and all competition-owned records", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /delete_cup_competition_fixtures/);
    assert.match(source, /before delete on public\.cup_competition/);
    assert.match(source, /delete from public\.fixture/);
  }
  assert.match(cupAdminRoute, /export async function DELETE/);
  assert.match(cupAdminRoute, /delete from public\.cup_competition where id = \$1/);
  assert.match(cupAdmin, /Delete competition/);
});
