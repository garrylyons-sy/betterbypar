"use client";

import { Check, ChevronDown, ChevronRight, Clock3, ShieldCheck, Trophy, Users, X } from "lucide-react";
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
  panel: { roundLabel: string; picks: string[]; pickOutcomes: string[]; entrantStatus: string; remainingLabel: string; deadlineAt: string | null } | null;
};
type Candidate = { id: string; name: string; teamName: string; used: boolean; hasFixture: boolean };
type Detail = {
  competition: { id: string; name: string; status: string; entryOpensAt: string; entryClosesAt: string };
  entryOptions: Array<{ tier: string; sourceRole: string; teamId: string; teamName: string }>;
  defaultEntryOption: { tier: string; sourceRole: string; teamId: string; teamName: string } | null;
  entry: { id: string; status: string; tier: string; sourceTeamId: string } | null;
  currentRound: { id: string; name: string; cycleNumber: number; roundNumber: number; status: string } | null;
  candidates: Candidate[];
  picks: Array<{ id: string; slotNumber: number; playerId: string | null; playerName: string | null; state: string; automaticReason: string | null; outcome: string; deadlineAt: string | null; version: number }>;
  entries: Array<{ id: string; personName: string; status: string; sourceTeamName: string; deadlineAt: string; picks: Array<{ slotNumber: number; playerName: string; state: string; outcome: string }>; picksHidden: boolean }>;
  history: Array<{ roundName: string; slotNumber: number; playerName: string; state: string; outcome: string; automaticReason: string | null }>;
};

function apiPath(path: string) {
  if (typeof window === "undefined") return path;
  const testUser = new URLSearchParams(window.location.search).get("testUser")?.trim();
  return testUser ? `${path}${path.includes("?") ? "&" : "?"}testUser=${encodeURIComponent(testUser)}` : path;
}

async function loadSummaries() {
  const response = await fetch(apiPath("/api/last-man-standing"), { credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Last Man Standing could not be loaded.");
  return (data.competitions ?? []) as Summary[];
}

export function LastManStandingHomePanel({ onOpen }: { onOpen: () => void }) {
  const [competitions, setCompetitions] = useState<Summary[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => loadSummaries().then((rows) => { if (active) setCompetitions(rows); }).catch(() => {});
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("interclub:refresh-panels", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("interclub:refresh-panels", refresh);
    };
  }, []);
  if (!competitions.length) return null;
  const enteredCompetitions = competitions.filter((competition) => competition.isEntered);
  const availableCompetitionCount = competitions.filter((competition) => !competition.isEntered && competition.status === "Open").length;
  const enteredCompetitionCountLabel = enteredCompetitions.length === 1 ? "1 entered" : `${enteredCompetitions.length} entered`;
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
            {enteredCompetitions.length > 0 ? <Badge variant="cyan">{enteredCompetitionCountLabel}</Badge> : null}
            {availableCompetitionCount > 0 ? <Badge variant="muted">{availableCompetitionCount} available</Badge> : null}
          </div>
          <h2 className="mt-0.5 truncate text-base font-black text-[#25002b]">{enteredCompetitions.length > 0 ? "Your competitions" : "Competitions are open"}</h2>
        </div>
        <span className="flex items-center gap-1 text-xs font-extrabold text-[#007d68]">View all<ChevronRight className="h-4 w-4" /></span>
      </div>
      <div className="divide-y divide-[#eeeaf2] border-t border-[#eeeaf2]">
        {displayedCompetitions.map((competition) => {
          const picks = competition.panel?.picks ?? [];
          const pickOutcomes = competition.panel?.pickOutcomes ?? [];
          const isEliminated = competition.panel?.entrantStatus === "Eliminated";
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
                {competition.panel?.entrantStatus ? <Badge variant={competition.panel.entrantStatus === "Eliminated" ? "muted" : "green"}>{competition.panel.entrantStatus}</Badge> : null}
              </div>
              <p className="mt-0.5 text-[10px] font-bold text-[#6c5a73]">{competition.panel?.roundLabel ?? competition.status}</p>
            </div>
            <div className="flex min-w-0 gap-1.5">
              {[0, 1].map((index) => {
                const outcome = pickOutcomes[index] ?? "Pending";
                const won = outcome === "Won";
                const lost = outcome === "Lost";
                return <span key={index} className={cn("flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 ring-1", won ? "bg-[#effbf5] ring-[#bdebd4]" : lost ? "bg-[#fff1f1] ring-[#f4caca]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}>
                  <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black text-white", won ? "bg-[#087d4f]" : lost ? "bg-[#b42318]" : "bg-[#10233f]")}>
                    {won ? <Check className="h-3 w-3" /> : lost ? <X className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className={cn("min-w-0 truncate text-[11px] font-extrabold", lost ? "text-[#8f1d18]" : won ? "text-[#08633f]" : "text-[#10233f]")} aria-label={`Pick ${index + 1}: ${picks[index] || "not selected"} · ${outcome}`}>{picks[index] || `Pick ${index + 1}`}</span>
                </span>;
              })}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
              {competition.panel ? <><div className="h-1.5 overflow-hidden rounded-full bg-[#e8e3ec]" role="progressbar" aria-label={`${competition.name} players still standing`} aria-valuemin={0} aria-valuemax={entrantCount} aria-valuenow={remainingCount}><span className="block h-full rounded-full bg-[#1b8a72]" style={{ width: `${remainingPercent}%` }} /></div><span className="text-[11px] font-black text-[#10233f]">{competition.panel.remainingLabel}</span></> : <span className="col-span-2 text-right text-[11px] font-extrabold text-[#007d68]">{action}</span>}
              {!isEliminated && competition.panel?.deadlineAt ? <span className="col-span-2 flex items-center justify-end gap-1 text-[9px] font-bold text-[#6c5a73]"><Clock3 className="h-3 w-3" /> Closes {new Date(competition.panel.deadlineAt).toLocaleString("en-IE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
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

export function LastManStandingPage() {
  const [competitions, setCompetitions] = useState<Summary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [playerIds, setPlayerIds] = useState<[string, string]>(["", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh(preferredId?: string) {
    setLoading(true);
    try {
      const rows = await loadSummaries();
      setCompetitions(rows);
      const nextId = preferredId || selectedId || rows[0]?.id || "";
      setSelectedId(nextId);
      if (!nextId) return setDetail(null);
      const response = await fetch(apiPath(`/api/last-man-standing/${nextId}`), { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Competition could not be loaded.");
      setDetail(data);
      const option = data.entry ? `${data.entry.tier}:${data.entry.sourceTeamId}` : data.defaultEntryOption ? `${data.defaultEntryOption.tier}:${data.defaultEntryOption.teamId}` : "";
      setSelectedOption(option);
      setPlayerIds([
        data.picks?.find((pick: Detail["picks"][number]) => pick.slotNumber === 1)?.playerId ?? "",
        data.picks?.find((pick: Detail["picks"][number]) => pick.slotNumber === 2)?.playerId ?? ""
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Last Man Standing could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const ownStanding = detail?.entries.find((entry) => entry.id === detail.entry?.id);
  const deadline = ownStanding?.deadlineAt ? new Date(ownStanding.deadlineAt) : null;
  const locked = Boolean(deadline && Date.now() >= deadline.getTime()) || Boolean(detail?.currentRound && detail.currentRound.status !== "Open");
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
    await refresh(detail.competition.id);
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
    await refresh(detail.competition.id);
  }

  if (loading && !detail) return <Card><CardContent className="p-5 text-sm font-bold text-[#6c5a73]">Loading Last Man Standing...</CardContent></Card>;
  if (!competitions.length) return <Card><CardHeader><CardTitle>Last Man Standing</CardTitle></CardHeader><CardContent><p className="text-sm font-bold text-[#6c5a73]">{message || "No competition is currently available."}</p></CardContent></Card>;

  return <section className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#10233f] p-4 text-white shadow-card"><div><p className="text-xs font-black uppercase text-white/65">League competition</p><h2 className="text-2xl font-black">Last Man Standing</h2></div>{competitions.length > 1 ? <label className="grid gap-1 text-xs font-bold uppercase text-white/70">Competition<select className="min-h-10 rounded-lg bg-white px-3 text-sm normal-case text-[#25002b]" value={selectedId} onChange={(event) => void refresh(event.target.value)}>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label> : null}</div>
    {message ? <p className="rounded-lg bg-[#00ff85]/20 p-3 text-sm font-bold text-[#174936]">{message}</p> : null}
    {detail ? <>
      <div className="grid gap-3 rounded-lg bg-white p-4 shadow-card sm:grid-cols-3"><PanelStat label="Round" value={detail.currentRound ? `Cycle ${detail.currentRound.cycleNumber} · Round ${detail.currentRound.roundNumber}` : "Not started"} /><PanelStat label="Your status" value={detail.entry?.status ?? "Not entered"} /><PanelStat label="Players left" value={`${detail.entries.filter((entry) => ["Entered", "Standing", "Winner"].includes(entry.status)).length} of ${detail.entries.length}`} /></div>
      {!detail.entry ? <div className="grid gap-3 rounded-lg bg-white p-4 shadow-card"><div><h3 className="font-black text-[#25002b]">Enter competition</h3><p className="text-sm font-semibold text-[#6c5a73]">Your player role is used before any manager role.</p></div>{detail.entryOptions.length ? <><select className="min-h-11 rounded-lg border px-3 text-sm font-bold" value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>{detail.entryOptions.map((option) => <option key={`${option.tier}:${option.teamId}`} value={`${option.tier}:${option.teamId}`}>{option.tier} pool · {option.teamName} · {option.sourceRole}</option>)}</select><Button disabled={saving} onClick={enter}>Enter competition</Button></> : <p className="text-sm font-bold text-[#6c5a73]">You need an active player or manager team role to enter.</p>}</div> : null}
      {detail.entry && detail.currentRound ? <div className="grid gap-4 rounded-lg bg-white p-4 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-[#25002b]">Your picks</h3><p className="text-sm font-semibold text-[#6c5a73]">Choose two different players you have not used in this cycle.</p></div>{deadline ? <Badge variant={locked ? "muted" : "cyan"}><Clock3 className="mr-1 h-3 w-3" />{locked ? "Selections closed" : `Deadline ${deadline.toLocaleString("en-IE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</Badge> : null}</div><div className="grid gap-3 lg:grid-cols-2"><PlayerSelect label="Choose first player" value={playerIds[0]} otherValue={playerIds[1]} groups={candidatesByTeam} disabled={locked} onChange={(value) => setPlayerIds([value, playerIds[1]])} /><PlayerSelect label="Choose second player" value={playerIds[1]} otherValue={playerIds[0]} groups={candidatesByTeam} disabled={locked} onChange={(value) => setPlayerIds([playerIds[0], value])} /></div>{detail.picks.filter((pick) => pick.state === "Automatic").map((pick) => <p key={pick.id} className="rounded-lg bg-[#eaf8f4] p-2 text-xs font-bold text-[#246050]">Automatic replacement · Pick {pick.slotNumber}: {pick.playerName}{pick.automaticReason ? ` · ${pick.automaticReason}` : ""}</p>)}<Button disabled={locked || saving || !playerIds[0] || !playerIds[1] || playerIds[0] === playerIds[1]} onClick={savePicks}>{saving ? "Saving..." : detail.picks.length ? "Change picks" : "Save picks"}</Button></div> : null}
      <div className="rounded-lg bg-white p-4 shadow-card"><h3 className="flex items-center gap-2 font-black text-[#25002b]"><Users className="h-5 w-5" /> Still standing</h3><div className="mt-3 divide-y">{detail.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-extrabold">{entry.personName}</p><p className="text-xs font-bold text-[#6c5a73]">{entry.sourceTeamName}{entry.picksHidden ? " · Picks hidden until deadline" : entry.picks.length ? ` · ${entry.picks.map((pick) => pick.playerName).join(" / ")}` : " · No picks yet"}</p></div><Badge variant={["Eliminated", "Withdrawn"].includes(entry.status) ? "muted" : "green"}>{entry.status}</Badge></div>)}</div></div>
      {detail.history.length ? <details className="rounded-lg bg-white p-4 shadow-card"><summary className="flex cursor-pointer list-none items-center justify-between font-black text-[#25002b]">History <ChevronDown className="h-5 w-5" /></summary><div className="mt-3 grid gap-2">{detail.history.map((pick, index) => <div key={`${pick.roundName}-${pick.slotNumber}-${index}`} className="rounded-lg bg-[#f7f5fa] p-3 text-sm"><p className="font-extrabold">{pick.roundName} · Pick {pick.slotNumber}: {pick.playerName}</p><p className="text-xs font-bold text-[#6c5a73]">{pick.state}{pick.automaticReason ? ` · Automatic: ${pick.automaticReason}` : ""} · {pick.outcome}</p></div>)}</div></details> : null}
    </> : null}
  </section>;
}

function PlayerSelect({ label, value, otherValue, groups, disabled, onChange }: { label: string; value: string; otherValue: string; groups: Array<[string, Candidate[]]>; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-black uppercase text-[#6c5a73]">{label}<select className="min-h-12 w-full rounded-lg border bg-white px-3 text-sm font-bold normal-case text-[#10233f]" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">Select player</option>{groups.map(([teamName, candidates]) => <optgroup key={teamName} label={teamName}>{candidates.map((candidate) => { const unavailable = candidate.used || candidate.id === otherValue || !candidate.hasFixture; const reason = candidate.used ? "Already picked" : candidate.id === otherValue ? "Already selected" : !candidate.hasFixture ? "No fixture this round" : ""; return <option key={candidate.id} value={candidate.id} disabled={unavailable}>{candidate.name}{reason ? ` — ${reason}` : ""}</option>; })}</optgroup>)}</select></label>;
}
