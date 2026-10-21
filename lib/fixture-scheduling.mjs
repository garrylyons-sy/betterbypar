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

export function cupPlaceholderForTie({
  homeTeamName,
  awayTeamName,
  homeSourceMatchNumber,
  awaySourceMatchNumber,
  previousRoundName = "previous round"
}) {
  const homeLabel = homeTeamName || (homeSourceMatchNumber ? `Winner of ${previousRoundName} match ${homeSourceMatchNumber}` : "");
  const awayLabel = awayTeamName || (awaySourceMatchNumber ? `Winner of ${previousRoundName} match ${awaySourceMatchNumber}` : "");
  if (!homeLabel || !awayLabel) return null;
  return { homeLabel, awayLabel };
}

export function mergeCupWeeksByDate(weeks) {
  const byDate = new Map();

  for (const week of weeks) {
    const date = isoDate(week.startsOn);
    const group = byDate.get(date) ?? [];
    group.push(week);
    byDate.set(date, group);
  }

  return Array.from(byDate.entries())
    .map(([date, sections]) => {
      if (sections.length === 1) return { ...sections[0], cupSections: sections };

      const taggedSections = sections.map((section) => {
        const sectionLabel = section.weekLabel;
        const placeholders = section.cupPlaceholders ?? [];
        const postponed = section.postponedFixtures ?? [];
        const fixtures = section.fixtures ?? [];
        const firstCollection = placeholders.length
          ? "cupPlaceholders"
          : postponed.length
            ? "postponedFixtures"
            : "fixtures";
        const tag = (items, collection) => items.map((item, index) => ({
          ...item,
          cupSectionLabel: sectionLabel,
          cupSectionStart: collection === firstCollection && index === 0
        }));

        return {
          ...section,
          cupPlaceholders: tag(placeholders, "cupPlaceholders"),
          postponedFixtures: tag(postponed, "postponedFixtures"),
          fixtures: tag(fixtures, "fixtures")
        };
      });

      return {
        id: `cup-date-${date}`,
        weekNumber: null,
        weekLabel: "Cup matches",
        startsOn: date,
        competitionType: "Cup",
        fixtures: taggedSections.flatMap((section) => section.fixtures),
        postponedFixtures: taggedSections.flatMap((section) => section.postponedFixtures),
        cupPlaceholders: taggedSections.flatMap((section) => section.cupPlaceholders),
        cupSections: taggedSections
      };
    })
    .sort((left, right) => String(left.startsOn).localeCompare(String(right.startsOn)));
}

function tagCupSections(sections) {
  return sections.map((section) => {
    const placeholders = section.cupPlaceholders ?? [];
    const postponed = section.postponedFixtures ?? [];
    const fixtures = section.fixtures ?? [];
    const firstCollection = placeholders.length
      ? "cupPlaceholders"
      : postponed.length
        ? "postponedFixtures"
        : "fixtures";
    const tag = (items, collection) => items.map((item, index) => ({
      ...item,
      cupSectionLabel: section.weekLabel,
      cupSectionStart: collection === firstCollection && index === 0
    }));
    return {
      ...section,
      cupPlaceholders: tag(placeholders, "cupPlaceholders"),
      postponedFixtures: tag(postponed, "postponedFixtures"),
      fixtures: tag(fixtures, "fixtures")
    };
  });
}

export function mergeFixturePagesByDate(leagueWeeks, cupWeeks) {
  const pages = leagueWeeks.map((week) => ({
    ...week,
    fixtures: [...(week.fixtures ?? [])],
    postponedFixtures: [...(week.postponedFixtures ?? [])],
    cupPlaceholders: [...(week.cupPlaceholders ?? [])],
    cupSections: [...(week.cupSections ?? [])]
  }));

  for (const cupPage of mergeCupWeeksByDate(cupWeeks)) {
    const cupDate = isoDate(cupPage.startsOn);
    const target = pages.find((week) => (
      (week.fixtures ?? []).some((fixture) => isoDate(fixture.fixtureDate) === cupDate)
      || isoDate(week.startsOn) === cupDate
    ));
    if (!target) {
      pages.push(cupPage);
      continue;
    }

    const sections = tagCupSections(cupPage.cupSections?.length ? cupPage.cupSections : [cupPage]);
    target.cupSections.push(...sections);
    target.cupPlaceholders.push(...sections.flatMap((section) => section.cupPlaceholders));
    target.postponedFixtures.push(...sections.flatMap((section) => section.postponedFixtures));
    target.fixtures.push(...sections.flatMap((section) => section.fixtures));
  }

  return pages.sort((left, right) => String(left.startsOn).localeCompare(String(right.startsOn)));
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
