import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import test from 'node:test';
const file = path => readFileSync(new URL(`../${path}`, import.meta.url),'utf8');
test('notification settings have a dedicated platform-only API', () => {
  assert.ok(existsSync(new URL('../app/api/admin/notifications/route.ts',import.meta.url)), 'notification admin API missing');
  const route = file('app/api/admin/notifications/route.ts');
  assert.match(route,/currentUser/);
  assert.match(route,/isPlatformOperator/);
  assert.match(route,/status: 403/);
  assert.match(route,/validateNotificationConfig/);
});
test('Notifications has its own admin navigation section with role audience and reminder controls', () => {
  const panel = file('components/admin-notifications.tsx');
  assert.doesNotMatch(file('components/admin-system.tsx'),/AdminNotifications/);
  assert.match(file('components/admin-console.tsx'),/id: "notifications"/);
  assert.match(file('components/admin-console.tsx'),/props\.tab === "notifications"/);
  assert.match(panel,/eligibleRoles/);
  assert.match(panel,/League Chair/);
  assert.doesNotMatch(panel,/matchReminderHours/);
  assert.match(panel,/lineupDeadlineHours/);
  assert.doesNotMatch(panel,/ladderReminderHours/);
  assert.match(panel,/lineup_published/);
  assert.match(panel,/match_result/);
  assert.match(panel,/quietStart/);
});
test('scheduled notification worker requires secret and is registered', () => {
  const route = file('app/api/cron/notifications/route.ts');
  assert.match(route,/CRON_SECRET/);
  assert.match(route,/status: 401/);
  assert.match(route,/processNotificationReminders/);
  assert.match(route,/processNotificationPush/);
  assert.ok(JSON.parse(file('vercel.json')).crons.some(job => job.path === '/api/cron/notifications'));
});

test('notification schedules retain Hobby-compatible daily jobs and secured after-response dispatch', () => {
  const jobs=JSON.parse(file('vercel.json')).crons.filter(job=>job.path==='/api/cron/notifications');
  assert.equal(jobs.length,24);
  assert.ok(jobs.every(job=>/^35 \d+ \* \* \*$/.test(job.schedule)));
  assert.match(file('lib/server/notification-dispatch.ts'),/after\(async/);
  assert.match(file('components/auth-gateway.tsx'),/await disconnectNotificationDevice\(\)/);
});
test('club venue edits create fixture-change notifications and dispatch after commit', () => {
  const route=file('app/api/admin/clubs/route.ts');
  assert.match(route,/notifyFixtureChanged/);
  assert.match(route,/changes\.includes\("venue"\)/);
  assert.match(route,/scheduleNotificationPush\(\)/);
});
test('logout also closes displayed device notifications', () => {
  const source=file('components/notification-center.tsx');
  assert.match(source,/getNotifications\(\)/);
  assert.match(source,/notification\.close\(\)/);
});
