import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("scheduled Last Man Standing processing is secured and configured for Hobby-compatible daily jobs", () => {
  const route = new URL("../app/api/cron/last-man-standing/route.ts", import.meta.url);
  assert.equal(existsSync(route), true);
  const source = read("../app/api/cron/last-man-standing/route.ts");
  assert.match(source, /process\.env\.CRON_SECRET/);
  assert.match(source, /Bearer/);
  assert.match(source, /processDueLastManStandingWork/);

  const config = JSON.parse(read("../vercel.json"));
  assert.ok(Array.isArray(config.crons));
  const jobs = config.crons.filter((cron) => cron.path === "/api/cron/last-man-standing");
  assert.ok(jobs.length >= 24);
  assert.ok(jobs.every((cron) => cron.path === "/api/cron/last-man-standing"));
  assert.ok(jobs.every((cron) => /^30 \d+ \* \* \*$/.test(cron.schedule)));
});
