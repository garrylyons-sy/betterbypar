import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appearanceSource = readFileSync(new URL("../lib/appearance.ts", import.meta.url), "utf8");
const appShellSource = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");

test("club members are configured to access fixtures and tables for the active season", () => {
  const fixturesMenuLine = appearanceSource.split("\n").find((line) => line.includes('id: "Fixtures"')) ?? "";
  assert.match(fixturesMenuLine, /"Club Member"/, "Fixtures must be an allowed Club Member menu item");
  assert.match(fixturesMenuLine, /"Club Admin"/, "Fixtures must be an allowed Club Admin menu item");
  assert.match(
    appearanceSource,
    /"Club Member":\s*\{[\s\S]*menuItems:\s*\[[^\]]*"Fixtures"[^\]]*"Table"/,
    "Club Member default menu should include Fixtures and Tables"
  );
  assert.match(
    appShellSource,
    /if \(role === "Club Member"\) \{\s*return \[[^\]]*"Fixtures"[^\]]*"Table"/,
    "Club Member fixed menu should include Fixtures and Tables"
  );
  assert.doesNotMatch(
    appShellSource,
    /memberRestrictedPages:[^=]*=\s*\[[^\]]*"Fixtures"/,
    "Fixtures must not be restricted for Club Members"
  );
  assert.match(
    authSource,
    /activeSeasonName/,
    "Club-only contexts should use the active season rather than the literal Club season"
  );
});

test("club member home respects configured panels and remains useful without open competitions", () => {
  assert.match(
    appearanceSource,
    /"Club Member":\s*\{[\s\S]*panels:\s*\[[^\]]*"clubAccess"[^\]]*"openCompetitions"/,
    "Club access should be part of the default club-member home"
  );

  const memberHomeSource = appShellSource.slice(
    appShellSource.indexOf("function ClubMemberHome"),
    appShellSource.indexOf("function MemberActionsCard")
  );
  assert.doesNotMatch(
    memberHomeSource,
    /return panels\.filter\(\(panel\) => panel === "openCompetitions"\)/,
    "The club-member home must not discard panels selected in Appearance"
  );
  for (const shortcut of ["Book a table", "Fixtures", "League tables"]) {
    assert.match(memberHomeSource, new RegExp(`label: "${shortcut}"`));
  }
});

test("My Club links to competitions without repeating the competition panel", () => {
  const clubHubSource = appShellSource.slice(
    appShellSource.indexOf("function ClubHubPage"),
    appShellSource.indexOf("function ClubActionTile")
  );
  assert.match(clubHubSource, /onNavigate\("Competitions"\)/, "My Club should keep its competitions menu tile");
  assert.doesNotMatch(clubHubSource, /<CompetitionPanel/, "My Club should not repeat competitions at the bottom");
});

test("platform operator contexts receive League Chair pilot access", () => {
  assert.match(authSource, /isAppOperator[\s\S]*hasLiveScoringAccess/);
  assert.doesNotMatch(authSource, /\(leagueChairMemberships\.length > 0 \|\| isAppOperator\)[\s\S]*hasLeagueChairAccess: true/, "operator scoring must not grant unrelated League Chair features");
  assert.match(appShellSource, /activeTeam\.hasLiveScoringAccess[\s\S]*LeagueChairLiveStatusList/);
  assert.doesNotMatch(appShellSource, /LeagueChairMatchControls/, "full scoring controls must remain in the standalone scorer");
});
