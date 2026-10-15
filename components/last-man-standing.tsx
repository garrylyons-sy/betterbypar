"use client";

import { Check, ChevronDown, ChevronRight, Clock3, Trophy, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Summary = {
  id: string;
  name: string;
  status: string;
  isEntered: boolean;
  currentRound: { id: string; name: string; status: string } | null;
  panel: { roundLabel: string; picks: string[]; pickOutcomes: string[]; pickChanged: boolean[]; entrantStatus: string; remainingLabel: string; deadlineAt: string | null } | null;
};
type Candidate = { id: string; name: string; teamName: string; used: boolean; hasFixture: boolean };
type DisplayPick = { slotNumber: number; playerName: string | null; selectedPlayerName: string | null; wasChanged: boolean; state: string; outcome: string; automaticReason: string | null };
type Detail = {
  competition: { id: string; name: string; status: string; entryOpensAt: string; entryClosesAt: string };
  entryOptions: Array<{ tier: string; sourceRole: string; teamId: string; teamName: string }>;
  defaultEntryOption: { tier: string; sourceRole: string; teamId: string; teamName: string } | null;
  entry: { id: string; status: string; tier: string; sourceTeamId: string } | null;
  currentRound: { id: string; name: string; cycleNumber: number; roundNumber: number; status: string } | null;
  progress: { roundsPlayed: number; entrantCount: number; standingCount: number; winnerName: string | null };
  candidates: Candidate[];
  picks: Array<DisplayPick & { id: string; playerId: string | null; deadlineAt: string | null; version: number }>;
  entries: Array<{ id: string; personName: string; status: string; sourceTeamName: string; deadlineAt: string; picks: DisplayPick[]; picksHidden: boolean }>;
  history: Array<DisplayPick & { roundName: string }>;
};

function apiPath(path: string) {
  if (typeof window === "undefined") return path;
  const testUser = new URLSearchParams(window.location.search).get("testUser")?.trim();
  return testUser ? `${path}${path.includes("?") ? "&" : "?"}testUser=${encodeURIComponent(testUser)}` : path;
}

const summaryCacheLifetimeMs = 30_000;
let summariesCache: { path: string; rows: Summary[]; loadedAt: number } | null = null;
let summariesRequest: { path: string; promise: Promise<Summary[]> } | null = null;

async function loadSummaries(force = false) {
  const path = apiPath("/api/last-man-standing");
  if (!force && summariesCache?.path === path && Date.now() - summariesCache.loadedAt < summaryCacheLifetimeMs) {
    return summariesCache.rows;
  }
  if (!force && summariesRequest?.path === path) return summariesRequest.promise;

  const promise = fetch(path, { credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Last Man Standing could not be loaded.");
      const rows = (data.competitions ?? []) as Summary[];
      summariesCache = { path, rows, loadedAt: Date.now() };
      return rows;
    })
    .finally(() => {
      if (summariesRequest?.promise === promise) summariesRequest = null;
    });
  summariesRequest = { path, promise };
  return promise;
}

export function LastManStandingHomePanel({ onOpen }: { onOpen: () => void }) {
  const [competitions, setCompetitions] = useState<Summary[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = (force = false) => loadSummaries(force).then((rows) => { if (active) setCompetitions(rows); }).catch(() => {});
    void refresh();
    const forceRefresh = () => refresh(true);
    window.addEventListener("focus", forceRefresh);
    window.addEventListener("interclub:refresh-panels", forceRefresh);
    return () => {
      active = false;
      window.removeEventListener("focus", forceRefresh);
      window.removeEventListener("interclub:refresh-panels", forceRefresh);
    };
  }, []);
  if (!competitions.length) return null;
  const enteredCompetitions = competitions.filter((competition) => competition.isEntered);
  const availableCompetitionCount = competitions.filter((competition) => !competition.isEntered && competition.status === "Open").length;
  const displayedCompetitions = enteredCompetitions.length > 0
    ? enteredCompetitions
    : competitions.filter((competition) => ["Open", "In Progress"].includes(competition.status)).slice(0, 1);
  return (
    <button type="button" onClick={onOpen} className="w-full overflow-hidden rounded-lg bg-white text-left shadow-card ring-1 ring-[#e5e0e9] transition-colors hover:bg-[#fbfafd]">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 p-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#10233f] text-white"><Trophy className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-black uppercase text-[#6c5a73]">Last Man Standing</p>
            {availableCompetitionCount > 0 ? <Badge variant="cyan">{availableCompetitionCount} open to enter</Badge> : null}
          </div>
          <h2 className="mt-0.5 truncate text-base font-black text-[#25002b]">{enteredCompetitions.length > 0 ? "Your competitions" : "Competitions are open"}</h2>
        </div>
        <span className="flex items-center gap-1 text-xs font-extrabold text-[#007d68]">View all<ChevronRight className="h-4 w-4" /></span>
      </div>
      <div className="divide-y divide-[#eeeaf2] border-t border-[#eeeaf2]">
        {displayedCompetitions.map((competition) => {
          const picks = competition.panel?.picks ?? [];
          const pickOutcomes = competition.panel?.pickOutcomes ?? [];
          const pickChanged = competition.panel?.pickChanged ?? [];
          const isEliminated = competition.panel?.entrantStatus === "Eliminated";
          const deadline = competition.panel?.deadlineAt ? new Date(competition.panel.deadlineAt) : null;
          const deadlineClosed = competition.currentRound?.status !== "Open" || Boolean(deadline && Date.now() >= deadline.getTime());
          const remaining = competition.panel?.remainingLabel.match(/(\d+)\s+of\s+(\d+)/i);
          const remainingCount = Number(remaining?.[1] ?? 0);
          const entrantCount = Number(remaining?.[2] ?? 0);
          const remainingPercent = entrantCount > 0 ? Math.max(0, Math.min(100, (remainingCount / entrantCount) * 100)) : 0;
          const action = competition.isEntered
            ? picks.length > 0 ? "Change picks" : "Make picks"
            : "Enter now";
          return <div key={competition.id} className={cn("grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.3fr)_150px] sm:items-center", isEliminated ? "bg-[#faf9fb]" : "bg-white")}>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-sm font-black text-[#25002b]">{competition.name}</h3>
                {competition.panel?.entrantStatus && competition.panel.entrantStatus !== "Entered" ? <Badge variant={competition.panel.entrantStatus === "Eliminated" ? "muted" : "green"}>{competition.panel.entrantStatus}</Badge> : null}
              </div>
              <p className="mt-0.5 text-[10px] font-bold text-[#6c5a73]">{competition.panel?.roundLabel ?? competition.status}</p>
            </div>
            <div className="flex min-w-0 gap-1.5">
              {[0, 1].map((index) => {
                const outcome = pickOutcomes[index] ?? "Pending";
                const won = outcome === "Won";
                const lost = outcome === "Lost";
                const changed = Boolean(pickChanged[index]);
                return <span key={index} className={cn("flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 ring-1", won ? "bg-[#effbf5] ring-[#bdebd4]" : lost ? "bg-[#fff1f1] ring-[#f4caca]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}>
                  <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black text-white", won ? "bg-[#087d4f]" : lost ? "bg-[#b42318]" : "bg-[#10233f]")}>
                    {won ? <Check className="h-3 w-3" /> : lost ? <X className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-[11px] font-extrabold", lost ? "text-[#8f1d18]" : won ? "text-[#08633f]" : "text-[#10233f]")} aria-label={`Pick ${index + 1}: ${picks[index] || "not selected"} · ${outcome}${changed ? " · automatically changed" : ""}`}>{picks[index] || `Pick ${index + 1}`}</span>
                  {changed ? <span className="shrink-0 rounded bg-[#d8f7ef] px-1 py-0.5 text-[8px] font-black uppercase text-[#087d68]" title="Automatically changed because the original pick was not playing">Changed</span> : null}
                </span>;
              })}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
              {competition.panel ? <><div className="h-1.5 overflow-hidden rounded-full bg-[#e8e3ec]" role="progressbar" aria-label={`${competition.name} players still standing`} aria-valuemin={0} aria-valuemax={entrantCount} aria-valuenow={remainingCount}><span className="block h-full rounded-full bg-[#1b8a72]" style={{ width: `${remainingPercent}%` }} /></div><span className="text-[11px] font-black text-[#10233f]">{competition.panel.remainingLabel}</span></> : <span className="col-span-2 text-right text-[11px] font-extrabold text-[#007d68]">{action}</span>}
              {!isEliminated && deadline ? <span className="col-span-2 flex items-center justify-end gap-1 text-[9px] font-bold text-[#6c5a73]"><Clock3 className="h-3 w-3" /> {deadlineClosed ? "Selections closed" : `Closes ${deadline.toLocaleString("en-IE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</span> : null}
            </div>
          </div>;
        })}
      </div>
    </button>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-[#f7f5fa] p-2"><p className="text-[10px] font-black uppercase text-[#6c5a73]">{label}</p><p className="mt-0.5 break-words text-sm font-extrabold text-[#10233f]">{value}</p></div>;
}

function PickChangeNotice({ pick }: { pick: DisplayPick }) {
  if (!pick.wasChanged || !pick.selectedPlayerName || !pick.playerName) return null;
  return <div className="rounded-lg bg-[#eaf8f4] p-2 text-xs font-bold text-[#246050]"><div className="flex flex-wrap items-center gap-1.5"><Badge variant="cyan">Changed</Badge><span>Automatic replacement · Pick {pick.slotNumber}: {pick.selectedPlayerName} → {pick.playerName}</span></div><p className="mt-1">Changed from {pick.selectedPlayerName} because the original pick was not playing{pick.automaticReason ? ` · ${pick.automaticReason}` : "."}</p></div>;
}

function VisiblePickNames({ picks }: { picks: DisplayPick[] }) {
  return <span className="inline-flex flex-wrap items-center gap-1">{picks.map((pick, index) => <span key={pick.slotNumber} className="inline-flex items-center gap-1">{index ? <span>/</span> : null}<span>{pick.playerName}</span>{pick.wasChanged ? <Badge variant="cyan">Changed</Badge> : null}</span>)}</span>;
}

export function LastManStandingPage() {
  const [competitions, setCompetitions] = useState<Summary[]>([]);
  const [expandedId, setExpandedId] = useState("");
  const [availableOpen, setAvailableOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [playerIds, setPlayerIds] = useState<[string, string]>(["", ""]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshSummaries(force = false) {
    if (!competitions.length) setLoadingSummaries(true);
    try {
      const rows = await loadSummaries(force);
      setCompetitions(rows);
      return rows;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Last Man Standing could not be loaded.");
      return [];
    } finally {
      setLoadingSummaries(false);
    }
  }

  async function loadCompetitionDetail(competitionId: string, force = false) {
    if (!force && detail?.competition.id === competitionId) return detail;
    setDetailLoadingId(competitionId);
    try {
      const response = await fetch(apiPath(`/api/last-man-standing/${competitionId}`), { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Competition could not be loaded.");
      const nextDetail = data as Detail;
      setDetail(nextDetail);
      const option = data.entry ? `${data.entry.tier}:${data.entry.sourceTeamId}` : data.defaultEntryOption ? `${data.defaultEntryOption.tier}:${data.defaultEntryOption.teamId}` : "";
      setSelectedOption(option);
      setPlayerIds([
        data.picks?.find((pick: Detail["picks"][number]) => pick.slotNumber === 1)?.playerId ?? "",
        data.picks?.find((pick: Detail["picks"][number]) => pick.slotNumber === 2)?.playerId ?? ""
      ]);
      return nextDetail;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Competition could not be loaded.");
      return null;
    } finally {
      setDetailLoadingId("");
    }
  }

  async function toggleCompetition(competitionId: string) {
    if (expandedId === competitionId) {
      setExpandedId("");
      return;
    }
    setExpandedId(competitionId);
    setMessage("");
    await loadCompetitionDetail(competitionId);
  }

  useEffect(() => { void refreshSummaries(); }, []);

  const enteredCompetitions = competitions.filter((competition) => competition.isEntered);
  const availableCompetitions = competitions.filter((competition) => !competition.isEntered && competition.status === "Open");

  const ownStanding = detail?.entries.find((entry) => entry.id === detail.entry?.id);
  const deadline = ownStanding?.deadlineAt ? new Date(ownStanding.deadlineAt) : null;
  const locked = Boolean(deadline && Date.now() >= deadline.getTime()) || Boolean(detail?.currentRound && detail.currentRound.status !== "Open");
  const isTerminalEntry = detail?.entry?.status === "Eliminated" || detail?.entry?.status === "Winner";
  const candidatesByTeam = useMemo(() => {
    const groups = new Map<string, Candidate[]>();
    for (const candidate of detail?.candidates ?? []) groups.set(candidate.teamName, [...(groups.get(candidate.teamName) ?? []), candidate]);
    return Array.from(groups.entries());
  }, [detail?.candidates]);

  async function enter() {
    if (!detail || !selectedOption) return;
    const [tier, sourceTeamId] = selectedOption.split(":");
    setSaving(true);
    const response = await fetch(apiPath(`/api/last-man-standing/${detail.competition.id}/entries`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier, sourceTeamId }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "Entry could not be created.");
    setMessage("You are entered.");
    const competitionId = detail.competition.id;
    const [rows] = await Promise.all([
      loadSummaries(true),
      loadCompetitionDetail(competitionId, true)
    ]);
    setCompetitions(rows);
    setAvailableOpen(false);
    setExpandedId(competitionId);
  }

  async function savePicks() {
    if (!detail?.currentRound || !playerIds[0] || !playerIds[1]) return setMessage("Choose two players.");
    setSaving(true);
    const versions: [number | null, number | null] = [1, 2].map((slot) => detail.picks.find((pick) => pick.slotNumber === slot)?.version ?? null) as [number | null, number | null];
    const response = await fetch(apiPath(`/api/last-man-standing/${detail.competition.id}/picks`), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ roundId: detail.currentRound.id, playerIds, versions }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "Picks could not be saved.");
    setMessage("Your picks are saved. You can change them until noon on match day.");
    const competitionId = detail.competition.id;
    const [rows] = await Promise.all([
      loadSummaries(true),
      loadCompetitionDetail(competitionId, true)
    ]);
    setCompetitions(rows);
  }

  if (loadingSummaries && !competitions.length) return <Card><CardContent className="p-5 text-sm font-bold text-[#6c5a73]">Loading Last Man Standing...</CardContent></Card>;
  if (!competitions.length) return <Card><CardHeader><CardTitle>Last Man Standing</CardTitle></CardHeader><CardContent><p className="text-sm font-bold text-[#6c5a73]">{message || "No competition is currently available."}</p></CardContent></Card>;

  const detailContent = detail ? <div className="grid gap-3 border-t border-[#eeeaf2] bg-[#fbfafd] p-3 sm:p-4">
      <div className="grid gap-2 rounded-lg bg-white p-3 shadow-card sm:grid-cols-3">
        <PanelStat label="Your run" value={detail.entry ? `${detail.progress.roundsPlayed} ${detail.progress.roundsPlayed === 1 ? "round" : "rounds"}${detail.currentRound ? ` · Reached round ${detail.currentRound.roundNumber}` : ""}` : "Not entered"} />
        <PanelStat label="Players left" value={`${detail.progress.standingCount} of ${detail.progress.entrantCount}`} />
        <PanelStat label="Winner" value={detail.progress.winnerName ?? (detail.competition.status === "No Winner" ? "No winner" : "Not decided")} />
      </div>
      {!detail.entry ? <div className="grid gap-3 rounded-lg bg-white p-4 shadow-card"><div><h3 className="font-black text-[#25002b]">Enter competition</h3><p className="text-sm font-semibold text-[#6c5a73]">Your player role is used before any manager role.</p></div>{detail.entryOptions.length ? <><select className="min-h-11 rounded-lg border px-3 text-sm font-bold" value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>{detail.entryOptions.map((option) => <option key={`${option.tier}:${option.teamId}`} value={`${option.tier}:${option.teamId}`}>{option.tier} pool · {option.teamName} · {option.sourceRole}</option>)}</select><Button disabled={saving} onClick={enter}>Enter competition</Button></> : <p className="text-sm font-bold text-[#6c5a73]">You need an active player or manager team role to enter.</p>}</div> : null}
      {detail.entry && detail.currentRound && !isTerminalEntry ? <div className="grid gap-4 rounded-lg bg-white p-4 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-[#25002b]">Your picks</h3><p className="text-sm font-semibold text-[#6c5a73]">Choose two different players you have not used in this cycle.</p></div>{deadline ? <Badge variant={locked ? "muted" : "cyan"}><Clock3 className="mr-1 h-3 w-3" />{locked ? "Selections closed" : `Deadline ${deadline.toLocaleString("en-IE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</Badge> : null}</div><div className="grid gap-3 lg:grid-cols-2"><PlayerSelect label="Choose first player" value={playerIds[0]} otherValue={playerIds[1]} groups={candidatesByTeam} disabled={locked} onChange={(value) => setPlayerIds([value, playerIds[1]])} /><PlayerSelect label="Choose second player" value={playerIds[1]} otherValue={playerIds[0]} groups={candidatesByTeam} disabled={locked} onChange={(value) => setPlayerIds([playerIds[0], value])} /></div>{detail.picks.map((pick) => <PickChangeNotice key={pick.id} pick={pick} />)}<Button disabled={locked || saving || !playerIds[0] || !playerIds[1] || playerIds[0] === playerIds[1]} onClick={savePicks}>{saving ? "Saving..." : detail.picks.length ? "Change picks" : "Save picks"}</Button></div> : null}
      {isTerminalEntry && detail.picks.length ? <div className="grid gap-3 rounded-lg bg-white p-4 shadow-card"><div><h3 className="font-black text-[#25002b]">{detail.entry?.status === "Winner" ? "Winning picks" : "Elimination round"}</h3><p className="text-sm font-semibold text-[#6c5a73]">{detail.currentRound?.name}</p></div><div className="grid gap-2 sm:grid-cols-2">{detail.picks.map((pick) => <div key={pick.id} className={cn("flex items-center justify-between gap-2 rounded-lg p-3 ring-1", pick.outcome === "Won" ? "bg-[#effbf5] ring-[#bdebd4]" : pick.outcome === "Lost" ? "bg-[#fff1f1] ring-[#f4caca]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}><span className="min-w-0 truncate text-sm font-extrabold text-[#10233f]">{pick.playerName}</span><Badge variant={pick.outcome === "Won" ? "green" : "muted"}>{pick.outcome}</Badge></div>)}</div></div> : null}
      <div className="rounded-lg bg-white p-4 shadow-card"><h3 className="flex items-center gap-2 font-black text-[#25002b]"><Users className="h-5 w-5" /> Contestants</h3><div className="mt-3 divide-y">{detail.entries.map((entry) => <div key={entry.id} className={cn("flex items-center justify-between gap-3 py-3", entry.status === "Eliminated" ? "opacity-60" : "")}><div><p className="text-sm font-extrabold">{entry.personName}</p><div className="flex flex-wrap items-center gap-1 text-xs font-bold text-[#6c5a73]"><span>{entry.sourceTeamName}</span>{entry.picksHidden ? <span>· Picks hidden until deadline</span> : entry.picks.length ? <><span>·</span><VisiblePickNames picks={entry.picks} /></> : <span>· No picks yet</span>}</div></div>{entry.status !== "Entered" ? <Badge variant={entry.status === "Eliminated" || entry.status === "Withdrawn" ? "muted" : "green"}>{entry.status}</Badge> : null}</div>)}</div></div>
      {detail.history.length ? <details className="rounded-lg bg-white p-4 shadow-card"><summary className="flex cursor-pointer list-none items-center justify-between font-black text-[#25002b]">History <ChevronDown className="h-5 w-5" /></summary><div className="mt-3 grid gap-2">{detail.history.map((pick, index) => <div key={`${pick.roundName}-${pick.slotNumber}-${index}`} className="grid gap-2 rounded-lg bg-[#f7f5fa] p-3 text-sm"><p className="font-extrabold">{pick.roundName} · Pick {pick.slotNumber}: {pick.playerName}{pick.wasChanged ? <Badge variant="cyan" className="ml-2">Changed</Badge> : null}</p><p className="text-xs font-bold text-[#6c5a73]">{pick.state}{pick.automaticReason ? ` · Automatic: ${pick.automaticReason}` : ""} · {pick.outcome}</p><PickChangeNotice pick={pick} /></div>)}</div></details> : null}
    </div> : null;

  return <section className="grid gap-3">
    <div className="rounded-lg bg-[#10233f] p-4 text-white shadow-card"><p className="text-xs font-black uppercase text-white/65">League competition</p><h2 className="text-2xl font-black">Last Man Standing</h2></div>
    {message ? <p className="rounded-lg bg-[#00ff85]/20 p-3 text-sm font-bold text-[#174936]">{message}</p> : null}
    {enteredCompetitions.map((competition) => {
      const expanded = expandedId === competition.id;
      return <div key={competition.id} className="overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-[#e5e0e9]">
        <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={expanded} onClick={() => void toggleCompetition(competition.id)}>
          <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate font-black text-[#25002b]">{competition.name}</span>{competition.panel?.entrantStatus && competition.panel.entrantStatus !== "Entered" ? <Badge variant={competition.panel.entrantStatus === "Eliminated" ? "muted" : "green"}>{competition.panel.entrantStatus}</Badge> : null}</span><span className="mt-1 block text-xs font-bold text-[#6c5a73]">{competition.panel?.roundLabel ?? competition.status}{competition.panel?.picks.length ? ` · ${competition.panel.picks.join(" / ")}` : " · Picks not selected"}</span></span>
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-[#6c5a73] transition-transform", expanded ? "rotate-180" : "")} />
        </button>
        {expanded ? detailLoadingId === competition.id ? <p className="border-t border-[#eeeaf2] p-4 text-sm font-bold text-[#6c5a73]">Loading competition...</p> : detail?.competition.id === competition.id ? detailContent : null : null}
      </div>;
    })}
    {availableCompetitions.length ? <div className="overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-[#a7ead1]">
      <button type="button" className="flex w-full items-center justify-between gap-3 bg-[#effbf5] p-4 text-left" aria-expanded={availableOpen} onClick={() => setAvailableOpen((open) => !open)}>
        <span><span className="flex items-center gap-2 font-black text-[#174936]">Available competitions <Badge variant="cyan">{availableCompetitions.length}</Badge></span><span className="mt-1 block text-xs font-bold text-[#39705e]">Choose another competition to enter</span></span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-[#087d4f] transition-transform", availableOpen ? "rotate-180" : "")} />
      </button>
      {availableOpen ? <div className="divide-y divide-[#eeeaf2] border-t border-[#ccefe1]">{availableCompetitions.map((competition) => {
        const expanded = expandedId === competition.id;
        return <div key={competition.id}>
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={expanded} onClick={() => void toggleCompetition(competition.id)}><span><span className="block text-sm font-black text-[#25002b]">{competition.name}</span><span className="mt-0.5 block text-xs font-bold text-[#6c5a73]">Open for entry</span></span><span className="flex items-center gap-1 text-xs font-black text-[#007d68]">Enter <ChevronRight className={cn("h-4 w-4 transition-transform", expanded ? "rotate-90" : "")} /></span></button>
          {expanded ? detailLoadingId === competition.id ? <p className="border-t border-[#eeeaf2] p-4 text-sm font-bold text-[#6c5a73]">Loading competition...</p> : detail?.competition.id === competition.id ? detailContent : null : null}
        </div>;
      })}</div> : null}
    </div> : null}
    {!enteredCompetitions.length && !availableCompetitions.length ? <Card><CardContent className="p-5 text-sm font-bold text-[#6c5a73]">No competition is currently available.</CardContent></Card> : null}
  </section>;
}

function PlayerSelect({ label, value, otherValue, groups, disabled, onChange }: { label: string; value: string; otherValue: string; groups: Array<[string, Candidate[]]>; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-black uppercase text-[#6c5a73]">{label}<select className="min-h-12 w-full rounded-lg border bg-white px-3 text-sm font-bold normal-case text-[#10233f]" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">Select player</option>{groups.map(([teamName, candidates]) => <optgroup key={teamName} label={teamName}>{candidates.map((candidate) => { const unavailable = candidate.used || candidate.id === otherValue || !candidate.hasFixture; const reason = candidate.used ? "Already picked" : candidate.id === otherValue ? "Already selected" : !candidate.hasFixture ? "No fixture this round" : ""; return <option key={candidate.id} value={candidate.id} disabled={unavailable}>{candidate.name}{reason ? ` — ${reason}` : ""}</option>; })}</optgroup>)}</select></label>;
}
