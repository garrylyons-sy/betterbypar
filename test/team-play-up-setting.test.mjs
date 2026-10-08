import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const schema = source("../supabase/schema.sql");
const migration = source("../supabase/team_unlimited_lower_players.sql");
const teamApi = source("../app/api/admin/teams/route.ts");
const adminConsole = source("../components/admin-console.tsx");
const auth = source("../lib/server/auth.ts");
const lineupRoute = source("../app/api/manager/lineup/route.ts");

test("teams persist the unlimited lower-player setting", () => {
  assert.match(schema, /allow_unlimited_lower_team_players boolean not null default false/);
  assert.match(migration, /alter table public\.team[\s\S]*add column if not exists allow_unlimited_lower_team_players boolean not null default false/);
});

test("club and platform admins can update the setting only for teams in scope", () => {
  assert.match(teamApi, /requireTeamSettingsAccess/);
  assert.match(teamApi, /allow_unlimited_lower_team_players = \$2/);
  assert.match(teamApi, /clubIds\.includes\(existing\.club_id\)/);
  assert.match(teamApi, /Updated team player eligibility/);
});

test("the Clubs panel exposes the setting for each team", () => {
  assert.match(auth, /allow_unlimited_lower_team_players/);
  assert.match(adminConsole, /allowUnlimitedLowerTeamPlayers/);
  assert.match(adminConsole, /Allow unlimited lower team players/);
  assert.match(adminConsole, /\/api\/admin\/teams/);
});

test("manager lineup eligibility honours the team setting without weakening other teams", () => {
  assert.match(lineupRoute, /allow_unlimited_lower_team_players/);
  assert.match(lineupRoute, /teamAllowsUnlimitedLowerPlayers/);
  assert.match(lineupRoute, /Boolean\(options\.ignorePlayUpLimit\) \|\| teamAllowsUnlimitedLowerPlayers/);
  assert.match(lineupRoute, /Guest Player already played for/, "the default restriction must remain in place");
});
