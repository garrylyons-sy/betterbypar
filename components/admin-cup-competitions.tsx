"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Shuffle, Trash2, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cupRoundDateError } from "@/lib/cup-round-dates.mjs";

type CupAudience = "All Players" | "All Managers" | "Specific Leagues" | "League Chairs";
type CupTeam = { id: string; name: string; season_id: string; season_name: string; league_id: string; league_name: string; club_name: string };
type CupLeague = { id: string; name: string };
type CupRound = {
  id: string;
  round_number: number;
  name: string;
  fixture_date: string;
  ties: Array<{
    id: string;
    match_number: number;
    home_team_name: string | null;
    away_team_name: string | null;
    home_source_match_number: number | null;
    away_source_match_number: number | null;
    fixture_id: string | null;
    winner_team_name: string | null;
    status: string;
    home_team_score: number | null;
    away_team_score: number | null;
  }>;
};
type CupCompetition = {
  id: string;
  season_id: string;
  name: string;
  round_count: number;
  status: "Draft" | "In Progress" | "Complete";
  audience: CupAudience;
  visibilityLeagueIds: string[];
  format: Array<{ slot_number: number; game_type: "Singles" | "Doubles" }>;
  entries: Array<{ team_id: string; team_name: string }>;
  rounds: CupRound[];
};
type CupData = {
  competitions: CupCompetition[];
  seasons: Array<{ id: string; name: string }>;
  teams: CupTeam[];
  leagues: CupLeague[];
};

function roundName(roundNumber: number, totalRounds: number) {
  const teamCount = 2 ** (totalRounds - roundNumber + 1);
  if (teamCount === 2) return "Final";
  if (teamCount === 4) return "Semi Final";
  if (teamCount === 8) return "Quarter Final";
  return `Round of ${teamCount}`;
}

function sourceLabel(round: CupRound, matchNumber: number | null) {
  return matchNumber ? `Winner of round ${round.round_number - 1}, match ${matchNumber}` : "To be decided";
}

function nextThursday(offsetWeeks: number) {
  const date = new Date();
  const days = (4 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + days + offsetWeeks * 7);
  return date.toISOString().slice(0, 10);
}

export function AdminCupCompetitions({ onMessage }: { onMessage: (message: string) => void }) {
  const [data, setData] = useState<CupData>({ competitions: [], seasons: [], teams: [], leagues: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openCompetitionId, setOpenCompetitionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CupCompetition | null>(null);
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [roundCount, setRoundCount] = useState(3);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<CupAudience>("All Players");
  const [visibilityLeagueIds, setVisibilityLeagueIds] = useState<string[]>([]);
  const [format, setFormat] = useState<Array<"Singles" | "Doubles">>(["Doubles", "Doubles", "Doubles", "Doubles", "Doubles"]);
  const [roundDates, setRoundDates] = useState([nextThursday(0), nextThursday(1), nextThursday(2)]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/cup-competitions", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Cup competitions unavailable.");
      setData(body);
      setSeasonId((current) => current || body.seasons?.[0]?.id || "");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Cup competitions unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setRoundDates((current) => Array.from({ length: roundCount }, (_, index) => current[index] ?? nextThursday(index)));
    setTeamIds([]);
  }, [roundCount, seasonId]);

  const availableTeams = useMemo(() => data.teams.filter((team) => team.season_id === seasonId), [data.teams, seasonId]);
  const capacity = 2 ** roundCount;
  const validTeamCount = teamIds.length >= 2 && teamIds.length <= capacity && (roundCount === 1 || teamIds.length > capacity / 2);
  const roundDatesError = cupRoundDateError(roundDates, roundCount);

  async function createCompetition() {
    if (roundDatesError) {
      onMessage(roundDatesError);
      return;
    }
    if (!name.trim() || !validTeamCount || format.length % 2 === 0) {
      onMessage("Add a name, an odd match format, valid round dates and enough teams for the selected number of rounds.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/cup-competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, seasonId, roundCount, teamIds, roundDates, audience, visibilityLeagueIds, format: format.map((gameType) => ({ gameType })) })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create cup competition.");
      setData(body);
      setName("");
      setTeamIds([]);
      setShowCreate(false);
      setOpenCompetitionId(body.competitionId);
      onMessage("Cup competition created. Perform the draw when the setup is ready.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not create cup competition.");
    } finally {
      setBusy(false);
    }
  }

  async function performDraw(competitionId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/cup-competitions/${competitionId}/draw`, { method: "POST", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not perform cup draw.");
      onMessage("Draw completed. First-round fixtures are now in the calendar.");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not perform cup draw.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompetition() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/cup-competitions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ competitionId: deleteTarget.id })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not delete cup competition.");
      setData(body);
      setOpenCompetitionId(null);
      setDeleteTarget(null);
      onMessage("Cup competition, fixtures and recorded match data deleted.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not delete cup competition.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Interclub knockout</p>
            <CardTitle>Cup Competitions</CardTitle>
          </div>
          <Button onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> New cup</Button>
        </CardHeader>
        {showCreate ? (
          <CardContent className="grid gap-4 border-t border-[#ebe6ef] pt-4">
            <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
              <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">Competition name<input className="rounded-lg border border-[#ded7e5] bg-white px-3 py-2 text-sm font-bold normal-case text-[#10233f]" value={name} onChange={(event) => setName(event.target.value)} placeholder="Interclub Cup" /></label>
              <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">Season<select className="rounded-lg border border-[#ded7e5] bg-white px-3 py-2 text-sm font-bold normal-case text-[#10233f]" value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">Rounds<select className="rounded-lg border border-[#ded7e5] bg-white px-3 py-2 text-sm font-bold normal-case text-[#10233f]" value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} ({2 ** count} team draw)</option>)}</select></label>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-[#25002b]">Visibility</h3><Badge variant="muted">{audience}</Badge></div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,260px)_1fr]">
                <select className="rounded-lg border border-[#ded7e5] bg-white px-3 py-2 text-sm font-bold text-[#10233f]" value={audience} onChange={(event) => { setAudience(event.target.value as CupAudience); if (event.target.value !== "Specific Leagues") setVisibilityLeagueIds([]); }}>
                  <option>All Players</option><option>All Managers</option><option>Specific Leagues</option><option>League Chairs</option>
                </select>
                {audience === "Specific Leagues" ? <LeagueVisibilityChoices leagues={data.leagues} selected={visibilityLeagueIds} onChange={setVisibilityLeagueIds} /> : <p className="self-center text-xs font-semibold text-[#6c5a73]">Only signed-in people with the selected role will see this cup in the normal app.</p>}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-[#25002b]">Match format</h3><Badge variant={format.length % 2 ? "green" : "muted"}>{format.length} matches</Badge></div>
              <div className="flex flex-wrap gap-2">
                {format.map((gameType, index) => (
                  <div key={`${index}-${gameType}`} className="flex items-center gap-1 rounded-lg bg-[#f1edf4] px-2 py-1.5 text-xs font-extrabold text-[#25002b]">
                    <span>{index + 1}. {gameType}</span>
                    <button type="button" aria-label={`Remove match ${index + 1}`} onClick={() => setFormat((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button type="button" className="rounded-lg border border-[#ded7e5] px-2 py-1.5 text-xs font-extrabold" onClick={() => setFormat((rows) => [...rows, "Singles"])}>+ Singles</button>
                <button type="button" className="rounded-lg border border-[#ded7e5] px-2 py-1.5 text-xs font-extrabold" onClick={() => setFormat((rows) => [...rows, "Doubles"])}>+ Doubles</button>
              </div>
              <p className="mt-1 text-xs font-semibold text-[#6c5a73]">Use an odd number of matches so every tie produces a winner. Each match is worth one point.</p>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-[#25002b]">Round dates</h3><Badge variant="muted">19:30 start</Badge></div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {roundDates.map((date, index) => <label key={index} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-lg bg-[#f7f5fa] p-2 text-xs font-extrabold text-[#6c5a73]"><span>{roundName(index + 1, roundCount)}</span><input type="date" min={index > 0 ? roundDates[index - 1] : undefined} aria-invalid={Boolean(roundDatesError)} className="min-w-0 rounded-md border border-[#ded7e5] bg-white px-2 py-1.5 text-[#10233f]" value={date} onChange={(event) => setRoundDates((dates) => dates.map((item, rowIndex) => rowIndex === index ? event.target.value : item))} /></label>)}
              </div>
              {roundDatesError ? <p className="mt-2 text-xs font-bold text-[#b42318]">{roundDatesError}</p> : null}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-[#25002b]">Teams</h3><Badge variant={validTeamCount ? "green" : "muted"}>{teamIds.length} / {capacity}</Badge></div>
              <div className="grid max-h-60 gap-1 overflow-auto rounded-lg border border-[#ebe6ef] p-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableTeams.map((team) => <label key={team.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-[#10233f] hover:bg-[#f7f5fa]"><input type="checkbox" checked={teamIds.includes(team.id)} onChange={() => setTeamIds((ids) => ids.includes(team.id) ? ids.filter((id) => id !== team.id) : [...ids, team.id])} /><span className="truncate">{team.name}</span><span className="ml-auto text-xs text-[#6c5a73]">{team.league_name}</span></label>)}
              </div>
            </section>
            <div className="flex justify-end"><Button disabled={busy} onClick={() => void createCompetition()}>{busy ? "Creating..." : "Create competition"}</Button></div>
          </CardContent>
        ) : null}
      </Card>

      {loading ? <Card><CardContent className="p-4 text-sm font-semibold text-[#6c5a73]">Loading cup competitions...</CardContent></Card> : null}
      {data.competitions.map((competition) => {
        const open = openCompetitionId === competition.id;
        return (
          <Card key={competition.id}>
            <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenCompetitionId(open ? null : competition.id)}>
              <Trophy className="h-5 w-5 text-[#168f72]" />
              <span className="min-w-0 flex-1"><span className="block truncate font-black text-[#10233f]">{competition.name}</span><span className="block text-xs font-semibold text-[#6c5a73]">{competition.entries.length} teams · {competition.round_count} rounds · {competition.format.map((row) => row.game_type[0]).join(" · ")} · {competition.audience}</span></span>
              <Badge variant={competition.status === "Complete" ? "green" : competition.status === "Draft" ? "muted" : "cyan"}>{competition.status}</Badge>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {open ? (
              <CardContent className="grid gap-3 border-t border-[#ebe6ef] pt-4">
                <CupVisibilityEditor competition={competition} leagues={data.leagues} onMessage={onMessage} onSaved={load} />
                {competition.status === "Draft" ? <div className="flex items-center justify-between rounded-lg bg-[#f7f5fa] p-3"><span className="text-sm font-semibold text-[#6c5a73]">Ready to randomise the selected teams and create the first fixtures.</span><Button disabled={busy} onClick={() => void performDraw(competition.id)}><Shuffle className="h-4 w-4" /> Perform Draw</Button></div> : null}
                <div className="grid gap-3 xl:grid-cols-3">
                  {competition.rounds.map((round) => (
                    <section key={round.id} className="rounded-lg border border-[#ebe6ef] p-3">
                      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-[#25002b]">{round.name}</h3><span className="text-xs font-bold text-[#6c5a73]">{new Date(`${round.fixture_date}T12:00:00`).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span></div>
                      <div className="grid gap-2">
                        {round.ties.length ? round.ties.map((tie) => <div key={tie.id} className="rounded-md bg-[#f7f5fa] p-2 text-xs font-bold text-[#10233f]"><div className="flex justify-between gap-2"><span className="truncate">{tie.home_team_name ?? sourceLabel(round, tie.home_source_match_number)}</span><span>{tie.home_team_score ?? ""}</span></div><div className="flex justify-between gap-2"><span className="truncate">{tie.away_team_name ?? sourceLabel(round, tie.away_source_match_number)}</span><span>{tie.away_team_score ?? ""}</span></div>{tie.winner_team_name ? <p className="mt-1 text-[#168f72]">Winner: {tie.winner_team_name}</p> : null}</div>) : <p className="text-xs font-semibold text-[#6c5a73]">Draw not performed.</p>}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="flex justify-end border-t border-[#ebe6ef] pt-3">
                  <Button variant="secondary" size="sm" className="text-[#b42318]" onClick={() => setDeleteTarget(competition)}>
                    <Trash2 className="h-4 w-4" /> Delete competition
                  </Button>
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Delete cup competition">
          <div className="w-full max-w-md rounded-[18px] bg-white p-4 shadow-elevated ring-1 ring-[#eeeaf2]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#6c5a73]">Confirm delete</p>
                <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#10233f]">{deleteTarget.name}</h2>
              </div>
              <Badge variant="muted">{deleteTarget.status}</Badge>
            </div>
            <p className="mt-3 rounded-xl bg-[#fff3f3] p-3 text-sm font-semibold text-[#6c5a73] ring-1 ring-[#f3b7b2]">
              This permanently removes the cup, its draw, rounds, fixtures, lineups, results, breaks and live-scoring data. This cannot be undone.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void deleteCompetition()} disabled={busy} className="bg-[#b42318] hover:bg-[#8f1d14]">
                <Trash2 className="h-4 w-4" /> {busy ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LeagueVisibilityChoices({ leagues, selected, onChange }: { leagues: CupLeague[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <div className="flex flex-wrap gap-2">{leagues.map((league) => <label key={league.id} className="flex items-center gap-2 rounded-lg bg-[#f7f5fa] px-3 py-2 text-xs font-extrabold text-[#10233f]"><input type="checkbox" checked={selected.includes(league.id)} onChange={() => onChange(selected.includes(league.id) ? selected.filter((id) => id !== league.id) : [...selected, league.id])} />{league.name}</label>)}</div>;
}

function CupVisibilityEditor({ competition, leagues, onMessage, onSaved }: { competition: CupCompetition; leagues: CupLeague[]; onMessage: (message: string) => void; onSaved: () => Promise<void> }) {
  const [audience, setAudience] = useState<CupAudience>(competition.audience);
  const [leagueIds, setLeagueIds] = useState<string[]>(competition.visibilityLeagueIds ?? []);
  const [busy, setBusy] = useState(false);
  const changed = audience !== competition.audience || [...leagueIds].sort().join(",") !== [...(competition.visibilityLeagueIds ?? [])].sort().join(",");

  async function save() {
    if (audience === "Specific Leagues" && !leagueIds.length) return onMessage("Choose at least one visible league.");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/cup-competitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ competitionId: competition.id, audience, visibilityLeagueIds: leagueIds })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not update visibility.");
      onMessage("Cup visibility updated.");
      await onSaved();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update visibility.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid gap-2 rounded-lg bg-[#f7f5fa] p-3 md:grid-cols-[minmax(0,230px)_1fr_auto] md:items-center"><label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">Visible to<select className="rounded-lg border border-[#ded7e5] bg-white px-3 py-2 text-sm font-bold normal-case text-[#10233f]" value={audience} onChange={(event) => { setAudience(event.target.value as CupAudience); if (event.target.value !== "Specific Leagues") setLeagueIds([]); }}><option>All Players</option><option>All Managers</option><option>Specific Leagues</option><option>League Chairs</option></select></label>{audience === "Specific Leagues" ? <LeagueVisibilityChoices leagues={leagues} selected={leagueIds} onChange={setLeagueIds} /> : <p className="text-xs font-semibold text-[#6c5a73]">Visibility is checked from each person&apos;s active platform roles.</p>}<Button size="sm" disabled={!changed || busy} onClick={() => void save()}>{busy ? "Saving..." : "Save visibility"}</Button></section>;
}
