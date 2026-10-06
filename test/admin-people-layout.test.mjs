import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("people admin table reserves enough desktop width for inline row actions", () => {
  const peopleTableSource = source.slice(source.indexOf("Selected people"), source.indexOf("function EditPersonModal"));
  assert.match(peopleTableSource, /min-w-\[1280px\]/, "people table should stay compact on desktop");
  assert.match(peopleTableSource, /_116px_150px\]/, "invite status and actions columns should stay compact without row resend");
  assert.match(peopleTableSource, /min-w-\[88px\]/, "invite status pill should have its own minimum width");
  assert.doesNotMatch(peopleTableSource, /resendInvite\(person\)/, "row-level resend button should not be shown");
  assert.doesNotMatch(peopleTableSource, /grid-cols-\[[^\]]*_180px\]/, "wider resend-era actions column should not return");
});
