import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/league-chair/live-scoring/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../lib/server/live-scoring.ts", import.meta.url), "utf8");
const results = readFileSync(new URL("../lib/server/game-results.ts", import.meta.url), "utf8");
const managerRoute = readFileSync(new URL("../app/api/manager/lineup/route.ts", import.meta.url), "utf8");
const fixtureRoute = readFileSync(new URL("../app/api/fixtures/weeks/route.ts", import.meta.url), "utf8");

test("live scoring API authenticates before loading undiscoverable scoring data", () => {
  assert.match(route, /currentUser\(\)/, "live scoring must use cookie-only authentication");
  assert.doesNotMatch(route, /currentUserFromRequest/, "test-user impersonation must not reach scoring actions");
  assert.match(route, /requireLeagueChairScoringAccess\(user\.personId\)/);
  assert.match(route, /League Chair access required[\s\S]*status: 403/);
  assert.doesNotMatch(fixtureRoute, /live_frame_session/, "general fixture payload must not expose pilot state");
});

test("League Chair access is server-side and also permits platform operators", () => {
  assert.match(service, /cm\.role = 'League Chair'/);
  assert.match(service, /cm\.active = true/);
  assert.match(service, /p\.active = true/);
  assert.match(service, /from public\.app_operator ao[\s\S]*ao\.active = true/);
});

test("official game results validate the fixture and refresh match points", () => {
  assert.match(results, /export async function recordOfficialGameResult/);
  assert.match(results, /where f\.id = \$1[\s\S]*and g\.id = \$2/);
  assert.match(results, /Winner must be one of the teams in this fixture/);
  assert.match(results, /update public\.game[\s\S]*home_score[\s\S]*away_score[\s\S]*winner_team_id/);
  assert.match(results, /public\.refresh_match_team_points/);
  assert.match(managerRoute, /recordOfficialGameResult/);
  assert.doesNotMatch(managerRoute, /async function recordGameWinner/);
  assert.match(results, /status in \('Live', 'Paused', 'Completed'\)/);
  assert.match(results, /A live scorer is active for this frame/);
  assert.match(results, /superseded_at = now\(\)/);
  assert.match(results, /const resultChanged =/);
  assert.match(results, /liveSession && liveSession\.id !== input\.liveSessionId && resultChanged/);
  assert.match(results, /source_key like 'live-session:' \|\| \$1 \|\| ':break:%'/);
  assert.match(service, /liveSessionId: session\.id/);
});

test("official game result updates bind every SQL parameter in order", () => {
  assert.match(
    results,
    /update public\.game[\s\S]*home_score = coalesce\(\$2, home_score\)[\s\S]*away_score = coalesce\(\$3, away_score\)[\s\S]*winner_team_id = \$4[\s\S]*where id = \$1/
  );
  assert.match(results, /\[input\.gameId, input\.homeScore \?\? null, input\.awayScore \?\? null, input\.winnerTeamId\]/);
});

test("manual break entry cannot overlap a live-scored frame", () => {
  assert.match(managerRoute, /recordPlayerBreak[\s\S]*for update of g/);
  assert.match(managerRoute, /status in \('Live', 'Paused', 'Completed'\)[\s\S]*This frame is using live scoring/);
  assert.match(service, /select exists \([\s\S]*from public\.break[\s\S]*Recorded breaks already exist for this frame/);
});

test("player-attributed scoring is restricted to players in that frame and side", () => {
  assert.match(service, /home_player_1_id[\s\S]*home_player_2_id[\s\S]*away_player_1_id[\s\S]*away_player_2_id/);
  assert.match(service, /home_player_1_guest_name[\s\S]*home_player_2_guest_name[\s\S]*away_player_1_guest_name[\s\S]*away_player_2_guest_name/);
  assert.match(service, /guest:\$\{team\}:\$\{slot\}/, "typed guests should receive stable participant keys");
  assert.match(service, /Player is not part of that side in this frame/);
});

test("typed guest participant keys never enter UUID-only database columns", () => {
  assert.match(service, /function databasePersonId/);
  assert.match(service, /databasePersonId\(state\.activePlayerId\)/);
  assert.match(service, /databasePersonId\(eventPlayerId\)/);
  assert.match(service, /participant_key: eventPlayerId/);
  assert.match(service, /databasePersonId\(completedBreak\.playerId\)/);
});

test("live mutations enforce versions and an exclusive scorer lease", () => {
  assert.match(service, /for update/);
  assert.match(service, /session\.version !== input\.version/);
  assert.match(service, /Live scoring changed elsewhere/);
  assert.match(service, /LiveScoringError\([^\n]+409/);
  assert.match(service, /lease_expires_at[\s\S]*scorer_person_id/);
  assert.match(service, /Another League Chair is currently scoring this frame/);
  assert.match(service, /LiveScoringError\([^\n]+423/);
  assert.match(service, /lease_expires_at = now\(\) \+ make_interval[\s\S]*status = 'Live'/, "visible polling should renew the scorer lease");
  assert.match(service, /nextStatus === "Paused"[\s\S]*lease_expires_at = null/, "pausing should release the active lease");
});

test("completion is idempotent and writes official totals and qualifying breaks", () => {
  assert.match(service, /input\.action === "complete" && session\.status === "Completed"/);
  assert.match(service, /homeScore: state\.homeScore/);
  assert.match(service, /awayScore: state\.awayScore/);
  assert.match(service, /live-session:\$\{session\.id\}:break/);
  assert.match(service, /breakValue < 30/);
  assert.match(service, /on conflict \(source_key\) do nothing/);
  assert.match(service, /session\.status === "Completed" \|\| session\.status === "Abandoned"[\s\S]*SESSION_CLOSED/, "terminal sessions must reject every non-idempotent mutation");
});

test("API exposes ordinary results and every planned live scoring action", () => {
  for (const action of [
    "recordResult", "start", "pot", "foul", "endVisit", "selectPlayer", "undo",
    "correctBalls", "setState", "concede", "respotBlack", "takeover", "handover", "pause", "resume", "complete", "abandon"
  ]) {
    assert.match(route, new RegExp(`"${action}"`), `${action} should be accepted`);
  }
  assert.match(service, /Recorded League Chair game result/);
  assert.match(service, /Started live scoring/);
  assert.match(service, /Took over live scoring/);
  assert.match(service, /Completed live-scored frame/);
  assert.match(service, /Released live scoring/);
  assert.doesNotMatch(service, /Recorded live pot/);
});

test("invalid scoring actions return stable client errors", () => {
  assert.match(service, /INVALID_ACTION/);
  assert.match(service, /GameResultError/);
  assert.match(service, /createLiveFrameState[\s\S]*INVALID_ACTION/, "malformed start state should be a stable client error");
  assert.match(route, /error instanceof LiveScoringError/);
});
