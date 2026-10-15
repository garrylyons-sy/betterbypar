import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const managerRoute = readFileSync(new URL("../app/api/manager/lineup/route.ts", import.meta.url), "utf8");
const adminRoute = readFileSync(new URL("../app/api/admin/matches/route.ts", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");

test("managers can delete a recorded break only before a match is completed", () => {
  assert.match(managerRoute, /action === "deleteBreak"/, "manager lineup API should accept break deletion");
  assert.match(managerRoute, /deletePlayerBreak\(client, fixtureId, gameId, breakId\)/, "break deletion should be scoped to the fixture and game");
  assert.match(managerRoute, /f\.status <> 'Completed'/, "manager break deletion must keep completed matches locked");
  assert.match(managerRoute, /Deleted break/, "manager break deletion should be audited");
});

test("manager result entry shows a delete control for each editable break", () => {
  assert.match(appShell, /onDeleteBreak/, "the result card should receive a break deletion handler");
  assert.match(appShell, /aria-label={`Delete \$\{item\.playerName\} break of \$\{item\.breakValue\}`}/, "each break should have an accessible delete control");
  assert.match(appShell, /action: "deleteBreak"/, "the app should call the manager break deletion action");
});

test("administrators can delete a break from any saved match and the action is audited", () => {
  assert.match(adminRoute, /export async function DELETE/, "admin matches API should expose break deletion");
  assert.match(adminRoute, /delete from public\.break[\s\S]*where b\.id = \$1/, "admin deletion should target one break");
  assert.match(adminRoute, /Deleted match break/, "admin break deletion should be audited");
  assert.doesNotMatch(adminRoute.match(/export async function DELETE[\s\S]*$/)?.[0] ?? "", /f\.status <> 'Completed'/, "admin deletion must remain available after completion");
});

test("admin frame details include breaks and allow deleting them", () => {
  assert.match(adminRoute, /'breaks', coalesce\(/, "frame details should include their recorded breaks");
  assert.match(adminConsole, /frame\.breaks/, "admin frame details should render recorded breaks");
  assert.match(adminConsole, /deleteAdminBreak/, "admin UI should call the break deletion endpoint");
});
