"use client";

import { CalendarClock, Check, ChevronDown, ChevronRight, Clock3, LogOut, Medal, RotateCcw, ShieldCheck, Swords, Trophy, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubFeatureUnavailable } from "@/components/club-feature-unavailable";
import { requiredFrameWins } from "@/lib/club-ladder.mjs";
import type { TeamContext } from "@/lib/types";
import { cn } from "@/lib/utils";

type LadderMatchFormat = "1 Frame" | "Best of 3" | "Best of 5";
type LadderEntry = { id: string; personId: string; name: string; handicap: number | null; recentForm: Array<"W" | "L">; position: number; status: string; canChallenge: boolean };
type LadderChallenge = {
  id: string;
  status: string;
  challenger: { entryId: string; personId: string; name: string; position: number };
  challenged: { entryId: string; personId: string; name: string; position: number };
  responseDueAt: string | null;
  scheduledAt: string | null;
  playBy: string | null;
  challengerScore: number | null;
  challengedScore: number | null;
  winnerEntryId: string | null;
  submittedByMe: boolean;
  isChallenger: boolean;
  isChallenged: boolean;
  canReject: boolean;
};
type LadderView = {
  available: boolean;
  ladder: {
    id: string;
    name: string;
    clubName: string;
    matchFormat: LadderMatchFormat;
    challengeRange: number;
    responseHours: number;
    playWithinDays: number;
    useHandicap: boolean;
  };
  me: { entryId: string; personId: string; position: number; status: string } | null;
  entries: LadderEntry[];
  challenges: LadderChallenge[];
};
type LadderPayload = {
  configured: boolean;
  clubName?: string;
  ladders: LadderView[];
};

export function ClubLadderHomePanel({ activeTeam, onOpen, className }: { activeTeam: TeamContext; onOpen: () => void; className?: string }) {
  const [data, setData] = useState<LadderPayload | null>(null);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch(testAwarePath(`/api/club/ladder?club=${encodeURIComponent(activeTeam.club)}`), { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Club ladder could not be loaded.");
      setData(payload);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active) return;
      await load();
    };
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("interclub:refresh-panels", onRefresh);
    return () => {
      active = false;
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("interclub:refresh-panels", onRefresh);
    };
  }, [activeTeam.club]);

  async function join(ladderId: string) {
    setJoining(true);
    setMessage("");
    try {
      const response = await fetch(testAwarePath("/api/club/ladder"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ club: activeTeam.club, ladderId, action: "join" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not join the ladder.");
      await load();
      window.dispatchEvent(new Event("interclub:refresh-panels"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join the ladder.");
    } finally {
      setJoining(false);
    }
  }

  if (!data?.ladders.length) return null;

  const ladderView = data.ladders.find((item) => item.me) ?? data.ladders[0];
  const myEntry = ladderView.me ? ladderView.entries.find((entry) => entry.id === ladderView.me?.entryId) ?? null : null;
  const activeChallenges = ladderView.challenges.filter((challenge) => ["Pending", "Accepted", "Scheduled", "Result Pending", "Disputed"].includes(challenge.status));
  const totalPlayers = ladderView.entries.length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div
        className="grid gap-4 p-4 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        style={{ background: `linear-gradient(135deg, ${activeTeam.primaryColor}, ${activeTeam.accentColor} 68%, #071426)` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><Swords className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase text-white/65">Club ladder</p>
            <h2 className="truncate text-xl font-black">{ladderView.ladder.name}</h2>
            <p className="mt-0.5 text-xs font-bold text-white/70">{ladderView.ladder.matchFormat} · {ladderView.ladder.useHandicap ? "Handicap" : "Scratch"} · Challenge {ladderView.ladder.challengeRange} places up</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="soft">{totalPlayers} players</Badge>
          {data.ladders.length > 1 ? <Badge variant="soft">{data.ladders.length} ladders</Badge> : null}
          {ladderView.me ? <Badge variant="cyan">Position #{ladderView.me.position}</Badge> : <Badge variant="gold">Open to join</Badge>}
        </div>
      </div>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        {ladderView.me ? (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-[#6c5a73]">Recent form</p>
              <div className="mt-1"><RecentForm results={myEntry?.recentForm ?? []} primaryColor={activeTeam.primaryColor} accentColor={activeTeam.accentColor} /></div>
            </div>
            <div className="h-9 w-px bg-[#e3ddea]" />
            <div>
              <p className="text-[10px] font-black uppercase text-[#6c5a73]">Active challenge</p>
              <p className="mt-1 text-sm font-black text-[#10233f]">{activeChallenges.length ? activeChallenges[0].status : "None"}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-black text-[#10233f]">Join at the bottom and start climbing</p>
            <p className="mt-1 text-xs font-semibold text-[#6c5a73]">Once you join, you can challenge nearby players directly from the ladder.</p>
            {message ? <p className="mt-2 text-xs font-bold text-[#b42318]">{message}</p> : null}
          </div>
        )}
        {ladderView.me ? (
          <Button variant="secondary" onClick={onOpen}>View ladder<ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={() => void join(ladderView.ladder.id)} disabled={joining}><UserPlus className="h-4 w-4" />{joining ? "Joining..." : "Join ladder"}</Button>
        )}
      </CardContent>
    </Card>
  );
}

function testAwarePath(path: string) {
  if (typeof window === "undefined") return path;
  const testUser = new URLSearchParams(window.location.search).get("testUser");
  return testUser ? `${path}${path.includes("?") ? "&" : "?"}testUser=${encodeURIComponent(testUser)}` : path;
}

function localDateTimeValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function friendlyDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ClubLadderPage({ activeTeam }: { activeTeam: TeamContext }) {
  const [collection, setCollection] = useState<LadderPayload | null>(null);
  const [selectedLadderId, setSelectedLadderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scheduledTimes, setScheduledTimes] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, { challenger: number; challenged: number }>>({});

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(testAwarePath(`/api/club/ladder?club=${encodeURIComponent(activeTeam.club)}`), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Club ladder could not be loaded.");
      setCollection(payload);
      setSelectedLadderId((current) => payload.ladders.some((item: LadderView) => item.ladder.id === current) ? current : payload.ladders[0]?.ladder.id ?? null);
      const allChallenges = (payload.ladders ?? []).flatMap((item: LadderView) => item.challenges.map((challenge) => ({ challenge, format: item.ladder.matchFormat })));
      setScheduledTimes(Object.fromEntries(allChallenges.map(({ challenge }: { challenge: LadderChallenge }) => [challenge.id, localDateTimeValue(challenge.scheduledAt)])));
      setScores(Object.fromEntries(allChallenges.map(({ challenge, format }: { challenge: LadderChallenge; format: LadderMatchFormat }) => [challenge.id, {
        challenger: challenge.challengerScore ?? requiredFrameWins(format),
        challenged: challenge.challengedScore ?? 0
      }])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Club ladder could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [activeTeam.club]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(testAwarePath("/api/club/ladder"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ club: activeTeam.club, ladderId: data?.ladder.id, action, ...extra })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Ladder action failed.");
      setMessage(action === "join" ? "You have joined the ladder." : action === "leave" ? "You have left the ladder." : "Ladder updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ladder action failed.");
    } finally {
      setBusy(false);
    }
  }

  const data = collection?.ladders.find((item) => item.ladder.id === selectedLadderId) ?? collection?.ladders[0] ?? null;
  const activeChallenges = useMemo(() => (data?.challenges ?? []).filter((challenge) => ["Pending", "Accepted", "Scheduled", "Result Pending", "Disputed"].includes(challenge.status)), [data?.challenges]);

  if (loading) {
    return <Card><CardContent className="p-5 text-sm font-bold text-[#6c5a73]">Loading the club ladder...</CardContent></Card>;
  }
  if (!collection?.configured || !collection.ladders.length) {
    return (
      <ClubFeatureUnavailable
        icon={Swords}
        eyebrow="Club ladder"
        title={collection?.configured ? "There is no ladder available for your team yet." : "This club has not configured a ladder yet."}
        description={collection?.configured ? "Club ladders can be limited to selected teams. An administrator can add your team or create a club-wide ladder." : "Once a club administrator switches it on, members can join, challenge nearby players and record results here."}
        primaryColor={activeTeam.primaryColor}
        accentColor={activeTeam.accentColor}
      />
    );
  }
  if (!data) return null;

  const ladder = data.ladder;
  const entries = data.entries ?? [];
  const winsRequired = requiredFrameWins(ladder.matchFormat);
  const handicapFor = (personId: string) => entries.find((entry) => entry.personId === personId)?.handicap ?? null;

  return (
    <section className="grid gap-4">
      {collection.ladders.length > 1 ? (
        <Card className="overflow-hidden">
          <CardHeader><div><CardTitle>Your ladders</CardTitle><p className="mt-1 text-sm font-semibold text-[#6c5a73]">The first ladder is open. Select another to switch ladders.</p></div><Badge variant="cyan">{collection.ladders.length}</Badge></CardHeader>
          <CardContent className="grid gap-2">
            {collection.ladders.map((item) => {
              const selected = item.ladder.id === data.ladder.id;
              return (
                <button key={item.ladder.id} type="button" aria-expanded={selected} onClick={() => { setSelectedLadderId(item.ladder.id); setRulesOpen(false); setMessage(""); }} className={cn("grid min-h-14 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition-colors", selected ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-[#f7f5fa] text-[#10233f] ring-[#eeeaf2]")}>
                  <span className={cn("grid h-9 w-9 place-items-center rounded-lg", selected ? "bg-white/15" : "bg-white text-[#1b8a72]")}><Trophy className="h-4 w-4" /></span>
                  <span className="min-w-0"><span className="block truncate font-black">{item.ladder.name}</span><span className={cn("block text-xs font-semibold", selected ? "text-white/65" : "text-[#6c5a73]")}>{item.ladder.matchFormat} · {item.ladder.useHandicap ? "Handicap" : "Scratch"} · {item.entries.length} players</span></span>
                  <span className="flex items-center gap-2">{item.me ? <Badge variant="cyan">#{item.me.position}</Badge> : <Badge variant="gold">Join</Badge>}<ChevronDown className={cn("h-5 w-5 transition-transform", selected && "rotate-180")} /></span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-hidden rounded-2xl p-5 text-white shadow-card" style={{ background: `linear-gradient(135deg, ${activeTeam.primaryColor}, ${activeTeam.accentColor})` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-white/65">{activeTeam.club.replace(" Golf Club", "")}</p>
            <h1 className="mt-1 text-3xl font-black">{ladder.name}</h1>
            <p className="mt-2 text-sm font-bold text-white/75">Challenge upward, arrange the match and earn your place.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="cyan">{ladder.matchFormat}</Badge>
            <Badge variant="soft">{ladder.useHandicap ? "Handicap" : "Scratch"}</Badge>
            <Badge variant="soft">{entries.length} players</Badge>
          </div>
        </div>
        {data.me ? (
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/20"><p className="text-[10px] font-black uppercase text-white/60">Your position</p><p className="mt-1 text-3xl font-black">#{data.me.position}</p></div>
            <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/20"><p className="text-[10px] font-black uppercase text-white/60">Active challenge</p><p className="mt-1 text-3xl font-black">{activeChallenges.length ? "Yes" : "No"}</p></div>
          </div>
        ) : null}
      </div>

      {message ? <div className={cn("rounded-xl px-4 py-3 text-sm font-bold", message.includes("failed") || message.includes("cannot") || message.includes("must") ? "bg-[#ffe7ef] text-[#9f1239]" : "bg-[#e7fbf3] text-[#087454]")}>{message}</div> : null}
      {!data.available ? <div className="rounded-xl bg-[#fff6dd] p-4 font-bold text-[#7b5500]">This ladder is currently paused by the club.</div> : null}

      <Card>
        <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setRulesOpen((open) => !open)} aria-expanded={rulesOpen}>
          <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef7f5] text-[#1b8a72]"><ShieldCheck className="h-5 w-5" /></span><span><span className="block font-black">Ladder rules</span><span className="block text-xs font-semibold text-[#6c5a73]">Simple rules for fair, active challenges.</span></span></span>
          <ChevronDown className={cn("h-5 w-5 transition-transform", rulesOpen && "rotate-180")} />
        </button>
        {rulesOpen ? (
          <CardContent className="grid gap-2 border-t border-[#eeeaf2] pt-4 sm:grid-cols-2">
            <Rule icon={Swords} number="1" title="Challenge upward" text={`Challenge anyone up to ${ladder.challengeRange} places above you. Each player can be in one active challenge.`} />
            <Rule icon={Clock3} number="2" title="Answer promptly" text={`The challenged player has ${ladder.responseHours} hours to answer and may reject the same challenger only once.`} />
            <Rule icon={CalendarClock} number="3" title="Arrange the match" text={`Once accepted, play within ${ladder.playWithinDays} days. The format is ${ladder.matchFormat.toLowerCase()}.`} />
            <Rule icon={Medal} number="4" title="Move up by winning" text="If the challenger wins, they take the challenged position and the players between move down one place." />
          </CardContent>
        ) : null}
      </Card>

      {!data.me && data.available ? (
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><p className="text-lg font-black text-[#10233f]">Join at the bottom and start climbing</p><p className="mt-1 text-sm font-semibold text-[#6c5a73]">Your first challenge can be made as soon as you join.</p></div>
            <Button onClick={() => void act("join")} disabled={busy}><UserPlus className="h-4 w-4" />Join ladder</Button>
          </CardContent>
        </Card>
      ) : null}

      {activeChallenges.map((challenge) => {
        const opponent = challenge.isChallenger ? challenge.challenged : challenge.challenger;
        const positionAtStake = challenge.challenged.position;
        const scheduleValue = scheduledTimes[challenge.id] ?? "";
        const score = scores[challenge.id] ?? { challenger: winsRequired, challenged: 0 };
        return (
          <Card key={challenge.id} className="overflow-hidden border-[#bfe9dc]">
            <CardHeader className="bg-[#eef9f5]">
              <div><CardTitle>Active Challenge</CardTitle><p className="mt-1 font-black text-[#10233f]">You v {opponent.name}</p></div>
              <Badge variant={challenge.status === "Disputed" ? "gold" : "green"}>{challenge.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#10233f] px-3 py-2 text-white">
                <span className="text-xs font-black uppercase text-white/65">Position at stake</span>
                <span className="font-black">Challenger wins: moves to #{positionAtStake} · Challenged wins: holds #{positionAtStake}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-center">
                <div><p className="text-[10px] font-black uppercase text-[#6c5a73]">Challenger</p><p className="mt-1 font-black">#{challenge.challenger.position} {challenge.challenger.name} {ladder.useHandicap ? <Handicap value={handicapFor(challenge.challenger.personId)} /> : null}</p></div>
                <Swords className="h-5 w-5 text-[#1b8a72]" />
                <div><p className="text-[10px] font-black uppercase text-[#6c5a73]">Challenged</p><p className="mt-1 font-black">#{challenge.challenged.position} {challenge.challenged.name} {ladder.useHandicap ? <Handicap value={handicapFor(challenge.challenged.personId)} /> : null}</p></div>
              </div>

              {challenge.status === "Pending" && challenge.isChallenged ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => void act("respond", { challengeId: challenge.id, response: "accept", scheduledAt: scheduleValue ? new Date(scheduleValue).toISOString() : null })} disabled={busy}><Check className="h-4 w-4" />Accept challenge</Button>
                  <Button variant="secondary" onClick={() => void act("respond", { challengeId: challenge.id, response: "reject" })} disabled={busy || !challenge.canReject}><X className="h-4 w-4" />{challenge.canReject ? "Reject once" : "Must accept"}</Button>
                </div>
              ) : null}
              {challenge.status === "Pending" && challenge.isChallenger ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f5fa] p-3"><span className="text-sm font-bold text-[#6c5a73]">Reply due {friendlyDate(challenge.responseDueAt)}</span><Button size="sm" variant="ghost" onClick={() => void act("cancel", { challengeId: challenge.id })}>Cancel</Button></div>
              ) : null}

              {["Accepted", "Scheduled"].includes(challenge.status) ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-1"><span className="text-[11px] font-black uppercase text-[#6c5a73]">Match date and time</span><input type="datetime-local" className="min-h-11 rounded-xl border border-[#e3ddea] px-3 font-bold" value={scheduleValue} onChange={(event) => setScheduledTimes((current) => ({ ...current, [challenge.id]: event.target.value }))} /></label>
                  <Button variant="secondary" disabled={busy || !scheduleValue} onClick={() => void act("schedule", { challengeId: challenge.id, scheduledAt: new Date(scheduleValue).toISOString() })}><CalendarClock className="h-4 w-4" />Save schedule</Button>
                </div>
              ) : null}

              {["Accepted", "Scheduled"].includes(challenge.status) ? (
                <div className="grid gap-2 rounded-xl border border-[#eeeaf2] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <ScoreInput label={challenge.challenger.name} value={score.challenger} max={winsRequired} onChange={(value) => setScores((current) => ({ ...current, [challenge.id]: { ...score, challenger: value } }))} />
                  <ScoreInput label={challenge.challenged.name} value={score.challenged} max={winsRequired} onChange={(value) => setScores((current) => ({ ...current, [challenge.id]: { ...score, challenged: value } }))} />
                  <Button disabled={busy} onClick={() => void act("submitResult", { challengeId: challenge.id, challengerScore: score.challenger, challengedScore: score.challenged })}><Trophy className="h-4 w-4" />Submit result</Button>
                </div>
              ) : null}

              {challenge.status === "Result Pending" ? (
                <div className="grid gap-3 rounded-xl bg-[#fff6dd] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div><p className="text-xs font-black uppercase text-[#7b5500]">Result awaiting confirmation</p><p className="mt-1 text-xl font-black">{challenge.challenger.name} {challenge.challengerScore}–{challenge.challengedScore} {challenge.challenged.name}</p></div>
                  {!challenge.submittedByMe ? <div className="flex gap-2"><Button onClick={() => void act("confirmResult", { challengeId: challenge.id, confirm: true })}><Check className="h-4 w-4" />Confirm</Button><Button variant="secondary" onClick={() => void act("confirmResult", { challengeId: challenge.id, confirm: false })}>Dispute</Button></div> : <Badge variant="gold">Opponent to confirm</Badge>}
                </div>
              ) : null}
              {challenge.scheduledAt ? <p className="text-xs font-bold text-[#6c5a73]">Scheduled: {friendlyDate(challenge.scheduledAt)} · Play by {friendlyDate(challenge.playBy)}</p> : challenge.playBy ? <p className="text-xs font-bold text-[#6c5a73]">Play by {friendlyDate(challenge.playBy)}</p> : null}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader><div><CardTitle>Current Ladder</CardTitle><p className="mt-1 text-sm font-semibold text-[#6c5a73]">Challenge directly from the table. Beat a player above you and take their position.</p></div><Badge variant="muted">{entries.length}</Badge></CardHeader>
        <CardContent className="grid gap-2">
          {entries.map((entry) => {
            const mine = entry.id === data.me?.entryId;
            return (
              <div key={entry.id} className={cn("grid min-h-14 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2 ring-1", mine ? "bg-[#eef9f5] ring-[#bfe9dc]" : "bg-white ring-[#eeeaf2]")}>
                <span className={cn("grid h-9 w-9 place-items-center rounded-lg text-sm font-black", entry.position <= 3 ? "bg-[#10233f] text-white" : "bg-[#f0edf4] text-[#10233f]")}>{entry.position}</span>
                <div className="min-w-0">
                  <p className="truncate font-black text-[#10233f]">{entry.name} {ladder.useHandicap ? <Handicap value={entry.handicap} /> : null}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-[#6c5a73]">{mine ? "Your position" : entry.canChallenge ? `Beat them to take #${entry.position}` : entry.status}</span>
                    <RecentForm results={entry.recentForm} primaryColor={activeTeam.primaryColor} accentColor={activeTeam.accentColor} />
                  </div>
                </div>
                {entry.canChallenge && data.available ? <Button size="sm" onClick={() => void act("challenge", { challengedEntryId: entry.id })} disabled={busy}><Swords className="h-4 w-4" />Play for #{entry.position}</Button> : mine ? <Badge variant="green">You</Badge> : null}
              </div>
            );
          })}
          {!entries.length ? <p className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-semibold text-[#6c5a73]">No one has joined yet. The first member will take position 1.</p> : null}
        </CardContent>
      </Card>

      {data.me ? (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-[#6c5a73]" disabled={busy || activeChallenges.length > 0} onClick={() => {
            if (window.confirm("Leave this ladder? You will rejoin at the bottom if you enter again.")) void act("leave");
          }}>
            <LogOut className="h-4 w-4" />Leave ladder
          </Button>
        </div>
      ) : null}

      {(data.challenges ?? []).some((challenge) => ["Completed", "Rejected", "Expired", "Cancelled"].includes(challenge.status)) ? (
        <Card>
          <CardHeader><CardTitle>Recent challenges</CardTitle><RotateCcw className="h-4 w-4 text-[#6c5a73]" /></CardHeader>
          <CardContent className="grid gap-2">
            {(data.challenges ?? []).filter((challenge) => ["Completed", "Rejected", "Expired", "Cancelled"].includes(challenge.status)).slice(0, 5).map((challenge) => (
              <div key={challenge.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f5fa] p-3">
                <span className="min-w-0 truncate text-sm font-bold">{challenge.challenger.name} v {challenge.challenged.name}</span>
                {challenge.status === "Completed" ? (
                  <Badge variant={challenge.winnerEntryId === (challenge.isChallenger ? challenge.challenger.entryId : challenge.challenged.entryId) ? "green" : "muted"}>
                    {challenge.winnerEntryId === (challenge.isChallenger ? challenge.challenger.entryId : challenge.challenged.entryId) ? "Won" : "Lost"}
                  </Badge>
                ) : <Badge variant="muted">{challenge.status}</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Rule({ icon: Icon, number, title, text }: { icon: typeof Users; number: string; title: string; text: string }) {
  return <div className="grid grid-cols-[42px_1fr] gap-3 rounded-xl bg-[#f7f5fa] p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10233f] text-white"><Icon className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase text-[#1b8a72]">Rule {number}</p><p className="font-black text-[#10233f]">{title}</p><p className="mt-1 text-xs font-semibold leading-relaxed text-[#6c5a73]">{text}</p></div></div>;
}

function ScoreInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1"><span className="truncate text-[11px] font-black uppercase text-[#6c5a73]">{label}</span><select className="min-h-11 rounded-xl border border-[#e3ddea] bg-white px-3 text-lg font-black" value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: max + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label>;
}

function Handicap({ value }: { value: number | null }) {
  return value === null ? null : <span className="whitespace-nowrap text-[10px] font-black uppercase text-[#6c5a73]">(Hcp {value})</span>;
}

function RecentForm({ results, primaryColor, accentColor }: { results: Array<"W" | "L">; primaryColor: string; accentColor: string }) {
  const form = results.slice(0, 3).join("") || "-";
  return (
    <span
      className="inline-flex min-w-9 justify-center rounded-md px-1.5 py-1 text-[10px] font-black text-white"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
      aria-label={`Recent three match form ${form}`}
    >
      {form}
    </span>
  );
}
