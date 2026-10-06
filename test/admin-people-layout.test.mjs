import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("people admin table reserves enough desktop width for inline row actions", () => {
  const peopleTableSource = source.slice(source.indexOf("Selected people"), source.indexOf("function EditPersonModal"));
  assert.match(peopleTableSource, /min-w-\[1280px\]/, "people table should stay compact on desktop");
  assert.match(peopleTableSource, /_116px_88px\]/, "invite status and actions columns should stay compact without row resend or delete");
  assert.match(peopleTableSource, /min-w-\[88px\]/, "invite status pill should have its own minimum width");
  assert.doesNotMatch(peopleTableSource, /resendInvite\(person\)/, "row-level resend button should not be shown");
  assert.doesNotMatch(peopleTableSource, /setDeleteTarget\(person\)/, "row-level delete button should not be shown");
  assert.doesNotMatch(peopleTableSource, /grid-cols-\[[^\]]*_180px\]/, "wider resend-era actions column should not return");
});

test("people admin exposes delete as a selected bulk action", () => {
  const peoplePanelSource = source.slice(source.indexOf("function PeoplePanel"), source.indexOf("function InviteStatusBadge"));
  assert.match(peoplePanelSource, /Delete selected \(\$\{selectedDeleteCount\}\)/, "selected delete action should live above the table");
  assert.match(peoplePanelSource, /deleteTargets/, "delete confirmation should support selected people");
  assert.match(peoplePanelSource, /selectedDeleteCount/, "bulk delete should be counted from selected rows");
});

test("people invite selection requires an email address for new and resent invites", () => {
  const peoplePanelSource = source.slice(source.indexOf("function PeoplePanel"), source.indexOf("function InviteStatusBadge"));
  assert.match(peoplePanelSource, /Boolean\(person\.email && \(!person\.invitedAt \|\| isPendingInvite\(person\)\)\)/, "bulk resend eligibility should require an email");
});
