import assert from "node:assert/strict";
import test from "node:test";

import { isLikelyStaleClientError, shouldAutoReloadClient } from "../lib/client-error-recovery.mjs";

test("recognises stale deployment chunk failures", () => {
  assert.equal(isLikelyStaleClientError(new Error("ChunkLoadError: Loading chunk 2713 failed")), true);
  assert.equal(isLikelyStaleClientError(new Error("Failed to fetch dynamically imported module")), true);
  assert.equal(isLikelyStaleClientError(new Error("A normal rendering error")), false);
});

test("automatically reloads a stale client only once within the cooldown", () => {
  const error = new Error("Loading chunk 2713 failed");

  assert.equal(shouldAutoReloadClient(error, null, 100_000), true);
  assert.equal(shouldAutoReloadClient(error, 90_000, 100_000), false);
  assert.equal(shouldAutoReloadClient(error, 30_000, 100_000), true);
  assert.equal(shouldAutoReloadClient(new Error("Render failed"), null, 100_000), false);
});
