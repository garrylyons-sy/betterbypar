export type FixtureScheduleWeek = {
  id: string;
  weekNumber: number | null;
  weekLabel: string;
  startsOn: string;
};

export type FixtureScheduleItem = {
  id: string;
  originalWeekId: string;
  originalFixtureDate?: string | Date | null;
  fixtureDate: string | Date;
  homeTeamName: string;
  awayTeamName: string;
  [key: string]: unknown;
};

export type PostponedFixtureNotice = {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  postponedTo: string;
};

export function calendarWeekKey(value: unknown): string;

export function shouldShowFixtureDates(weekDate: unknown, fixtureDates: unknown[]): boolean;

export function cupPlaceholderForTie(input: {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeSourceMatchNumber?: number | null;
  awaySourceMatchNumber?: number | null;
  previousRoundName?: string;
}): { homeLabel: string; awayLabel: string } | null;

export function organizeFixtureWeeks<T extends FixtureScheduleItem>(input: {
  weeks: FixtureScheduleWeek[];
  fixtures: T[];
}): Array<FixtureScheduleWeek & {
  fixtures: Array<T & { rescheduled: boolean }>;
  postponedFixtures: PostponedFixtureNotice[];
}>;
