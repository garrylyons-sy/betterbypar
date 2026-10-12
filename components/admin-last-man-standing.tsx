"use client";

import { ChevronDown, ChevronUp, Plus, RefreshCw, ShieldAlert, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FixtureWeek = {
  id: string;
  season_id: string;
  league_name: "A League" | "B League" | "C League";
  week_label: string;
  match_date: string;
};
type Season = { id: string; name: string; active: boolean };
type Round = {
  id: string;
  name: string;
  cycleNumber: number;
  roundNumber: number;
  status: string;
  decidingRound: boolean;
  schedules: Array<{ tier: string; weekLabel: string; defaultMatchDate: string }>;
};
type Competition = {
  id: string;
  name: string;
  audience: string;
  status: string;
  season_name: string;
  entrant_count: number;
  standing_count: number;
  entry_opens_at: string;
  entry_closes_at: string;
  rounds: Round[];
  events: Array<{ id: string; eventType: string; createdAt: string; payload: Record<string, unknown> }>;
};
type DraftRound = { name: string; decidingRound: boolean; weeks: Record<"A" | "B" | "C", string> };

const blankRound = (number: number): DraftRound => ({
  name: `Round ${number}`,
  decidingRound: false,
  weeks: { A: "", B: "", C: "" }
});

export function AdminLastManStanding({ onMessage }: { onMessage: (message: string) => void }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fixtureWeeks, setFixtureWeeks] = useState<FixtureWeek[]>([]);
  const [expandedCompetitionId, setExpandedCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [entryOpensAt, setEntryOpensAt] = useState("");
  const [entryClosesAt, setEntryClosesAt] = useState("");
  const [audience, setAudience] = useState<"League Chair" | "Everyone">("League Chair");
  const [rounds, setRounds] = useState<DraftRound[]>([blankRound(1)]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/last-man-standing", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load Last Man Standing.");
      setCompetitions(data.competitions ?? []);
      setSeasons(data.seasons ?? []);
      setFixtureWeeks(data.fixtureWeeks ?? []);
      setSeasonId((current) => current || data.seasons?.find((season: Season) => season.active)?.id || data.seasons?.[0]?.id || "");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not load Last Man Standing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const weeksByTier = useMemo(() => Object.fromEntries((["A", "B", "C"] as const).map((tier) => [
    tier,
    fixtureWeeks.filter((week) => week.season_id === seasonId && week.league_name === `${tier} League`)
  ])) as Record<"A" | "B" | "C", FixtureWeek[]>, [fixtureWeeks, seasonId]);

  function updateRound(index: number, update: Partial<DraftRound>) {
    setRounds((current) => current.map((round, roundIndex) => roundIndex === index ? { ...round, ...update } : round));
  }

  async function createCompetition() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/last-man-standing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, seasonId, audience, entryOpensAt, entryClosesAt,
          rounds: rounds.map((round) => ({
            name: round.name,
            decidingRound: round.decidingRound,
            schedules: (["A", "B", "C"] as const).map((tier) => ({ tier, fixtureWeekId: round.weeks[tier] }))
          }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Competition could not be created.");
      setShowCreate(false);
      setName("");
      setRounds([blankRound(1)]);
      onMessage("Last Man Standing competition created.");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Competition could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(competition: Competition, status: string) {
    if ((status === "Archived" || status === "Open") && !window.confirm(`${status} ${competition.name}?`)) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Competition could not be updated.");
    onMessage(`${competition.name} is now ${status.toLowerCase()}.`);
    await load();
  }

  async function processCompetition(competition: Competition) {
    if (!window.confirm(`Process due picks and results for ${competition.name}?`)) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}/process`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Competition could not be processed.");
    onMessage(`${competition.name} processed.`);
    await load();
  }

  async function reopenRound(competition: Competition, round: Round) {
    const reason = window.prompt(`Why are you reopening ${round.name}?`)?.trim();
    if (!reason) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}/reopen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roundId: round.id, reason })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Round could not be reopened.");
    onMessage(`${round.name} reopened.`);
    await load();
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-card">
        <div>
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">League competition</p>
          <h2 className="text-xl font-extrabold text-[#25002b]">Last Man Standing</h2>
        </div>
        <Button onClick={() => setShowCreate((current) => !current)}><Plus className="h-4 w-4" /> New competition</Button>
      </div>

      {showCreate ? (
        <div className="grid gap-4 rounded-lg bg-white p-4 shadow-card">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Name<input className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Season<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Entries open<input type="datetime-local" className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={entryOpensAt} onChange={(event) => setEntryOpensAt(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Entries close<input type="datetime-local" className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={entryClosesAt} onChange={(event) => setEntryClosesAt(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Audience<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option>League Chair</option><option>Everyone</option></select></label>
          </div>
          <div className="grid gap-3">
            {rounds.map((round, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-3"><input className="min-h-10 flex-1 rounded-lg border px-3 text-sm font-bold" value={round.name} onChange={(event) => updateRound(index, { name: event.target.value })} /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={round.decidingRound} onChange={(event) => updateRound(index, { decidingRound: event.target.checked })} /> Deciding round</label></div>
                <div className="grid gap-2 lg:grid-cols-3">{(["A", "B", "C"] as const).map((tier) => <label key={tier} className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">{tier} League<select className="min-h-10 rounded-lg border px-2 text-sm normal-case text-[#25002b]" value={round.weeks[tier]} onChange={(event) => updateRound(index, { weeks: { ...round.weeks, [tier]: event.target.value } })}><option value="">Choose week</option>{weeksByTier[tier].map((week) => <option key={week.id} value={week.id}>{week.week_label} · {week.match_date}</option>)}</select></label>)}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setRounds((current) => [...current, blankRound(current.length + 1)])}><Plus className="h-4 w-4" /> Add round</Button><Button disabled={saving} onClick={createCompetition}>{saving ? "Creating..." : "Create competition"}</Button></div>
        </div>
      ) : null}

      {loading ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73]">Loading competitions...</p> : null}
      {!loading && !competitions.length ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73]">No Last Man Standing competitions yet.</p> : null}
      {competitions.map((competition) => {
        const expanded = expandedCompetitionId === competition.id;
        const needsReview = competition.rounds.some((round) => round.status === "Needs Review");
        return <article key={competition.id} className="overflow-hidden rounded-lg bg-white shadow-card">
          <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setExpandedCompetitionId(expanded ? null : competition.id)}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Trophy className="h-5 w-5 text-[#00a873]" /><h3 className="truncate font-extrabold">{competition.name}</h3><Badge variant="cyan">{competition.status}</Badge>{needsReview ? <Badge variant="gold"><ShieldAlert className="h-3 w-3" /> Needs Review</Badge> : null}</div><p className="mt-1 text-xs font-bold text-[#6c5a73]">{competition.season_name} · {competition.standing_count} of {competition.entrant_count} standing · {competition.audience}</p></div>
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {expanded ? <div className="grid gap-4 border-t p-4">
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => processCompetition(competition)}><RefreshCw className="h-4 w-4" /> Process now</Button>{competition.status === "Draft" ? <Button size="sm" variant="secondary" onClick={() => changeStatus(competition, "Open")}>Open entries</Button> : null}{competition.status !== "Archived" ? <Button size="sm" variant="secondary" onClick={() => changeStatus(competition, "Archived")}>Archive</Button> : null}</div>
            <div className="grid gap-2">{competition.rounds.map((round) => <div key={round.id} className="rounded-lg bg-[#f7f5fa] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-extrabold">Cycle {round.cycleNumber} · {round.name}</p><p className="text-xs font-bold text-[#6c5a73]">{round.schedules.map((schedule) => `${schedule.tier}: ${schedule.weekLabel}`).join(" · ")}</p></div><div className="flex items-center gap-2"><Badge variant={round.status === "Needs Review" ? "gold" : "muted"}>{round.status}</Badge>{round.status === "Settled" ? <Button size="sm" variant="secondary" onClick={() => reopenRound(competition, round)}>Reopen</Button> : null}</div></div></div>)}</div>
            {competition.events.length ? <div><p className="mb-2 text-xs font-extrabold uppercase text-[#6c5a73]">Recent activity</p><div className="grid gap-1">{competition.events.slice(0, 8).map((event) => <p key={event.id} className="text-xs font-semibold text-[#6c5a73]">{new Date(event.createdAt).toLocaleString("en-IE")} · {event.eventType}</p>)}</div></div> : null}
          </div> : null}
        </article>;
      })}
    </section>
  );
}
