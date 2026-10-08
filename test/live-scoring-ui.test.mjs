import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const controls = readFileSync(new URL("../components/league-chair-live-scoring.tsx", import.meta.url), "utf8");
const fixtureRoute = readFileSync(new URL("../app/api/fixtures/weeks/route.ts", import.meta.url), "utf8");

test("main fixtures expose only active read-only live state to League Chairs", () => {
  assert.match(appShell, /activeTeam\.hasLiveScoringAccess[\s\S]*fixtureLiveStatuses\.length/);
  assert.match(appShell, /if \(!canInspect && !hasVisibleLiveScoring\) return;/, "League Chairs should only expand a fixture when it has active live scoring");
  assert.match(appShell, /LeagueChairLiveStatusList/);
  assert.doesNotMatch(appShell, /LeagueChairMatchControls/, "full scoring controls should remain in the standalone scorer");
});

test("standalone League Chair controls are closed until deliberately expanded", () => {
  assert.match(controls, /const \[controlsOpen, setControlsOpen\] = useState\(false\)/, "scoring controls should start closed");
  assert.match(controls, /League Chair scoring/, "the closed control should have a clear label");
});

test("League Chair controls support ordinary frame results and launch live scoring", () => {
  assert.match(controls, /winnerTeamId: null/, "ordinary results should be resettable to undecided");
  assert.match(controls, /Record home win/, "ordinary result controls should identify the home side");
  assert.match(controls, /Record away win/, "ordinary result controls should identify the away side");
  assert.match(controls, /Start live scoring|Open live scoring/, "undecided frames should expose live scoring");
});

test("published typed guests remain selectable in the live scorer", () => {
  assert.match(controls, /home_player_1_guest_name/);
  assert.match(controls, /away_player_2_guest_name/);
  assert.match(controls, /guest:\$\{side\}:\$\{slot\}/);
  assert.match(controls, /personId \?\? guestKey/);
});

test("mobile scorer shows the table state and complete scoring controls", () => {
  for (const label of ["Current break", "Reds left", "End visit", "Undo", "Foul", "Concede", "Set current state"]) {
    assert.match(controls, new RegExp(label), `live scorer should include ${label}`);
  }
  assert.match(controls, /Array\.from\(\{ length: state\.redsRemaining \}/, "the remaining reds should be visualised");
  assert.match(controls, /\[2, 3, 4, 5, 6, 7\]/, "the six colours should be represented visually");
  assert.match(controls, /Saved|Saving|Offline|Conflict/, "save and connectivity status should be visible");
});

test("a late scorer can set the complete state and continue", () => {
  for (const label of ["Set current state", "Home score", "Away score", "Team at table", "Active player", "Current break", "Reds remaining", "Next ball", "Apply and continue"]) {
    assert.match(controls, new RegExp(label), `catch-up controls should include ${label}`);
  }
  assert.match(controls, /action: "setState"/);
});

test("an unscored frame clearly offers to switch the starting team", () => {
  assert.match(controls, /const frameIsUnscored =/);
  assert.match(controls, /const otherTeamName =/);
  assert.match(controls, /frameIsUnscored \? `Switch to \$\{otherTeamName\}` : "End visit"/);
});

test("polling is two-second, visible-only, and isolated from the normal fixtures payload", () => {
  assert.match(controls, /document\.visibilityState === "visible"/, "polling should stop while the app is backgrounded");
  assert.match(controls, /visibilitychange/, "visibility changes should restart or stop polling");
  assert.match(controls, /2000/, "open live controls should poll every two seconds");
  assert.match(controls, /controlsOpen && selectedGameId/, "polling should stop when the scorer closes");
  assert.match(controls, /Hand over/, "the current scorer should be able to release control explicitly");
  assert.match(controls, /Confirm[\s\S]*Complete frame|window\.confirm\([\s\S]*Complete frame/, "official completion should require winner confirmation");
  assert.match(controls, /action\.action === "complete" \|\| action\.action === "abandon"[\s\S]*setSelectedGameId\(""\)/, "terminal actions should stop live polling");
  assert.match(controls, /setSelectedGameId\(\(current\)[\s\S]*activeSession[\s\S]*return activeSession \? current : ""/, "polling should close when another scorer ends the session");
  assert.doesNotMatch(fixtureRoute, /live_frame_session|live_frame_event/, "normal fixture reads must not include live scoring data");
});
