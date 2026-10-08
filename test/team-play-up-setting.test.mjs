import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const schema = source("../supabase/schema.sql");
const migration = source("../supabase/club_unlimited_lower_players.sql");
const clubsApi = source("../app/api/admin/clubs/route.ts");
const adminConsole = source("../components/admin-console.tsx");
const auth = source("../lib/server/auth.ts");
const lineupRoute = source("../app/api/manager/lineup/route.ts");

test("clubs persist the unlimited lower-player setting", () => {
  const clubTable = schema.slice(schema.indexOf("create table public.club ("), schema.indexOf("create unique index club_name_case_insensitive_idx"));
  const teamTable = schema.slice(schema.indexOf("create table public.team ("), schema.indexOf("create table public.team_membership"));
  assert.match(clubTable, /allow_unlimited_lower_team_players boolean not null default false/);
  assert.doesNotMatch(teamTable, /allow_unlimited_lower_team_players/);
  assert.match(migration, /alter table public\.club[\s\S]*add column if not exists allow_unlimited_lower_team_players boolean not null default false/);
  assert.match(migration, /alter table public\.team[\s\S]*drop column if exists allow_unlimited_lower_team_players/);
});

test("club and platform admins update the setting through club settings", () => {
  assert.match(clubsApi, /allow_unlimited_lower_team_players/);
  assert.match(clubsApi, /next\.allowUnlimitedLowerTeamPlayers/);
  assert.match(clubsApi, /Club administrator access is required for this club/);
});

test("the Clubs panel exposes one club-level setting", () => {
  assert.match(adminConsole, /allowUnlimitedLowerTeamPlayers/);
  assert.match(adminConsole, /Allow unlimited lower team players/);
  assert.doesNotMatch(adminConsole, /\/api\/admin\/teams/);
  assert.doesNotMatch(auth, /t\.allow_unlimited_lower_team_players/);
});

test("manager lineup eligibility honours the club setting without weakening other clubs", () => {
  assert.match(lineupRoute, /join public\.club[\s\S]*allow_unlimited_lower_team_players/);
  assert.match(lineupRoute, /clubAllowsUnlimitedLowerPlayers/);
  assert.match(lineupRoute, /Boolean\(options\.ignorePlayUpLimit\) \|\| clubAllowsUnlimitedLowerPlayers/);
  assert.match(lineupRoute, /Guest Player already played for/, "the default restriction must remain in place");
});
