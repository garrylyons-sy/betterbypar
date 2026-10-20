export type SystemSettings = {
  matchActiveSeconds: number;
  matchIdleSeconds: number;
  liveStatusSeconds: number;
  liveDashboardSeconds: number;
  liveScorerSeconds: number;
  liveObserverSeconds: number;
  matchWindowStart: string;
  matchWindowEnd: string;
};
export const defaultSystemSettings: Readonly<SystemSettings>;
export const systemSettingFields: Array<{key: keyof SystemSettings; label: string; description: string; defaultValue: number | string; min?: number; max?: number}>;
export function validateSystemSettings(input: unknown): SystemSettings;
export function normalizeSystemSettings(input: unknown): SystemSettings;
export function isPollingTime(time: string, settings: SystemSettings): boolean;
export function pollingFixtureDate(date: Date, settings: SystemSettings): string;
