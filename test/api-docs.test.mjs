import assert from "node:assert/strict";
import test from "node:test";

import { apiDocSections, developerDocsAuthModel } from "../lib/api-docs.mjs";

test("developer API docs catalogue is read-only and excludes internal admin routes", () => {
  const endpoints = apiDocSections.flatMap((section) => section.endpoints);

  assert.ok(endpoints.length >= 4, "expected several documented endpoints");
  assert.match(developerDocsAuthModel.summary, /session/i);
  assert.match(developerDocsAuthModel.summary, /API keys are not yet available/i);

  for (const endpoint of endpoints) {
    assert.equal(endpoint.method, "GET");
    assert.ok(!endpoint.path.startsWith("/api/admin"), `${endpoint.path} should not document admin APIs`);
    assert.ok(!endpoint.path.includes("password"), `${endpoint.path} should not document password APIs`);
    assert.ok(endpoint.exampleResponse.trim().startsWith("{"));
  }
});

test("developer API docs cover the current member-facing feature APIs", () => {
  const endpoints = apiDocSections.flatMap((section) => section.endpoints);
  const paths = new Set(endpoints.map((endpoint) => endpoint.path));

  for (const path of [
    "/api/club/ladder",
    "/api/last-man-standing",
    "/api/last-man-standing/[competitionId]",
    "/api/league-chair/live-scoring/dashboard",
    "/api/shop",
    "/api/table-bookings"
  ]) {
    assert.ok(paths.has(path), `${path} should be documented`);
  }
});

test("fixture documentation explains cup rounds and postponed matches", () => {
  const fixtures = apiDocSections
    .flatMap((section) => section.endpoints)
    .find((endpoint) => endpoint.path === "/api/fixtures/weeks");

  assert.ok(fixtures);
  assert.match(`${fixtures.summary} ${fixtures.exampleResponse}`, /cup/i);
  assert.match(`${fixtures.summary} ${fixtures.exampleResponse}`, /postpon/i);
});
