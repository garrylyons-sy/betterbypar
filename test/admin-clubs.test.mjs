import assert from "node:assert/strict";
import test from "node:test";

import {
  changedClubFields,
  clubMutationPolicy,
  normalizeClubInput
} from "../lib/server/admin-clubs.ts";

const pngDataUrl = `data:image/png;base64,${Buffer.from("small-logo").toString("base64")}`;

test("normalizes database-backed club settings", () => {
  assert.deepEqual(
    normalizeClubInput({
      name: "  Castle Golf Club  ",
      venue: "  Main clubhouse ",
      address: "   ",
      logoPath: pngDataUrl,
      primaryColor: "#0a1b2c",
      accentColor: "#DDEEFF",
      active: true
    }, "create"),
    {
      name: "Castle Golf Club",
      venue: "Main clubhouse",
      address: null,
      logoPath: pngDataUrl,
      primaryColor: "#0A1B2C",
      accentColor: "#DDEEFF",
      active: true
    }
  );
});

test("rejects malformed colours and unsupported or oversized uploaded logos", () => {
  assert.throws(
    () => normalizeClubInput({ name: "Castle", primaryColor: "navy" }, "create"),
    /six-digit hexadecimal/
  );
  assert.throws(
    () => normalizeClubInput({ name: "Castle", logoPath: "data:image/gif;base64,R0lGODlh" }, "create"),
    /PNG, JPEG or WebP/
  );
  assert.throws(
    () => normalizeClubInput({ name: "Castle", logoPath: `data:image/png;base64,${"A".repeat(1_398_104)}` }, "create"),
    /1 MB/
  );
});

test("preserves existing path-based logos", () => {
  const result = normalizeClubInput({ name: "Castle", logoPath: "/club-logos/castle.svg" }, "create");
  assert.equal(result.logoPath, "/club-logos/castle.svg");
});

test("applies platform and club administrator mutation policies", () => {
  assert.deepEqual(clubMutationPolicy("platform"), {
    canCreate: true,
    writableFields: ["name", "venue", "address", "logoPath", "primaryColor", "accentColor", "active"]
  });
  assert.deepEqual(clubMutationPolicy("club"), {
    canCreate: false,
    writableFields: ["venue", "address", "logoPath", "primaryColor", "accentColor"]
  });
});

test("reports only fields whose persisted values changed", () => {
  const current = {
    name: "Castle Golf Club",
    venue: null,
    address: null,
    logoPath: "/club-logos/castle.svg",
    primaryColor: "#071A78",
    accentColor: "#00E6F0",
    active: true
  };
  assert.deepEqual(changedClubFields(current, { ...current }), []);
  assert.deepEqual(
    changedClubFields(current, { ...current, venue: "Castle clubhouse", active: false }),
    ["venue", "active"]
  );
});
