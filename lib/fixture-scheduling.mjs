function isoDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

export function calendarWeekKey(value) {
  const dateText = isoDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return "";

  const date = new Date(`${dateText}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function shouldShowFixtureDates(weekDate, fixtureDates) {
  const displayedDate = isoDate(weekDate);
  return fixtureDates.some((fixtureDate) => isoDate(fixtureDate) !== displayedDate);
}

export function organizeFixtureWeeks({
  weeks,
  fixtures,
  rescheduledIdPrefix = "rescheduled-",
  rescheduledWeekLabel = "Rescheduled matches",
  rescheduledIntoExistingWeeks = true
}) {
  const groups = new Map();
  const weekByCalendarKey = new Map();

  for (const week of weeks) {
    const group = { ...week, fixtures: [], postponedFixtures: [] };
    groups.set(week.id, group);
    weekByCalendarKey.set(calendarWeekKey(week.startsOn), group);
  }

  for (const fixture of fixtures) {
    const effectiveDate = isoDate(fixture.fixtureDate);
    const originalGroup = groups.get(fixture.originalWeekId);
    const originalDate = isoDate(fixture.originalFixtureDate) || isoDate(originalGroup?.startsOn);
    const rescheduled = Boolean(originalDate && effectiveDate && originalDate !== effectiveDate);
    const effectiveWeekKey = calendarWeekKey(effectiveDate);
    let targetGroup = !rescheduled && originalGroup
      ? originalGroup
      : rescheduledIntoExistingWeeks
        ? weekByCalendarKey.get(effectiveWeekKey)
        : undefined;

    if (!targetGroup) {
      const id = `${rescheduledIdPrefix}${effectiveWeekKey}`;
      targetGroup = groups.get(id) ?? {
        id,
        weekNumber: null,
        weekLabel: rescheduledWeekLabel,
        startsOn: fixture.fixtureDate,
        competitionType: originalGroup?.competitionType,
        fixtures: [],
        postponedFixtures: []
      };
      if (String(fixture.fixtureDate) < String(targetGroup.startsOn)) {
        targetGroup.startsOn = fixture.fixtureDate;
      }
      groups.set(id, targetGroup);
      weekByCalendarKey.set(effectiveWeekKey, targetGroup);
    }

    targetGroup.fixtures.push({ ...fixture, rescheduled });

    if (rescheduled && originalGroup && originalGroup.id !== targetGroup.id) {
      originalGroup.postponedFixtures.push({
        fixtureId: fixture.id,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
        postponedTo: fixture.fixtureDate
      });
    }
  }

  return Array.from(groups.values())
    .filter((week) => week.fixtures.length || week.postponedFixtures.length)
    .map((week) => ({
      ...week,
      fixtures: week.fixtures.sort((a, b) => (
        String(a.fixtureDate).localeCompare(String(b.fixtureDate))
        || String(a.homeTeamName).localeCompare(String(b.homeTeamName))
      )),
      postponedFixtures: week.postponedFixtures.sort((a, b) => (
        String(a.postponedTo).localeCompare(String(b.postponedTo))
        || String(a.homeTeamName).localeCompare(String(b.homeTeamName))
      ))
    }))
    .sort((a, b) => String(a.startsOn).localeCompare(String(b.startsOn)));
}
