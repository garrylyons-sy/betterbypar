export const systemSettingFields = [
  { key: 'matchActiveSeconds', label: 'Match refresh while playing', description: 'Fixture scores and manager lineups once play has started.', defaultValue: 60, min: 10, max: 900 },
  { key: 'matchIdleSeconds', label: 'Match refresh before play', description: 'Fixture scores and manager lineups before the first result.', defaultValue: 300, min: 10, max: 1800 },
  { key: 'liveStatusSeconds', label: 'Live score indicators', description: 'Live indicators alongside fixtures.', defaultValue: 60, min: 10, max: 900 },
  { key: 'liveDashboardSeconds', label: 'Live scoring dashboard', description: 'Refresh frequency for the live scoring overview.', defaultValue: 60, min: 10, max: 900 },
  { key: 'liveScorerSeconds', label: 'Live scorer refresh', description: 'Background refresh while controlling a live frame. Score submissions still save immediately. Maximum 30 seconds to retain scorer control.', defaultValue: 15, min: 5, max: 30 },
  { key: 'liveObserverSeconds', label: 'Live observer refresh', description: 'Background refresh while watching a frame.', defaultValue: 30, min: 5, max: 300 },
  { key: 'matchWindowStart', label: 'Match-night polling starts', description: 'Device local time. Only unfinished fixtures for that match night are polled.', defaultValue: '19:30' },
  { key: 'matchWindowEnd', label: 'Match-night polling ends', description: 'Device local time. Windows can cross midnight.', defaultValue: '23:30' }
];
export const defaultSystemSettings = Object.freeze(Object.fromEntries(systemSettingFields.map(field => [field.key, field.defaultValue])));
function valid(field, value) {
  return typeof field.defaultValue === 'string'
    ? typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    : typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max;
}
export function validateSystemSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.');
  if (Object.keys(input).some(key => !(key in defaultSystemSettings))) throw new Error('Unknown system setting.');
  for (const field of systemSettingFields) {
    if (!valid(field, input[field.key])) throw new Error(`${field.label}: ${typeof field.defaultValue === 'string' ? 'enter a valid time.' : `enter whole seconds between ${field.min} and ${field.max}.`}`);
  }
  if (input.matchIdleSeconds < input.matchActiveSeconds) throw new Error('Before-play refresh must be at least as long as refresh while playing.');
  return {...input};
}
export function normalizeSystemSettings(input) {
  const settings = {...defaultSystemSettings};
  for (const field of systemSettingFields) if (valid(field, input?.[field.key])) settings[field.key] = input[field.key];
  if (settings.matchIdleSeconds < settings.matchActiveSeconds) settings.matchIdleSeconds = Math.max(defaultSystemSettings.matchIdleSeconds, settings.matchActiveSeconds);
  return settings;
}
export function isPollingTime(time, settings) {
  const {matchWindowStart: start, matchWindowEnd: end} = settings;
  return start <= end ? time >= start && time <= end : time >= start || time <= end;
}
// A match-night window crossing midnight continues tracking the evening's fixtures.
export function pollingFixtureDate(date, settings) {
  const current = new Date(date);
  const time = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
  if (settings.matchWindowStart > settings.matchWindowEnd && time <= settings.matchWindowEnd) current.setDate(current.getDate() - 1);
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
}
