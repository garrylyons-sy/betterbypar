import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("people admin table reserves enough desktop width for inline row actions", () => {
  const peopleTableSource = source.slice(source.indexOf("Selected people"), source.indexOf("function EditPersonModal"));
  assert.match(peopleTableSource, /min-w-\[1320px\]/, "people table should reserve a wider desktop layout");
  assert.match(peopleTableSource, /_260px\]/, "actions column should be wide enough for inline Edit and Resend buttons");
  assert.doesNotMatch(peopleTableSource, /grid-cols-\[[^\]]*_180px\]/, "old narrow people actions column should not return");
});
