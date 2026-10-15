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

test("PostgreSQL Date values stay in their calendar week", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  assert.equal(typeof organizeFixtureWeeks, "function", "organizeFixtureWeeks must be implemented");

  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "week-3", weekNumber: 3, weekLabel: "Week 3", startsOn: "2026-10-15" }
    ],
    fixtures: [
      {
        id: "week-three-match",
        originalWeekId: "week-3",
        originalFixtureDate: null,
        fixtureDate: new Date("2026-10-15T19:30:00.000Z"),
        homeTeamName: "Elm Park A",
        awayTeamName: "Castle A"
      }
    ]
  });

  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].id, "week-3");
  assert.deepEqual(weeks[0].fixtures.map((fixture) => fixture.id), ["week-three-match"]);
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

test("cup postponements can use competition-specific rescheduled groups", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "cup-round-1", weekNumber: null, weekLabel: "Club Cup · Quarter Final", startsOn: "2026-11-05", competitionType: "Cup" }
    ],
    fixtures: [
      {
        id: "cup-tie",
        originalWeekId: "cup-round-1",
        originalFixtureDate: "2026-11-05T19:30:00.000Z",
        fixtureDate: "2026-11-17T19:30:00.000Z",
        homeTeamName: "Castle A",
        awayTeamName: "Milltown A"
      }
    ],
    rescheduledIdPrefix: "cup-club-cup-rescheduled-",
    rescheduledWeekLabel: "Club Cup · Rescheduled matches",
    rescheduledIntoExistingWeeks: false
  });

  const originalRound = weeks.find((week) => week.id === "cup-round-1");
  const rescheduledRound = weeks.find((week) => week.id.startsWith("cup-club-cup-rescheduled-"));
  assert.equal(originalRound?.postponedFixtures[0]?.fixtureId, "cup-tie");
  assert.equal(rescheduledRound?.weekLabel, "Club Cup · Rescheduled matches");
  assert.equal(rescheduledRound?.competitionType, "Cup");
  assert.equal(rescheduledRound?.fixtures[0]?.id, "cup-tie");
});

test("cup rounds on different days in the same week retain their own headings", async () => {
  const { organizeFixtureWeeks } = await loadSchedulingModule();
  const weeks = organizeFixtureWeeks({
    weeks: [
      { id: "quarter-final", weekNumber: null, weekLabel: "Quarter Final", startsOn: "2026-11-03", competitionType: "Cup" },
      { id: "semi-final", weekNumber: null, weekLabel: "Semi Final", startsOn: "2026-11-05", competitionType: "Cup" }
    ],
    fixtures: [
      { id: "qf", originalWeekId: "quarter-final", originalFixtureDate: "2026-11-03", fixtureDate: "2026-11-03", homeTeamName: "A", awayTeamName: "B" },
      { id: "sf", originalWeekId: "semi-final", originalFixtureDate: "2026-11-05", fixtureDate: "2026-11-05", homeTeamName: "C", awayTeamName: "D" }
    ],
    rescheduledIntoExistingWeeks: false
  });

  assert.deepEqual(weeks.map((week) => [week.weekLabel, week.fixtures.map((fixture) => fixture.id)]), [
    ["Quarter Final", ["qf"]],
    ["Semi Final", ["sf"]]
  ]);
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
  assert.match(appShell, /const showFixtureDates = week[\s\S]*shouldShowFixtureDates\(week\.startsOn, week\.fixtures\.map\(\(fixture\) => fixture\.fixtureDate\)\)/);
  assert.match(appShell, /showFixtureDates \? \([\s\S]*formatFixtureDate\(fixture\.fixtureDate\)/);
});

test("fixture dates are only repeated when a displayed week contains another match day", async () => {
  const { shouldShowFixtureDates } = await import("../lib/fixture-scheduling.mjs");

  assert.equal(shouldShowFixtureDates("2026-10-15", [
    "2026-10-15T19:30:00.000Z",
    "2026-10-15T19:30:00.000Z"
  ]), false);
  assert.equal(shouldShowFixtureDates("2026-10-15", [
    "2026-10-13T19:30:00.000Z",
    "2026-10-15T19:30:00.000Z"
  ]), true);
});

test("cup byes stay out of fixture lists while real future ties remain visible", async () => {
  const { cupPlaceholderForTie } = await import("../lib/fixture-scheduling.mjs");

  assert.equal(cupPlaceholderForTie({
    homeTeamName: "Grange A",
    awayTeamName: null,
    homeSourceMatchNumber: null,
    awaySourceMatchNumber: null,
    previousRoundName: "draw"
  }), null);
  assert.deepEqual(cupPlaceholderForTie({
    homeTeamName: null,
    awayTeamName: null,
    homeSourceMatchNumber: 1,
    awaySourceMatchNumber: 2,
    previousRoundName: "Quarter Final"
  }), {
    homeLabel: "Winner of Quarter Final match 1",
    awayLabel: "Winner of Quarter Final match 2"
  });
});

test("the fixtures page includes cup rounds in only its first league carousel", () => {
  const appShell = source("../components/app-shell.tsx");
  const fixtureWeeksRoute = source("../app/api/fixtures/weeks/route.ts");

  assert.match(appShell, /orderedLeagues\.map\(\(league, index\)/);
  assert.match(appShell, /includeCups=\{index === 0\}/);
  assert.match(appShell, /params\.set\("includeCups", includeCups \? "1" : "0"\)/);
  assert.match(fixtureWeeksRoute, /const includeCups = request\.nextUrl\.searchParams\.get\("includeCups"\) !== "0"/);
  assert.match(fixtureWeeksRoute, /const cupRows = includeCups \?/);
});

test("the mobile navigation is outside the scrolling app main", () => {
  const appShell = source("../components/app-shell.tsx");
  const shellStart = appShell.indexOf('return (\n    <>');
  const mainClose = appShell.indexOf("</main>", shellStart);
  const nav = appShell.indexOf("<BottomNav", shellStart);
  const fragmentClose = appShell.indexOf("</>", shellStart);

  assert.ok(shellStart >= 0, "the app shell should use a fragment around its viewport layers");
  assert.ok(mainClose >= 0 && nav > mainClose && fragmentClose > nav, "the fixed mobile navigation should be a sibling after main");
});
