import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const ui = readFileSync(new URL('../components/notification-center.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../components/app-shell.tsx', import.meta.url), 'utf8');
test('notification access comes from server and refresh only while visible', () => {
  assert.match(ui, /payload\.eligible/);
  assert.match(ui, /if \(!authenticated\) return/);
  assert.match(ui, /document\.visibilityState !== "visible"/);
  assert.match(ui, /60_000/);
  assert.doesNotMatch(ui, /withTestUser|testAwarePath/);
  assert.match(ui, /if \(!state\.eligible\) return null/);
});
test('push permission is an explicit action and subscription is separate from account preference', () => {
  assert.match(ui, /async function enableDevicePush/);
  assert.match(ui, /Notification\.requestPermission\(\)/);
  assert.match(ui, /subscription\.toJSON\(\)/);
  assert.match(ui, /JSON\.stringify\(\{ endpoint: subscription\.endpoint \}\)/);
  assert.match(ui, /Home Screen/);
});
test('inbox uses accessible modal and safe destination, with settings in account menu', () => {
  assert.match(ui, /\.showModal\(\)/);
  assert.match(ui, /safeNotificationHref\(item.href\)/);
  assert.match(ui, /JSON\.stringify\(id \? \{ id \} : \{ all: true \}\)/);
  assert.match(shell, /NotificationCenter/);
  assert.match(shell, /Notification settings/);
  assert.match(shell, /requestedPage === "Fixtures"/);
});

test('device controls resolve the browser subscription, refresh admin eligibility and provide logout cleanup', () => {
  assert.match(ui, /\/api\/notifications\/push\?endpoint=/);
  assert.match(ui, /subscribed: Boolean\(subscription && payload.subscribed\)/);
  assert.match(ui, /interclub:notification-settings-changed/);
  assert.match(ui, /export async function disconnectNotificationDevice/);
  assert.match(ui, /AbortSignal.timeout\(3_000\)/);
});

test('fixture links scroll the matching fixture into view', () => {
  assert.match(shell, /id=\{`fixture-\$\{fixture\.id\}`\}/);
  assert.match(shell, /getElementById\(`fixture-\$\{selectedFixtureId\}`\)/);
});
