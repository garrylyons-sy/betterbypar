import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("audience-filtered Last Man Standing is available from the page and home panel", () => {
  assert.equal(existsSync(new URL("../components/last-man-standing.tsx", import.meta.url)), true);
  const shell = read("../components/app-shell.tsx");
  assert.match(shell, /Last Man Standing/);
  assert.match(shell, /LastManStandingHomePanel/);
  assert.match(shell, /LastManStandingPage/);
  assert.match(shell, /if \(activePage === "Last Man Standing"\) return <LastManStandingPage/);
  assert.doesNotMatch(shell, /panel === "lastManStanding" && activeTeam\.hasLeagueChairAccess/);
  assert.doesNotMatch(shell, /activePage === "Home" && activeTeam\.hasLeagueChairAccess \? <LastManStandingHomePanel/);
  const panel = read("../components/last-man-standing.tsx");
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /interclub:refresh-panels/);
  assert.match(panel, /window\.addEventListener\("focus"/);
  assert.match(panel, /summariesCache/);
  assert.match(panel, /summariesRequest/);
  assert.match(panel, /role="progressbar"/);
  assert.match(panel, /const displayedCompetitions = enteredCompetitions\.length > 0/);
  assert.match(panel, /displayedCompetitions\.map/);
  assert.match(panel, /availableCompetitionCount/);
  assert.doesNotMatch(panel, /enteredCompetitionCountLabel/);
  assert.doesNotMatch(panel, />\{enteredCompetitionCountLabel\}<\/Badge>/);
  assert.doesNotMatch(panel, /const competition = competitions\.find/);
  assert.match(panel, /Pick \$\{index \+ 1\}/);
  assert.match(panel, /pickOutcomes/);
  assert.match(panel, /outcome === "Won"/);
  assert.match(panel, /outcome === "Lost"/);
  assert.match(panel, /const isEliminated = competition\.panel\?\.entrantStatus === "Eliminated"/);
  assert.match(panel, /isEliminated \? "bg-\[#faf9fb\]"/);
  assert.match(panel, /competition\.panel\.entrantStatus !== "Entered"/);
  assert.match(panel, /const deadlineClosed = competition\.currentRound\?\.status !== "Open" \|\| Boolean\(deadline && Date\.now\(\) >= deadline\.getTime\(\)\)/);
  assert.match(panel, /deadlineClosed \? "Selections closed"/);
});

test("participant UI exposes deadline, primary action, and automatic replacement reasons", () => {
  const source = readFileSync(new URL("../components/last-man-standing.tsx", import.meta.url), "utf8");
  assert.match(source, /Deadline/);
  assert.match(source, /Enter now|Make picks|Change picks/);
  assert.match(source, /automaticReason/);
  assert.match(source, /Automatic replacement/);
  assert.match(source, /selectedPlayerName/);
  assert.match(source, /wasChanged/);
  assert.match(source, /Changed from/);
  assert.match(source, />Changed</);
  assert.match(source, /View all/);
  assert.match(source, /message \|\| "No competition is currently available\."/);
});

test("competition UI handles concurrent competitions, entry, privacy and noon locking", () => {
  const source = read("../components/last-man-standing.tsx");
  assert.match(source, /enteredCompetitions\.map/);
  assert.match(source, /Available competitions/);
  assert.match(source, /availableCompetitions\.length/);
  assert.match(source, /toggleCompetition/);
  assert.match(source, /loadCompetitionDetail/);
  assert.doesNotMatch(source, />Competition<select/);
  assert.match(source, /Enter competition/);
  assert.match(source, /Choose first player/);
  assert.match(source, /Choose second player/);
  assert.match(source, /Already picked/);
  assert.match(source, /Selections closed/);
  assert.match(source, /picksHidden/);
  assert.match(source, /Automatic/);
  assert.match(source, /History/);
  assert.match(source, /Contestants/);
  assert.match(source, /entry\.status === "Eliminated"/);
  assert.match(source, /entry\.status !== "Entered"/);
  assert.match(source, /label="Your run"/);
  assert.match(source, /roundsPlayed/);
  assert.doesNotMatch(source, /Reached round/);
  assert.match(source, /label="Winner"/);
  assert.match(source, /winnerName/);
  assert.match(source, /No winner/);
});

test("appearance controls the Last Man Standing home panel for every active role", () => {
  const types = read("../lib/types.ts");
  const appearance = read("../lib/appearance.ts");
  assert.match(types, /"Last Man Standing"/);
  assert.match(appearance, /id: "Last Man Standing"/);
  assert.match(types, /"lastManStanding"/);
  assert.match(appearance, /id: "lastManStanding"/);
  assert.match(appearance, /roles: appearanceRoles/);
  const playerDefault = appearance.match(/Player:\s*\{[\s\S]*?\n  \},/)?.[0] ?? "";
  assert.match(playerDefault, /lastManStanding/);
});

test("existing appearance rows receive the Last Man Standing panel once", () => {
  const migration = read("../supabase/last_man_standing_home_panel.sql");
  assert.match(migration, /jsonb_array_elements_text/);
  assert.match(migration, /'lastManStanding'/);
  assert.match(migration, /and not panel_config @>/);
});
