import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canChallengePosition,
  canRechallenge,
  canRejectChallenge,
  normalizeLadderInitialOrder,
  normalizeLadderSettings,
  requiredFrameWins,
  rechallengeAvailableAt,
  resolveLadderResult,
  validateLadderResult
} from "../lib/club-ladder.mjs";

const schema = readFileSync(new URL("../supabase/club_ladders.sql", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const ladderPage = readFileSync(new URL("../components/club-ladder.tsx", import.meta.url), "utf8");
const unavailableState = readFileSync(new URL("../components/club-feature-unavailable.tsx", import.meta.url), "utf8");
const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");
const adminLadders = readFileSync(new URL("../components/admin-club-ladders.tsx", import.meta.url), "utf8");
const ladderApi = readFileSync(new URL("../app/api/club/ladder/route.ts", import.meta.url), "utf8");
const adminLadderApi = readFileSync(new URL("../app/api/admin/ladders/route.ts", import.meta.url), "utf8");
const appearance = readFileSync(new URL("../lib/appearance.ts", import.meta.url), "utf8");
const appearanceMigration = readFileSync(new URL("../supabase/club_ladder_home_panel.sql", import.meta.url), "utf8");
const multipleLaddersMigration = readFileSync(new URL("../supabase/club_ladder_multiple_ladders.sql", import.meta.url), "utf8");
const startingPositionMigration = readFileSync(new URL("../supabase/club_ladder_starting_position.sql", import.meta.url), "utf8");

test("ladder settings support one frame, best of three and best of five", () => {
  assert.equal(requiredFrameWins("1 Frame"), 1);
  assert.equal(requiredFrameWins("Best of 3"), 2);
  assert.equal(requiredFrameWins("Best of 5"), 3);
  assert.deepEqual(normalizeLadderSettings({ matchFormat: "Best of 5" }), {
    name: "Club Ladder",
    matchFormat: "Best of 5",
    challengeRange: 3,
    responseHours: 48,
    playWithinDays: 14,
    useHandicap: true,
    active: true
  });
  assert.throws(() => normalizeLadderSettings({ matchFormat: "Best of 7" }), /match format/i);
});

test("players may challenge only the configured number of places above", () => {
  assert.equal(canChallengePosition(8, 5, 3), true);
  assert.equal(canChallengePosition(8, 4, 3), false);
  assert.equal(canChallengePosition(5, 6, 3), false);
});

test("a rejected challenge has a seven day rechallenge cooldown", () => {
  const rejectedAt = "2026-10-01T18:30:00.000Z";
  assert.equal(rechallengeAvailableAt(rejectedAt)?.toISOString(), "2026-10-08T18:30:00.000Z");
  assert.equal(canRechallenge(rejectedAt, "2026-10-08T18:29:59.999Z"), false);
  assert.equal(canRechallenge(rejectedAt, "2026-10-08T18:30:00.000Z"), true);
  assert.equal(canRechallenge(null, "2026-10-02T18:30:00.000Z"), true);
  assert.match(ladderApi, /status = 'Rejected'[\s\S]*order by challenge\.updated_at desc/);
  assert.match(ladderApi, /canRechallenge/);
  assert.match(ladderPage, /Challenge available/);
});

test("ladder loading errors are not presented as missing configuration", () => {
  assert.match(ladderPage, /Club ladders could not be loaded\./);
  assert.match(ladderPage, /description=\{message/);
});

test("the same challenged player can reject a challenger only once", () => {
  assert.equal(canRejectChallenge(0), true);
  assert.equal(canRejectChallenge(1), false);
});

test("result scores must match the configured frame format", () => {
  assert.deepEqual(validateLadderResult("1 Frame", 1, 0), { winner: "home", loserScore: 0 });
  assert.deepEqual(validateLadderResult("Best of 3", 1, 2), { winner: "away", loserScore: 1 });
  assert.deepEqual(validateLadderResult("Best of 5", 3, 0), { winner: "home", loserScore: 0 });
  assert.throws(() => validateLadderResult("Best of 3", 1, 0), /winning score/i);
  assert.throws(() => validateLadderResult("Best of 3", 2, 2), /one winner/i);
});

test("a ladder result can record only the selected winner", () => {
  assert.deepEqual(resolveLadderResult("1 Frame", undefined, undefined, "home"), {
    winner: "home",
    homeScore: null,
    awayScore: null
  });
  assert.deepEqual(resolveLadderResult("Best of 3", undefined, undefined, "away"), {
    winner: "away",
    homeScore: null,
    awayScore: null
  });
  assert.deepEqual(resolveLadderResult("Best of 3", 2, 1), {
    winner: "home",
    homeScore: 2,
    awayScore: 1
  });
  assert.throws(() => resolveLadderResult("1 Frame", undefined, undefined, "draw"), /winner/i);
  assert.match(ladderPage, /winnerSide: "challenger"/);
  assert.match(ladderPage, /winnerSide: "challenged"/);
  assert.match(adminLadders, /winnerSide: "challenger"/);
  assert.match(adminLadders, /winnerSide: "challenged"/);
  assert.match(ladderApi, /resolveLadderResult/);
  assert.match(adminLadderApi, /resolveLadderResult/);
});

test("ladder schema supports multiple ladders, team eligibility and optional handicaps", () => {
  assert.match(schema, /create table if not exists public\.club_ladder/);
  assert.match(schema, /club_id uuid not null references public\.club\(id\) on delete cascade/);
  assert.match(schema, /use_handicap boolean not null default true/);
  assert.match(schema, /create table if not exists public\.club_ladder_eligible_team/);
  assert.match(schema, /team_id uuid not null references public\.team\(id\) on delete restrict/);
  assert.match(schema, /ladder_id uuid not null references public\.club_ladder\(id\) on delete cascade/);
  assert.match(schema, /challenger_entry_id uuid not null references public\.club_ladder_entry\(id\) on delete cascade/);
  assert.match(schema, /challenged_entry_id uuid not null references public\.club_ladder_entry\(id\) on delete cascade/);
  assert.match(schema, /match_format text not null[^;]+1 Frame[^;]+Best of 3[^;]+Best of 5/s);
  assert.match(schema, /status text not null default 'Pending'/);
  assert.match(multipleLaddersMigration, /drop constraint if exists club_ladder_club_id_key/);
  assert.match(multipleLaddersMigration, /add column if not exists use_handicap boolean not null default true/);
  assert.match(multipleLaddersMigration, /references public\.team\(id\) on delete restrict/);
  assert.match(multipleLaddersMigration, /club_ladder_eligible_team_same_club/);
});

test("admin and My Club expose the ladder without adding it to the main navigation", () => {
  assert.match(adminConsole, /label: "Ladders"/);
  assert.match(adminConsole, /<AdminClubLadders/);
  assert.match(appShell, /onNavigate\("Ladder"\)/);
  assert.match(appShell, /if \(activePage === "Ladder"\) return <ClubLadderPage/);
  assert.match(ladderPage, /Your club has not configured a ladder yet\./);
  assert.match(ladderPage, /Ladder rules/);
  assert.doesNotMatch(appShell, /"Ladder"[^\n]+AppearanceMenuId/);
});

test("unavailable club features share the ladder layout and club colour treatment", () => {
  assert.match(ladderPage, /<ClubFeatureUnavailable/);
  assert.match(appShell, /title="Table bookings are not set up yet\."/);
  assert.match(appShell, /title="No club competitions have been created yet\."/);
  assert.match(unavailableState, /sm:grid-cols-\[72px_1fr\]/);
  assert.match(unavailableState, /linear-gradient\(135deg/);
  assert.match(unavailableState, /primaryColor/);
  assert.match(unavailableState, /accentColor/);
});

test("admin ladder settings constrain controls inside responsive grid columns", () => {
  assert.match(adminLadders, /2xl:grid-cols-\[minmax\(15rem,1\.2fr\)_repeat\(4,minmax\(0,1fr\)\)\]/);
  assert.match(adminLadders, /min-h-11 w-full min-w-0 rounded-lg/);
});

test("ladder setup supports multiple ladders, team eligibility and optional initial members", () => {
  assert.match(adminLadderApi, /eligibleTeamIds/);
  assert.match(adminLadderApi, /club_ladder_eligible_team/);
  assert.match(adminLadderApi, /use_handicap/);
  assert.match(adminLadderApi, /ladderId/);
  assert.match(adminLadderApi, /initialPersonIds/);
  assert.match(adminLadderApi, /Every selected player must be eligible for this ladder/);
  assert.match(adminLadderApi, /Select at least one player before creating a ladder/);
  assert.match(adminLadderApi, /insert into public\.club_ladder_entry/);
  assert.match(adminLadderApi, /lower\(p\.last_name\), lower\(p\.first_name\), p\.id/);
  assert.match(adminLadders, /Add initial players/);
  assert.match(adminLadders, /choose how their opening positions are drawn/);
  assert.match(adminLadders, /Find a club member/);
  assert.match(adminLadders, /initialPersonIds/);
  assert.match(adminLadders, /Hcp \{member\.handicap \?\? "-"\}/);
  assert.match(adminLadders, /No handicap recorded/);
  assert.match(adminLadders, /All club members/);
  assert.match(adminLadders, /Use club handicaps/);
  assert.match(adminLadders, /New ladder/);
  assert.match(adminLadders, /toggleEligibleTeam/);
  assert.match(adminLadders, /club\.members\.filter\(\(member\) => member\.teamIds\.some/);
  assert.match(adminLadders, /Select at least one player to create this ladder/);
});

test("new ladders can seed selected players by surname or random draw", () => {
  assert.equal(normalizeLadderInitialOrder("Surname"), "Surname");
  assert.equal(normalizeLadderInitialOrder("Random"), "Random");
  assert.throws(() => normalizeLadderInitialOrder("Current ranking"), /starting order/i);
  assert.match(adminLadderApi, /initialOrder/);
  assert.match(adminLadderApi, /then random\(\)/);
  assert.match(adminLadderApi, /'initial_order'/);
  assert.match(adminLadders, /Surname order/);
  assert.match(adminLadders, /Random draw/);
  assert.match(adminLadders, /initialOrder/);
});

test("eligible club members have a configurable visual ladder home panel", () => {
  assert.match(appearance, /id: "clubLadder", label: "Club Ladders"/);
  assert.match(appShell, /title="Club Ladders"/);
  assert.match(appShell, /description="View rankings, make challenges and track your form\."/);
  assert.match(ladderPage, /export function ClubLadderHomePanel/);
  assert.match(ladderPage, /if \(!data\?\.ladders\.length\) return null/);
  assert.match(ladderPage, /Position #\{ladderView\.me\.position\}/);
  assert.match(ladderPage, /Recent form/);
  assert.match(ladderPage, /Join ladder/);
  assert.match(ladderPage, /action: "join"/);
  assert.match(ladderPage, /challenge\.status === "Pending" && challenge\.isChallenged/);
  assert.match(ladderPage, /Challenge received/);
  assert.match(ladderPage, /Respond by/);
  assert.match(ladderPage, /Respond now/);
  assert.match(appShell, /panel === "clubLadder"/);
  assert.match(appearanceMigration, /panel_config \|\| '\["clubLadder"\]'/);
});

test("ladder home panel compactly identifies the active challenge opponent", () => {
  assert.match(ladderPage, /const activeChallenge = activeChallenges\[0\]/);
  assert.match(ladderPage, /activeChallenge\.isChallenger \? activeChallenge\.challenged : activeChallenge\.challenger/);
  assert.match(ladderPage, /Challenge sent/);
  assert.match(ladderPage, /Playing/);
  assert.match(ladderPage, /Reply due/);
  assert.match(ladderPage, /Play by/);
  assert.doesNotMatch(ladderPage, /You challenged \$\{activeOpponent\.name\}/);
  assert.doesNotMatch(ladderPage, /Playing \$\{activeOpponent\.name\}/);
});

test("players and managers see eligible ladders and the first ladder opens by default", () => {
  assert.match(ladderApi, /club_ladder_eligible_team/);
  assert.match(ladderApi, /person_team_role/);
  assert.match(ladderApi, /role\.role in \('Player', 'Manager'\)/);
  assert.match(ladderApi, /membership\.role in \('Player', 'Manager'\)/);
  assert.doesNotMatch(ladderApi, /role\.role = 'Player'/);
  assert.doesNotMatch(ladderApi, /membership\.role = 'Player'/);
  assert.match(ladderApi, /ladderId/);
  assert.match(ladderApi, /ladders:/);
  assert.match(ladderPage, /setSelectedLadderId\(.*ladders\[0\]\?\.ladder\.id/s);
  assert.match(ladderPage, /aria-expanded=\{selected\}/);
  assert.match(ladderPage, /Other ladders|Your ladders/);
  assert.match(ladderPage, /ladder\.useHandicap/);
  assert.match(ladderPage, /There are no eligible ladders for you at the moment\./);
});

test("team managers can join ladders involving their teams", () => {
  assert.match(ladderApi, /role\.role in \('Player', 'Manager'\)/);
  assert.match(ladderApi, /membership\.role in \('Player', 'Manager'\)/);
  assert.match(ladderApi, /as can_join/);
  assert.match(ladderApi, /if \(action === "join" && !ladder\.can_join\)/);
  assert.match(ladderPage, /Manager view/);
  assert.match(ladderPage, /data\.canJoin/);
  assert.match(ladderPage, /ladderView\.canJoin/);
});

test("ladder challenge creation and acceptance write explicit activity logs", () => {
  assert.match(ladderApi, /Ladder challenge made/);
  assert.match(ladderApi, /Ladder challenge accepted/);
  assert.match(ladderApi, /'challenge_id'/);
  assert.match(ladderApi, /'opponent_person_id'/);
  assert.match(ladderApi, /'status'/);
});

test("team eligibility is current and eligibility changes withdraw affected entrants", () => {
  const eligibilityLoader = ladderApi.slice(ladderApi.indexOf("async function loadEligibleLadders"), ladderApi.indexOf("function formatChallenge"));
  assert.doesNotMatch(eligibilityLoader, /club_ladder_entry/);
  assert.match(adminLadderApi, /status = 'Cancelled'/);
  assert.match(adminLadderApi, /status = 'Withdrawn'/);
  assert.match(adminLadderApi, /Every selected player must be eligible for this ladder/);
  assert.match(adminLadderApi, /ptr\.role in \('Player', 'Manager'\)/);
  assert.match(adminLadderApi, /tm\.role in \('Player', 'Manager'\)/);
  assert.doesNotMatch(adminLadderApi, /ptr\.role = 'Player'/);
  assert.doesNotMatch(adminLadderApi, /tm\.role = 'Player'/);
  assert.match(adminLadderApi, /array_agg\(distinct roles\.team_id::text\)/);
  assert.match(adminLadderApi, /select ptr\.club_id, ptr\.person_id/);
  assert.match(adminLadderApi, /select team\.club_id, membership\.person_id/);
  assert.match(adminLadderApi, /select distinct person\.id::text as person_id/);
});

test("club ladders show handicaps and allow players to leave safely", () => {
  assert.match(ladderApi, /membership\.handicap::text/);
  assert.match(ladderApi, /if \(action === "leave"\)/);
  assert.match(ladderApi, /Finish or cancel your active challenge before leaving/);
  assert.match(ladderPage, /<Handicap value=\{entry\.handicap\}/);
  assert.match(ladderPage, /Leave ladder/);
});

test("admin ladder entries remain unique when a player has multiple club membership rows", () => {
  assert.match(adminLadderApi, /left join lateral \(\s*select max\(cm\.handicap\)::text as handicap[\s\S]*?\) membership on true/);
  assert.doesNotMatch(adminLadderApi, /left join public\.club_membership membership/);
});

test("every ladder view clearly identifies handicap or scratch play", () => {
  assert.match(ladderPage, /Handicap ladder/);
  assert.match(ladderPage, /Scratch ladder/);
  assert.match(ladderPage, /ladderModeLabel/);
  assert.match(ladderPage, /aria-label=\{`Ladder type:/);
});

test("ladder administrators can permanently delete a ladder and its cascading data", () => {
  assert.match(adminLadderApi, /export async function DELETE/);
  assert.match(adminLadderApi, /delete from public\.club_ladder where id = \$1/);
  assert.match(adminLadders, /Permanently delete/);
  assert.match(adminLadders, /Delete ladder/);
});

test("ladder administrators can remove a player without losing completed history", () => {
  assert.match(adminLadderApi, /export async function PATCH/);
  assert.match(adminLadderApi, /status = 'Cancelled'/);
  assert.match(adminLadderApi, /status = 'Withdrawn'/);
  assert.match(adminLadderApi, /Club ladder player removed/);
  assert.match(adminLadderApi, /row_number\(\) over/);
  assert.match(adminLadders, /Current players/);
  assert.match(adminLadders, /removePlayer/);
  assert.match(adminLadders, /Remove .* from this ladder/);
});

test("ladder administrators can add eligible players to an existing ladder", () => {
  assert.match(adminLadderApi, /action === "addPlayers"/);
  assert.match(adminLadderApi, /personIds/);
  assert.match(adminLadderApi, /Every selected player must be eligible for this ladder/);
  assert.match(adminLadderApi, /on conflict \(ladder_id, person_id\)/);
  assert.match(adminLadderApi, /Club ladder players added/);
  assert.match(adminLadders, /Add players/);
  assert.match(adminLadders, /addPlayers/);
  assert.match(adminLadders, /Add selected to ladder/);
  assert.match(adminLadders, /selectedLadder\.entries\.some/);
});

test("changing ladder teams immediately recalculates eligible player choices", () => {
  assert.match(adminLadders, /eligibleMembersForTeams\(club, eligibleTeamIds\)/);
  assert.match(adminLadders, /eligibleMembersForTeams\(club, draft\.eligibleTeamIds\)/);
  assert.match(adminLadders, /setAddPersonIds\(eligibleMembers[\s\S]*?!currentEntryPersonIds\.has\(member\.personId\)/);
  assert.match(adminLadders, /Save team changes before adding players/);
  assert.match(adminLadders, /disabled=\{saving \|\| !addPersonIds\.length \|\| eligibilityChanged\}/);
  assert.doesNotMatch(adminLadders, /selectedLadder\.eligibleTeamIds\.length \|\| member\.teamIds/);
});

test("the ladder itself communicates challenge stakes and recent form", () => {
  assert.match(ladderApi, /form\.recent_form/);
  assert.match(ladderApi, /challenge\.winner_entry_id = cle\.id then 'W' else 'L'/);
  assert.match(ladderApi, /limit 3/);
  assert.match(ladderPage, /Beat a player above you and take their position/);
  assert.match(ladderPage, /Play for #\{entry\.position\}/);
  assert.match(ladderPage, /\{challenge\.challenger\.name\} wins: moves to #/);
  assert.match(ladderPage, /\{challenge\.challenged\.name\} wins: holds #/);
  assert.match(ladderPage, /function RecentForm/);
  assert.match(ladderPage, /results\.slice\(0, 3\)\.join\(""\)/);
  assert.match(ladderPage, /\? "Won" : "Lost"/);
});

test("either ladder player can record a result and update positions immediately", () => {
  const submitResult = ladderApi.slice(ladderApi.indexOf('if (action === "submitResult")'), ladderApi.indexOf('if (action === "cancel"'));
  assert.match(submitResult, /status = 'Completed'/);
  assert.match(submitResult, /completed_at = now\(\)/);
  assert.match(submitResult, /position = position \+ 1/);
  assert.match(submitResult, /return \{ status: "Completed" \}/);
  assert.doesNotMatch(submitResult, /status = 'Result Pending'|return \{ status: "Result Pending" \}/);
  assert.match(ladderPage, /Record result/);
  assert.match(ladderPage, /updates the ladder immediately/);
  assert.doesNotMatch(ladderPage, /type="datetime-local"/);
  assert.match(submitResult, /result_submitted_at = now\(\)/);
  assert.doesNotMatch(ladderPage, /Result awaiting confirmation|Opponent to confirm|>Confirm<|>Dispute</);
});

test("an unrecorded ladder result starts at nil all", () => {
  assert.match(ladderPage, /challenger: challenge\.challengerScore \?\? 0/);
  assert.match(ladderPage, /challenged: challenge\.challengedScore \?\? 0/);
  assert.doesNotMatch(ladderPage, /challenger: challenge\.challengerScore \?\? requiredFrameWins/);
});

test("ladder entries preserve and display their starting position", () => {
  assert.match(schema, /starting_position integer not null check \(starting_position > 0\)/);
  assert.match(startingPositionMigration, /add column if not exists starting_position integer/);
  assert.match(startingPositionMigration, /set starting_position = position/);
  assert.match(ladderApi, /cle\.starting_position/);
  assert.match(ladderPage, /Started #\{entry\.startingPosition\}/);
  assert.match(adminLadderApi, /starting_position/);
});

test("admin ladder challenge lists load only when their accordions open", () => {
  assert.match(adminLadderApi, /detail === "activeChallenges"/);
  assert.match(adminLadderApi, /detail === "history"/);
  assert.match(adminLadders, /Active challenges/);
  assert.match(adminLadders, /Match history/);
  assert.match(adminLadders, /loadLadderDetail/);
  assert.match(adminLadders, /detail=/);
  assert.match(adminLadders, /openDetailKeys/);
  assert.match(adminLadders, /\[key\]: !current\[key\]/);
  assert.doesNotMatch(adminLadders, /const \[openDetailKey, setOpenDetailKey\]/);
});

test("ladder administrators can accept challenges and record results for players", () => {
  assert.match(adminLadderApi, /action === "acceptChallenge"/);
  assert.match(adminLadderApi, /action === "recordResult"/);
  assert.match(adminLadderApi, /Club ladder challenge accepted by administrator/);
  assert.match(adminLadderApi, /Club ladder result recorded by administrator/);
  assert.match(adminLadderApi, /resolveLadderResult/);
  assert.match(adminLadderApi, /result_submitted_by = \$5/);
  assert.match(adminLadders, /Accept challenge/);
  assert.match(adminLadders, /Record result/);
  assert.match(adminLadders, /adminChallengeAction/);
});

test("ignoring a repeat challenge awards a walkover and swaps the two positions", () => {
  assert.match(ladderApi, /async function expirePendingChallenges/);
  assert.match(ladderApi, /previous\.status = 'Rejected'/);
  assert.match(ladderApi, /status = 'Walkover'/);
  assert.match(ladderApi, /winner_entry_id = expired\.challenger_entry_id/);
  assert.match(ladderApi, /case when entry\.id = expired\.challenger_entry_id/);
  assert.match(ladderPage, /If the deadline passes, you swap positions/);
  assert.match(ladderPage, /"Walkover"/);
});
