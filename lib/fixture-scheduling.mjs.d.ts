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

export type CupDisplayWeek<TFixture = Record<string, unknown>, TPlaceholder = Record<string, unknown>> = FixtureScheduleWeek & {
  competitionType: "Cup";
  fixtures: TFixture[];
  postponedFixtures: PostponedFixtureNotice[];
  cupPlaceholders: TPlaceholder[];
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

export function mergeCupWeeksByDate<TFixture = Record<string, unknown>, TPlaceholder = Record<string, unknown>>(
  weeks: Array<CupDisplayWeek<TFixture, TPlaceholder>>
): Array<CupDisplayWeek<TFixture & { cupSectionLabel?: string; cupSectionStart?: boolean }, TPlaceholder & { cupSectionLabel?: string; cupSectionStart?: boolean }> & {
  cupSections: Array<CupDisplayWeek<TFixture, TPlaceholder>>;
}>;

export function mergeFixturePagesByDate<
  TLeagueFixture extends Record<string, unknown> = Record<string, unknown>,
  TCupFixture extends Record<string, unknown> = Record<string, unknown>,
  TPlaceholder extends Record<string, unknown> = Record<string, unknown>
>(
  leagueWeeks: Array<FixtureScheduleWeek & {
    fixtures: TLeagueFixture[];
    postponedFixtures: PostponedFixtureNotice[];
    cupPlaceholders?: TPlaceholder[];
    cupSections?: Array<CupDisplayWeek<TCupFixture, TPlaceholder>>;
  }>,
  cupWeeks: Array<CupDisplayWeek<TCupFixture, TPlaceholder>>
): Array<FixtureScheduleWeek & {
  competitionType?: "Cup";
  fixtures: Array<TLeagueFixture | (TCupFixture & { cupSectionLabel?: string; cupSectionStart?: boolean })>;
  postponedFixtures: Array<PostponedFixtureNotice & { cupSectionLabel?: string; cupSectionStart?: boolean }>;
  cupPlaceholders: Array<TPlaceholder & { cupSectionLabel?: string; cupSectionStart?: boolean }>;
  cupSections: Array<CupDisplayWeek<TCupFixture, TPlaceholder>>;
}>;

export type FixtureCarouselRow<TFixture, TPlaceholder, TPostponed> =
  | { kind: "section"; label: string }
  | { kind: "placeholder"; item: TPlaceholder }
  | { kind: "postponed"; item: TPostponed }
  | { kind: "fixture"; item: TFixture };

export function fixtureCarouselRows<
  TFixture extends { cupSectionLabel?: string } = Record<string, unknown> & { cupSectionLabel?: string },
  TPlaceholder extends { cupSectionLabel?: string } = Record<string, unknown> & { cupSectionLabel?: string },
  TPostponed extends { cupSectionLabel?: string } = PostponedFixtureNotice & { cupSectionLabel?: string }
>(week: {
  competitionType?: "League" | "Cup";
  fixtures: TFixture[];
  postponedFixtures: TPostponed[];
  cupPlaceholders?: TPlaceholder[];
  cupSections?: Array<{ weekLabel: string }>;
}): Array<FixtureCarouselRow<TFixture, TPlaceholder, TPostponed>>;

export function organizeFixtureWeeks<T extends FixtureScheduleItem>(input: {
  weeks: FixtureScheduleWeek[];
  fixtures: T[];
}): Array<FixtureScheduleWeek & {
  fixtures: Array<T & { rescheduled: boolean }>;
  postponedFixtures: PostponedFixtureNotice[];
}>;
