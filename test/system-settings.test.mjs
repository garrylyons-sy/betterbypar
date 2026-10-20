import assert from 'node:assert/strict';
import test from 'node:test';
const { defaultSystemSettings, validateSystemSettings, normalizeSystemSettings, isPollingTime, pollingFixtureDate } = await import('../lib/system-settings.mjs');
test('defaults preserve current polling behavior', () => {
  assert.equal(defaultSystemSettings.matchActiveSeconds, 60);
  assert.equal(defaultSystemSettings.matchIdleSeconds, 300);
  assert.equal(defaultSystemSettings.liveScorerSeconds, 15);
  assert.equal(defaultSystemSettings.matchWindowStart, '19:30');
  assert.deepEqual(validateSystemSettings(defaultSystemSettings), defaultSystemSettings);
});
test('rejects unsafe and malformed configuration', () => {
  for (const patch of [{matchActiveSeconds: 0}, {liveScorerSeconds: 1}, {liveScorerSeconds: 45}, {matchIdleSeconds: '300'}, {matchActiveSeconds: 10.5}, {matchWindowStart: '24:00'}, {matchWindowEnd: '7:00'}, {secret: true}, {matchActiveSeconds: 600, matchIdleSeconds: 60}]) {
    assert.throws(() => validateSystemSettings({...defaultSystemSettings, ...patch}));
  }
  assert.throws(() => validateSystemSettings(null));
});
test('normalization safely fills old or invalid saved settings', () => {
  assert.deepEqual(normalizeSystemSettings(null), defaultSystemSettings);
  const normalized = normalizeSystemSettings({liveScorerSeconds: 25, matchActiveSeconds: -1});
  assert.equal(normalized.liveScorerSeconds, 25);
  assert.equal(normalized.matchActiveSeconds, 60);
});
test('polling window includes endpoints and supports crossing midnight', () => {
  assert.equal(isPollingTime('19:29', defaultSystemSettings), false);
  assert.equal(isPollingTime('19:30', defaultSystemSettings), true);
  assert.equal(isPollingTime('23:30', defaultSystemSettings), true);
  assert.equal(isPollingTime('23:31', defaultSystemSettings), false);
  const overnight = {...defaultSystemSettings, matchWindowStart:'22:00', matchWindowEnd:'02:00'};
  assert.equal(isPollingTime('23:00', overnight), true);
  assert.equal(isPollingTime('01:00', overnight), true);
  assert.equal(isPollingTime('12:00', overnight), false);
});

test('after-midnight polling tracks the previous evening fixture', () => {
  const settings = {...defaultSystemSettings, matchWindowStart:'22:00', matchWindowEnd:'02:00'};
  assert.equal(pollingFixtureDate(new Date(2026, 9, 21, 1, 30), settings), '2026-10-20');
  assert.equal(pollingFixtureDate(new Date(2026, 9, 20, 23, 0), settings), '2026-10-20');
  assert.equal(pollingFixtureDate(new Date(2026, 9, 21, 3, 0), settings), '2026-10-21');
  assert.equal(pollingFixtureDate(new Date(2026, 9, 21, 1, 30), defaultSystemSettings), '2026-10-21');
});
