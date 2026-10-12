import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

async function loadSchedulingModule() {
  try {
    return await import("../lib/fixture-scheduling.mjs");
  } catch {
    return {};
  }
}

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

test("rescheduled fixtures move to their effective calendar week and leave a notice behind", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  assert.equal(typeof organizeFixtureWeeks, "function", "organizeFixtureWeeks must be implemented");

  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "week-1", weekNumber: 1, weekLabel: "Week 1", startsOn: "2026-10-01" },
      { id: "week-4", weekNumber: 4, weekLabel: "Week 4 - Break week", startsOn: "2026-10-22" }
    ],
    fixtures: [
      {
        id: "castle-dl",
        originalWeekId: "week-1",
        originalFixtureDate: "2026-10-01T19:30:00.000Z",
        fixtureDate: "2026-10-22T19:30:00.000Z",
        homeTeamName: "Castle A",
        awayTeamName: "Dun Laoghaire A"
      }
    ]
  });

  const originalWeek = weeks.find((week) => week.id === "week-1");
  const breakWeek = weeks.find((week) => week.id === "week-4");

  assert.deepEqual(originalWeek?.fixtures, []);
  assert.deepEqual(originalWeek?.postponedFixtures, [{
    fixtureId: "castle-dl",
    homeTeamName: "Castle A",
    awayTeamName: "Dun Laoghaire A",
    postponedTo: "2026-10-22T19:30:00.000Z"
  }]);
  assert.equal(breakWeek?.weekLabel, "Week 4 - Break week");
  assert.equal(breakWeek?.fixtures[0]?.id, "castle-dl");
  assert.equal(breakWeek?.fixtures[0]?.rescheduled, true);
});

test("a team can have separate Tuesday and Thursday fixtures in the same displayed week", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  assert.equal(typeof organizeFixtureWeeks, "function", "organizeFixtureWeeks must be implemented");

  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "week-4", weekNumber: 4, weekLabel: "Week 4 - Break week", startsOn: "2026-10-22" }
    ],
    fixtures: [
      {
        id: "tuesday-match",
        originalWeekId: "week-4",
        originalFixtureDate: "2026-10-20T19:30:00.000Z",
        fixtureDate: "2026-10-20T19:30:00.000Z",
        homeTeamName: "Castle A",
        awayTeamName: "Milltown A"
      },
      {
        id: "thursday-match",
        originalWeekId: "week-4",
        originalFixtureDate: "2026-10-22T19:30:00.000Z",
        fixtureDate: "2026-10-22T19:30:00.000Z",
        homeTeamName: "Castle A",
        awayTeamName: "Dun Laoghaire A"
      }
    ]
  });

  assert.deepEqual(
    weeks[0].fixtures.map((fixture) => fixture.id),
    ["tuesday-match", "thursday-match"]
  );
});

test("a rescheduled fixture outside the published calendar uses a rescheduled matches group", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  assert.equal(typeof organizeFixtureWeeks, "function", "organizeFixtureWeeks must be implemented");

  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "week-1", weekNumber: 1, weekLabel: "Week 1", startsOn: "2026-10-01" }
    ],
    fixtures: [
      {
        id: "christmas-match",
        originalWeekId: "week-1",
        originalFixtureDate: "2026-10-01T19:30:00.000Z",
        fixtureDate: "2026-12-29T19:30:00.000Z",
        homeTeamName: "Castle A",
        awayTeamName: "Newlands A"
      }
    ]
  });

  const rescheduledWeek = weeks.find((week) => week.id.startsWith("rescheduled-"));
  assert.equal(rescheduledWeek?.weekNumber, null);
  assert.equal(rescheduledWeek?.weekLabel, "Rescheduled matches");
  assert.equal(rescheduledWeek?.fixtures[0]?.id, "christmas-match");
});

test("fixture APIs preserve the original date and organize rows by effective week", () => {
  const schema = source("../supabase/schema.sql");
  const migration = source("../supabase/fixture_rescheduling.sql");
  const fixtureWeeksRoute = source("../app/api/fixtures/weeks/route.ts");
  const adminMatchesRoute = source("../app/api/admin/matches/route.ts");

  assert.match(schema, /original_fixture_date timestamptz/);
  assert.match(migration, /add column if not exists original_fixture_date timestamptz/);
  assert.match(fixtureWeeksRoute, /organizeFixtureWeeks/);
  assert.match(fixtureWeeksRoute, /from public\.fixture_week fw[\s\S]*where l\.name = \$1[\s\S]*and s\.name = \$2/);
  assert.match(adminMatchesRoute, /original_fixture_date = case[\s\S]*fixture_date::date is distinct from \$2::date/);
  assert.match(adminMatchesRoute, /update public\.fixture_lineup[\s\S]*set status = 'Draft'/);
  assert.match(adminMatchesRoute, /m\.home_team_score <> 0[\s\S]*m\.away_team_score <> 0[\s\S]*f\.status = 'Completed'/);
});

test("the fixtures UI separates actionable rescheduled matches from old-week notices", () => {
  const appShell = source("../components/app-shell.tsx");

  assert.match(appShell, /postponedFixtures/);
  assert.match(appShell, /Postponed to/);
  assert.match(appShell, /fixture\.rescheduled[\s\S]*Rescheduled/);
  assert.match(appShell, /formatFixtureDate\(fixture\.fixtureDate\)/);
});
