import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

async function loadVersionModule() {
  try {
    return await import("../lib/app-version.mjs");
  } catch {
    return {};
  }
}

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

test("installed clients reload only when a real deployment version changes", async () => {
  const { shouldReloadForAppVersion } = await loadVersionModule();
  assert.equal(typeof shouldReloadForAppVersion, "function", "shouldReloadForAppVersion must be implemented");

  assert.equal(shouldReloadForAppVersion("commit-a", "commit-b"), true);
  assert.equal(shouldReloadForAppVersion("commit-a", "commit-a"), false);
  assert.equal(shouldReloadForAppVersion("development", "commit-b"), false);
  assert.equal(shouldReloadForAppVersion("commit-a", "development"), false);
  assert.equal(shouldReloadForAppVersion("", "commit-b"), false);
});

test("the PWA checks for a new deployment on resume without a polling timer", () => {
  const register = source("../components/pwa-register.tsx");
  const layout = source("../app/layout.tsx");
  const route = source("../app/api/app-version/route.ts");

  assert.match(layout, /<PwaRegister deploymentVersion=\{deploymentVersion\}/);
  assert.match(register, /visibilitychange/);
  assert.match(register, /fetch\("\/api\/app-version"/);
  assert.match(register, /window\.location\.reload\(\)/);
  assert.doesNotMatch(register, /setInterval/);
  assert.match(route, /Cache-Control.*no-store/);
});
