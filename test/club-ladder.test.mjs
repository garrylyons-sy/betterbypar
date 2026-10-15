import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canChallengePosition,
  canRejectChallenge,
  normalizeLadderSettings,
  requiredFrameWins,
  validateLadderResult
} from "../lib/club-ladder.mjs";

const schema = readFileSync(new URL("../supabase/club_ladders.sql", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const ladderPage = readFileSync(new URL("../components/club-ladder.tsx", import.meta.url), "utf8");
const adminConsole = readFileSync(new URL("../components/admin-console.tsx", import.meta.url), "utf8");
const adminLadders = readFileSync(new URL("../components/admin-club-ladders.tsx", import.meta.url), "utf8");

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
    active: true
  });
  assert.throws(() => normalizeLadderSettings({ matchFormat: "Best of 7" }), /match format/i);
});

test("players may challenge only the configured number of places above", () => {
  assert.equal(canChallengePosition(8, 5, 3), true);
  assert.equal(canChallengePosition(8, 4, 3), false);
  assert.equal(canChallengePosition(5, 6, 3), false);
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

test("ladder schema cascades club ladder data and preserves challenge history", () => {
  assert.match(schema, /create table if not exists public\.club_ladder/);
  assert.match(schema, /club_id uuid not null unique references public\.club\(id\) on delete cascade/);
  assert.match(schema, /ladder_id uuid not null references public\.club_ladder\(id\) on delete cascade/);
  assert.match(schema, /challenger_entry_id uuid not null references public\.club_ladder_entry\(id\) on delete cascade/);
  assert.match(schema, /challenged_entry_id uuid not null references public\.club_ladder_entry\(id\) on delete cascade/);
  assert.match(schema, /match_format text not null[^;]+1 Frame[^;]+Best of 3[^;]+Best of 5/s);
  assert.match(schema, /status text not null default 'Pending'/);
});

test("admin and My Club expose the ladder without adding it to the main navigation", () => {
  assert.match(adminConsole, /label: "Ladders"/);
  assert.match(adminConsole, /<AdminClubLadders/);
  assert.match(appShell, /onNavigate\("Ladder"\)/);
  assert.match(appShell, /if \(activePage === "Ladder"\) return <ClubLadderPage/);
  assert.match(ladderPage, /This club has not configured a ladder yet\./);
  assert.match(ladderPage, /Ladder rules/);
  assert.doesNotMatch(appShell, /"Ladder"[^\n]+AppearanceMenuId/);
});

test("admin ladder settings constrain controls inside responsive grid columns", () => {
  assert.match(adminLadders, /2xl:grid-cols-\[minmax\(15rem,1\.2fr\)_repeat\(4,minmax\(0,1fr\)\)\]/);
  assert.match(adminLadders, /min-h-11 w-full min-w-0 rounded-lg/);
});
