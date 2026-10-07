import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  changedClubFields,
  clubMutationPolicy,
  normalizeClubInput
} from "../lib/server/admin-clubs.ts";

const pngDataUrl = `data:image/png;base64,${Buffer.from("small-logo").toString("base64")}`;
const adminConsoleSource = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

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

test("clubs admin navigation is available to platform and club administrators", () => {
  assert.match(adminConsoleSource, /type AdminTab = [^;]*"clubs"/);
  assert.match(adminConsoleSource, /const clubAdminTabs:[^=]*= \[[^\]]*"clubs"/);
  assert.match(adminConsoleSource, /label: "Clubs"/);
});

test("clubs editor stays closed until selected and protects club identity fields", () => {
  const panelSource = adminConsoleSource.slice(adminConsoleSource.indexOf("function ClubsPanel"), adminConsoleSource.indexOf("function CompetitionsAdminPanel"));
  assert.match(panelSource, /selectedClubId/);
  assert.match(panelSource, /adminMode === "club"/);
  assert.match(panelSource, /readOnly=\{adminMode === "club"\}/);
  assert.match(panelSource, /disabled=\{!isDirty \|\| saving\}/);
});

test("clubs editor restricts logo uploads to supported image types", () => {
  const panelSource = adminConsoleSource.slice(adminConsoleSource.indexOf("function ClubsPanel"), adminConsoleSource.indexOf("function CompetitionsAdminPanel"));
  assert.match(panelSource, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(panelSource, /file\.size > 1024 \* 1024/);
});
