import assert from "node:assert/strict";
import test from "node:test";

import { cupRoundDateError } from "../lib/cup-round-dates.mjs";

test("cup rounds must have one valid date per round", () => {
  assert.equal(cupRoundDateError(["2026-11-01"], 2), "Choose a valid date for every round.");
  assert.equal(cupRoundDateError(["not-a-date"], 1), "Choose a valid date for every round.");
});

test("each cup round must take place after the preceding round", () => {
  assert.equal(
    cupRoundDateError(["2026-11-08", "2026-11-01"], 2),
    "Each round date must be after the previous round."
  );
  assert.equal(
    cupRoundDateError(["2026-11-01", "2026-11-01"], 2),
    "Each round date must be after the previous round."
  );
  assert.equal(cupRoundDateError(["2026-11-01", "2026-11-08"], 2), null);
});
