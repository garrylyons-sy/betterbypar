"use client";

import { ChevronDown, ChevronUp, Clock3, Plus, RefreshCw, Save, ShieldAlert, Trash2, Trophy } from "lucide-react";
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
type Team = { id: string; name: string; season_id: string; league_name: FixtureWeek["league_name"] };
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
  audience_team_id: string | null;
  audience_team_name: string | null;
  status: string;
  season_id: string;
  season_name: string;
  entrant_count: number;
  standing_count: number;
  entry_opens_at: string;
  entry_closes_at: string;
  processing_time: string;
  rounds: Round[];
  events: Array<{ id: string; eventType: string; createdAt: string; payload: Record<string, unknown> }>;
  unresolved_picks: Array<{
    id: string;
    entryId: string;
    roundId: string;
    slotNumber: number;
    entrantName: string;
    tier: string;
    reason: string | null;
    candidates: Array<{ id: string; name: string; teamName: string }>;
  }>;
  entries: Array<{
    id: string;
    name: string;
    status: string;
    tier: string;
    teamName: string;
    picks: Array<{ roundName: string; slotNumber: number; playerName: string; state: string; outcome: string; reason: string | null }>;
  }>;
};
export function AdminLastManStanding({ onMessage }: { onMessage: (message: string) => void }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fixtureWeeks, setFixtureWeeks] = useState<FixtureWeek[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedCompetitionId, setExpandedCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [league, setLeague] = useState<FixtureWeek["league_name"]>("A League");
  const [firstRoundWeekId, setFirstRoundWeekId] = useState("");
  const [processingTime, setProcessingTime] = useState("19:30");
  const [audience, setAudience] = useState<"League Chair" | "Team" | "Everyone">("Team");
  const [audienceTeamId, setAudienceTeamId] = useState("");
  const [processingTimes, setProcessingTimes] = useState<Record<string, string>>({});
  const [audiences, setAudiences] = useState<Record<string, "League Chair" | "Team" | "Everyone">>({});
  const [audienceTeamIds, setAudienceTeamIds] = useState<Record<string, string>>({});
  const [resolutionPlayers, setResolutionPlayers] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/last-man-standing", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load Last Man Standing.");
      setCompetitions(data.competitions ?? []);
      setSeasons(data.seasons ?? []);
      setFixtureWeeks(data.fixtureWeeks ?? []);
      setTeams(data.teams ?? []);
      setProcessingTimes(Object.fromEntries((data.competitions ?? []).map((competition: Competition) => [
        competition.id,
        competition.processing_time?.slice(0, 5) || "19:30"
      ])));
      setAudiences(Object.fromEntries((data.competitions ?? []).map((competition: Competition) => [competition.id, competition.audience])));
      setAudienceTeamIds(Object.fromEntries((data.competitions ?? []).map((competition: Competition) => [competition.id, competition.audience_team_id ?? ""])));
      setSeasonId((current) => current || data.seasons?.find((season: Season) => season.active)?.id || data.seasons?.[0]?.id || "");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not load Last Man Standing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const availableWeeks = useMemo(
    () => fixtureWeeks.filter((week) => week.season_id === seasonId && week.league_name === league),
    [fixtureWeeks, league, seasonId]
  );
  const availableTeams = useMemo(
    () => teams.filter((team) => team.season_id === seasonId && team.league_name === league),
    [league, seasonId, teams]
  );

  async function createCompetition() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/last-man-standing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, seasonId, league, firstRoundWeekId, processingTime, audience, audienceTeamId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Competition could not be created.");
      setShowCreate(false);
      setName("");
      setFirstRoundWeekId("");
      setProcessingTime("19:30");
      setAudience("Team");
      setAudienceTeamId("");
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

  async function saveProcessingTime(competition: Competition) {
    const value = processingTimes[competition.id] || "19:30";
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ processingTime: value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Processing time could not be saved.");
    onMessage(`${competition.name} will process picks from ${value} on match day.`);
    await load();
  }

  async function saveAudience(competition: Competition) {
    const selectedAudience = audiences[competition.id] ?? "League Chair";
    const selectedTeamId = audienceTeamIds[competition.id] ?? "";
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audience: selectedAudience, audienceTeamId: selectedTeamId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Competition audience could not be saved.");
    onMessage(`${competition.name} audience updated.`);
    await load();
  }

  async function deleteCompetition(competition: Competition) {
    if (!window.confirm(`Permanently delete ${competition.name} and all of its entries, picks and rounds?`)) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Competition could not be deleted.");
    setExpandedCompetitionId(null);
    onMessage(`${competition.name} deleted.`);
    await load();
  }

  async function startNextCycle(competition: Competition) {
    if (!window.confirm(`Start a fresh cycle for ${competition.name} using the next fixture week?`)) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}/new-cycle`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "The next cycle could not be started.");
    onMessage(`A fresh cycle has started for ${competition.name}.`);
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

  async function resolvePick(competition: Competition, pickId: string) {
    const playerId = resolutionPlayers[pickId];
    if (!playerId) return onMessage("Choose a published player for the unresolved pick.");
    const reason = window.prompt("Why are you overriding this pick?")?.trim();
    if (!reason) return;
    const response = await fetch(`/api/admin/last-man-standing/${competition.id}/override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pickId, playerId, reason })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Pick could not be resolved.");
    onMessage("Last Man Standing pick resolved.");
    await load();
  }

  return (
    <section className="grid self-start content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-card">
        <div>
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">League competition</p>
          <h2 className="text-xl font-extrabold text-[#25002b]">Last Man Standing</h2>
        </div>
        <Button onClick={() => setShowCreate((current) => !current)}><Plus className="h-4 w-4" /> New competition</Button>
      </div>

      {showCreate ? (
        <div className="grid gap-2 rounded-lg bg-white p-3 shadow-card">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Name<input className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Season<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={seasonId} onChange={(event) => { setSeasonId(event.target.value); setFirstRoundWeekId(""); setAudienceTeamId(""); }}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">League<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={league} onChange={(event) => { setLeague(event.target.value as FixtureWeek["league_name"]); setFirstRoundWeekId(""); setAudienceTeamId(""); }}><option>A League</option><option>B League</option><option>C League</option></select></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">First round<select className="min-h-11 rounded-lg border px-2 text-sm normal-case text-[#25002b]" value={firstRoundWeekId} onChange={(event) => setFirstRoundWeekId(event.target.value)}><option value="">Choose week</option>{availableWeeks.map((week) => <option key={week.id} value={week.id}>{week.week_label} · {new Date(`${week.match_date}T12:00:00`).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Audience<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={audience} onChange={(event) => { setAudience(event.target.value as typeof audience); setAudienceTeamId(""); }}><option value="Team">Selected team</option><option value="Everyone">Everyone</option><option value="League Chair">League Chairs</option></select></label>
            {audience === "Team" ? <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Team<select className="min-h-11 rounded-lg border px-3 text-sm normal-case text-[#25002b]" value={audienceTeamId} onChange={(event) => setAudienceTeamId(event.target.value)}><option value="">Choose team</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : null}
            <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Processing time<input type="time" className="min-h-11 rounded-lg border px-2 text-sm normal-case text-[#25002b]" value={processingTime} onChange={(event) => setProcessingTime(event.target.value)} /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-[#6c5a73]">Entries close at noon on the first match day. Later rounds follow the next valid {league} week.</p><Button disabled={saving || !name.trim() || !seasonId || !firstRoundWeekId || (audience === "Team" && !audienceTeamId)} onClick={createCompetition}>{saving ? "Creating..." : "Create competition"}</Button></div>
        </div>
      ) : null}

      {loading ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73]">Loading competitions...</p> : null}
      {!loading && !competitions.length ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73]">No Last Man Standing competitions yet.</p> : null}
      {competitions.map((competition) => {
        const expanded = expandedCompetitionId === competition.id;
        const needsReview = competition.rounds.some((round) => round.status === "Needs Review");
        return <article key={competition.id} className="overflow-hidden rounded-lg bg-white shadow-card">
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setExpandedCompetitionId(expanded ? null : competition.id)}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Trophy className="h-5 w-5 text-[#00a873]" /><h3 className="truncate font-extrabold">{competition.name}</h3><Badge variant="cyan">{competition.status}</Badge>{needsReview ? <Badge variant="gold"><ShieldAlert className="h-3 w-3" /> Needs Review</Badge> : null}</div><p className="mt-1 text-xs font-bold text-[#6c5a73]">{competition.season_name} · {competition.rounds[0]?.schedules.length === 1 ? `${competition.rounds[0].schedules[0].tier} League · ` : ""}{competition.audience === "Team" ? competition.audience_team_name : competition.audience === "Everyone" ? "Everyone" : "League Chairs"} · {competition.standing_count} of {competition.entrant_count} standing</p></div>
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {expanded ? <div className="grid gap-3 border-t p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Processing time</span><input type="time" className="h-9 rounded-lg border px-2 text-sm normal-case text-[#25002b]" value={processingTimes[competition.id] || "19:30"} onChange={(event) => setProcessingTimes((current) => ({ ...current, [competition.id]: event.target.value }))} /></label>
              <Button size="sm" variant="secondary" onClick={() => saveProcessingTime(competition)}><Save className="h-4 w-4" /> Save time</Button>
              {competition.status === "Draft" ? <Button size="sm" variant="secondary" onClick={() => changeStatus(competition, "Open")}>Open entries</Button> : null}
              {competition.status === "No Winner" ? <Button size="sm" variant="secondary" onClick={() => startNextCycle(competition)}>Start next cycle</Button> : null}
              <Button size="sm" variant="secondary" className="text-red-700" onClick={() => deleteCompetition(competition)}><Trash2 className="h-4 w-4" /> Delete competition</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f7f5fa] p-2">
              <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Audience<select className="h-9 rounded-lg border bg-white px-2 text-sm normal-case text-[#25002b]" value={audiences[competition.id] ?? "League Chair"} onChange={(event) => { const value = event.target.value as "League Chair" | "Team" | "Everyone"; setAudiences((current) => ({ ...current, [competition.id]: value })); if (value !== "Team") setAudienceTeamIds((current) => ({ ...current, [competition.id]: "" })); }}><option value="Team">Selected team</option><option value="Everyone">Everyone</option><option value="League Chair">League Chairs</option></select></label>
              {(audiences[competition.id] ?? competition.audience) === "Team" ? <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Team<select className="h-9 min-w-44 rounded-lg border bg-white px-2 text-sm normal-case text-[#25002b]" value={audienceTeamIds[competition.id] ?? ""} onChange={(event) => setAudienceTeamIds((current) => ({ ...current, [competition.id]: event.target.value }))}><option value="">Choose team</option>{teams.filter((team) => team.season_id === competition.season_id && team.league_name === `${competition.rounds[0]?.schedules[0]?.tier} League`).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : null}
              <Button size="sm" variant="secondary" disabled={(audiences[competition.id] ?? competition.audience) === "Team" && !audienceTeamIds[competition.id]} onClick={() => saveAudience(competition)}><Save className="h-4 w-4" /> Save audience</Button>
            </div>
            <p className="text-xs font-semibold text-[#6c5a73]">Selections close at noon. Published lineups are checked automatically from this time on each team&apos;s match day.</p>
            <div className="grid gap-1">{competition.rounds.filter((round) => round.status !== "Settled").map((round) => <div key={round.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f7f5fa] px-3 py-2"><div><p className="text-sm font-extrabold">Cycle {round.cycleNumber} · {round.name}</p><p className="text-xs font-bold text-[#6c5a73]">{round.schedules.map((schedule) => `${schedule.tier}: ${schedule.weekLabel}`).join(" · ")}</p></div><Badge variant={round.status === "Needs Review" ? "gold" : "muted"}>{round.status}</Badge></div>)}</div>
            {competition.rounds.some((round) => round.status === "Settled") ? <details className="rounded-md border px-3 py-2"><summary className="cursor-pointer text-sm font-extrabold">Completed rounds · {competition.rounds.filter((round) => round.status === "Settled").length}</summary><div className="mt-2 grid gap-1">{competition.rounds.filter((round) => round.status === "Settled").map((round) => <div key={round.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0"><div><p className="text-sm font-extrabold">Cycle {round.cycleNumber} · {round.name}</p><p className="text-xs font-bold text-[#6c5a73]">{round.schedules.map((schedule) => `${schedule.tier}: ${schedule.weekLabel}`).join(" · ")}</p></div><Button size="sm" variant="secondary" onClick={() => reopenRound(competition, round)}>Reopen</Button></div>)}</div></details> : null}
            {competition.unresolved_picks?.length ? <div className="grid gap-2"><p className="text-xs font-extrabold uppercase text-[#6c5a73]">Unresolved picks</p>{competition.unresolved_picks.map((pick) => <div key={pick.id} className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-[1fr_minmax(220px,1fr)_auto] sm:items-end"><div><p className="text-sm font-extrabold">{pick.entrantName} · Pick {pick.slotNumber}</p><p className="text-xs font-bold text-[#6c5a73]">{pick.reason || "No eligible automatic player was found."}</p></div><label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">Replacement<select className="min-h-10 rounded-lg border bg-white px-2 text-sm normal-case text-[#25002b]" value={resolutionPlayers[pick.id] ?? ""} onChange={(event) => setResolutionPlayers((current) => ({ ...current, [pick.id]: event.target.value }))}><option value="">Choose player</option>{pick.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.teamName}</option>)}</select></label><Button size="sm" onClick={() => resolvePick(competition, pick.id)}>Resolve pick</Button></div>)}</div> : null}
            {competition.entries?.length ? <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-extrabold">Entrants and picks · {competition.entries.length}</summary><div className="mt-3 grid gap-2">{competition.entries.map((entry) => <div key={entry.id} className="rounded-lg bg-[#f7f5fa] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold">{entry.name} · {entry.teamName}</p><Badge variant={entry.status === "Eliminated" ? "muted" : "green"}>{entry.status}</Badge></div><p className="mt-1 text-xs font-bold text-[#6c5a73]">{entry.tier} pool{entry.picks.length ? ` · ${entry.picks.map((pick) => `${pick.roundName} P${pick.slotNumber}: ${pick.playerName} (${pick.state}, ${pick.outcome})`).join(" · ")}` : " · No picks"}</p></div>)}</div></details> : null}
            <details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm font-extrabold text-[#6c5a73]">Fallback tools</summary><div className="mt-2"><Button size="sm" variant="secondary" onClick={() => processCompetition(competition)}><RefreshCw className="h-4 w-4" /> Process now</Button></div></details>
            {competition.events.length ? <div><p className="mb-2 text-xs font-extrabold uppercase text-[#6c5a73]">Recent activity</p><div className="grid gap-1">{competition.events.slice(0, 8).map((event) => <p key={event.id} className="text-xs font-semibold text-[#6c5a73]">{new Date(event.createdAt).toLocaleString("en-IE")} · {event.eventType}</p>)}</div></div> : null}
          </div> : null}
        </article>;
      })}
    </section>
  );
}
