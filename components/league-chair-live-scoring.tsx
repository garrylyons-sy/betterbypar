"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pause, Play, Radio, RotateCcw, Undo2, WifiOff, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Side = "home" | "away";
type SaveState = "Saved" | "Saving" | "Offline" | "Conflict";

type LiveFrameState = {
  homeScore: number;
  awayScore: number;
  activeTeam: Side;
  activePlayerId: string | null;
  currentBreak: number;
  redsRemaining: number;
  phase: "reds" | "colours" | "respotted-black";
  expectedBall: "red" | "colour" | number | null;
  coloursRemaining: number[];
  status: "Live" | "Ready";
  winner: Side | null;
  history: unknown[];
};

type LiveSession = {
  id: string;
  game_id: string;
  status: "Live" | "Paused" | "Completed" | "Abandoned";
  state: LiveFrameState;
  version: number;
  scorer_person_id: string | null;
  scorer_name: string | null;
  lease_expires_at: string | null;
  canControl: boolean;
  canTakeOver: boolean;
};

type LiveGame = {
  id: string;
  game_number: number;
  game_type: string;
  home_score: number;
  away_score: number;
  winner_team_id: string | null;
  home_player_1_id: string | null;
  home_player_1_name: string | null;
  home_player_1_guest_name: string | null;
  home_player_2_id: string | null;
  home_player_2_name: string | null;
  home_player_2_guest_name: string | null;
  away_player_1_id: string | null;
  away_player_1_name: string | null;
  away_player_1_guest_name: string | null;
  away_player_2_id: string | null;
  away_player_2_name: string | null;
  away_player_2_guest_name: string | null;
};

type LiveFixturePayload = {
  fixture: {
    id: string;
    status: string;
    fixture_date: string;
    league_name: string;
    home_team_id: string;
    home_team_name: string;
    away_team_id: string;
    away_team_name: string;
    home_team_score: number;
    away_team_score: number;
  };
  games: LiveGame[];
  sessions: LiveSession[];
};

type LiveAction = Record<string, unknown> & {
  action: string;
  fixtureId?: string;
  gameId?: string;
  sessionId?: string;
  version?: number;
};

const colourStyles: Record<number, string> = {
  2: "bg-[#f4d000]",
  3: "bg-[#159447]",
  4: "bg-[#8b572a]",
  5: "bg-[#2382d9]",
  6: "bg-[#ef71a7]",
  7: "bg-[#111827]"
};

const colourNames: Record<number, string> = {
  1: "Red",
  2: "Yellow",
  3: "Green",
  4: "Brown",
  5: "Blue",
  6: "Pink",
  7: "Black"
};

function playersFor(game: LiveGame, side: Side) {
  const player = (slot: 1 | 2) => {
    const personId = game[`${side}_player_${slot}_id`];
    const guestName = game[`${side}_player_${slot}_guest_name`];
    const guestKey = guestName?.trim() ? `guest:${side}:${slot}` : null;
    return {
      id: personId ?? guestKey,
      name: game[`${side}_player_${slot}_name`] ?? guestName
    };
  };
  return [player(1), player(2)].filter((item): item is { id: string; name: string | null } => Boolean(item.id));
}

function playerNames(game: LiveGame, side: Side) {
  const names = playersFor(game, side).map((player) => player.name).filter(Boolean);
  return names.length ? names.join(" / ") : "Lineup not published";
}

function statusTone(status: SaveState) {
  if (status === "Saved") return "green" as const;
  if (status === "Saving") return "cyan" as const;
  return "muted" as const;
}

function framePointsRemaining(state: LiveFrameState) {
  if (state.phase === "reds") {
    return state.redsRemaining * 8 + 27 + (state.expectedBall === "colour" ? 7 : 0);
  }
  return state.coloursRemaining.reduce((total, value) => total + value, 0);
}

function frameSnookersRequired(state: LiveFrameState) {
  const deficit = Math.abs(state.homeScore - state.awayScore) - framePointsRemaining(state);
  return deficit > 0 ? Math.ceil(deficit / 4) : 0;
}

export function LeagueChairMatchControls({
  fixtureId,
  onDataRefresh
}: {
  fixtureId: string;
  onDataRefresh?: () => void;
}) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [payload, setPayload] = useState<LiveFixturePayload | null>(null);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const busyRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/league-chair/live-scoring?fixtureId=${encodeURIComponent(fixtureId)}`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "League Chair scoring is unavailable.");
      setPayload(data);
      setMessage("");
      if (navigator.onLine) setSaveState("Saved");
    } catch (error) {
      setSaveState("Offline");
      if (!quiet) setMessage(error instanceof Error ? error.message : "League Chair scoring is unavailable.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    if (!controlsOpen) return;
    void load();
  }, [controlsOpen, load]);

  useEffect(() => {
    if (!(controlsOpen && selectedGameId)) return;
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine && !busyRef.current) void load(true);
    };
    const online = () => {
      setSaveState("Saved");
      poll();
    };
    const offline = () => setSaveState("Offline");
    const pollId = window.setInterval(poll, 2000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [controlsOpen, load, selectedGameId]);

  const send = useCallback(async (action: LiveAction) => {
    if (!navigator.onLine) {
      setSaveState("Offline");
      return null;
    }
    busyRef.current = true;
    setSaveState("Saving");
    setMessage("");
    try {
      const response = await fetch("/api/league-chair/live-scoring", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...action, fixtureId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          setSaveState("Conflict");
          await load(true);
        } else {
          setSaveState(navigator.onLine ? "Saved" : "Offline");
        }
        throw new Error(data.error || "The score could not be saved.");
      }
      setPayload(data);
      setSaveState("Saved");
      onDataRefresh?.();
      return data as LiveFixturePayload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The score could not be saved.");
      return null;
    } finally {
      busyRef.current = false;
    }
  }, [fixtureId, load, onDataRefresh]);

  const openLiveScoring = async (game: LiveGame) => {
    const existing = payload?.sessions.find((session) => session.game_id === game.id && !["Completed", "Abandoned"].includes(session.status));
    setSelectedGameId(game.id);
    if (existing) return;
    const next = await send({ action: "start", gameId: game.id, activeTeam: "home" });
    if (!next) setSelectedGameId("");
  };

  const selectedGame = payload?.games.find((game) => game.id === selectedGameId) ?? null;
  const selectedSession = payload?.sessions.find((session) => session.game_id === selectedGameId && !["Completed", "Abandoned"].includes(session.status)) ?? null;

  return (
    <section className="rounded-lg border border-[#d8d3df] bg-white text-[#10233f]">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"
        aria-expanded={controlsOpen}
        onClick={() => setControlsOpen((open) => !open)}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-black">
          <Radio className="h-4 w-4 shrink-0 text-[#1b8a72]" />
          League Chair scoring
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", controlsOpen && "rotate-180")} />
      </button>

      {controlsOpen ? (
        <div className="grid gap-3 border-t border-[#eeeaf2] p-3">
          {loading ? <p className="text-sm font-bold text-[#6c5a73]">Loading score controls...</p> : null}
          {payload && !payload.games.length ? (
            <p className="rounded-lg bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">
              Team lineups must be published before frame scoring is available.
            </p>
          ) : null}
          {payload?.games.map((game) => {
            const session = payload.sessions.find((item) => item.game_id === game.id && !["Abandoned"].includes(item.status));
            const decided = Boolean(game.winner_team_id);
            return (
              <div key={game.id} className="grid gap-2 border-b border-[#eeeaf2] pb-3 last:border-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Game {game.game_number} · {game.game_type}</p>
                    {session ? <Badge variant={session.status === "Completed" ? "green" : "cyan"}>{session.status}</Badge> : null}
                  </div>
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-black">
                    <span>{playerNames(game, "home")}</span>
                    <span className="text-[#6c5a73]">v</span>
                    <span className="text-right">{playerNames(game, "away")}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={game.winner_team_id === payload.fixture.home_team_id ? "default" : "secondary"}
                    aria-label={`Record home win for game ${game.game_number}`}
                    disabled={saveState === "Saving" || Boolean(session && session.status !== "Completed")}
                    onClick={() => void send({ action: "recordResult", gameId: game.id, winnerTeamId: payload.fixture.home_team_id })}
                  >
                    Home
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!game.winner_team_id ? "outline" : "secondary"}
                    aria-label={`Reset game ${game.game_number} to undecided`}
                    disabled={saveState === "Saving" || Boolean(session && session.status !== "Completed")}
                    onClick={() => void send({ action: "recordResult", gameId: game.id, winnerTeamId: null })}
                  >
                    Undecided
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={game.winner_team_id === payload.fixture.away_team_id ? "default" : "secondary"}
                    aria-label={`Record away win for game ${game.game_number}`}
                    disabled={saveState === "Saving" || Boolean(session && session.status !== "Completed")}
                    onClick={() => void send({ action: "recordResult", gameId: game.id, winnerTeamId: payload.fixture.away_team_id })}
                  >
                    Away
                  </Button>
                  {!decided || (session && session.status !== "Completed") ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="dark"
                      className="col-span-3"
                      onClick={() => void openLiveScoring(game)}
                    >
                      <Radio className="h-4 w-4" />
                      {session ? "Open live scoring" : "Start live scoring"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {message ? <p className="rounded-lg bg-[#fff8eb] p-2 text-sm font-bold text-[#8a5a00]">{message}</p> : null}
        </div>
      ) : null}

      {selectedGame && selectedSession && payload ? (
        <LiveFrameScorer
          payload={payload}
          game={selectedGame}
          session={selectedSession}
          saveState={saveState}
          message={message}
          onAction={send}
          onClose={() => setSelectedGameId("")}
        />
      ) : null}
    </section>
  );
}

export function LiveFrameScorer({
  payload,
  game,
  session,
  saveState,
  message,
  onAction,
  onClose
}: {
  payload: LiveFixturePayload;
  game: LiveGame;
  session: LiveSession;
  saveState: SaveState;
  message: string;
  onAction: (action: LiveAction) => Promise<LiveFixturePayload | null>;
  onClose: () => void;
}) {
  const state = session.state;
  const [showFoul, setShowFoul] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctedReds, setCorrectedReds] = useState(state.redsRemaining);
  const [correctedPhase, setCorrectedPhase] = useState(state.phase);
  const [correctedColours, setCorrectedColours] = useState(state.coloursRemaining);
  const activePlayers = useMemo(() => playersFor(game, state.activeTeam), [game, state.activeTeam]);
  const otherSide: Side = state.activeTeam === "home" ? "away" : "home";
  const controlsDisabled = saveState === "Saving" || saveState === "Offline" || !session.canControl;
  const scoringDisabled = controlsDisabled || session.status === "Paused";
  const allowedValues = state.expectedBall === "red"
    ? [1]
    : state.expectedBall === "colour"
      ? [2, 3, 4, 5, 6, 7]
      : typeof state.expectedBall === "number"
        ? [state.expectedBall]
        : [];

  const act = (action: LiveAction) => onAction({
    ...action,
    sessionId: session.id,
    version: session.version
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f7f5fa]" role="dialog" aria-modal="true" aria-label={`Live score game ${game.game_number}`}>
      <header className="shrink-0 bg-[#10233f] px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] text-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase text-white/65">Game {game.game_number} · Live frame</p>
            <p className="truncate text-sm font-black">{payload.fixture.home_team_name} v {payload.fixture.away_team_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={statusTone(saveState)}>
              {saveState === "Offline" ? <WifiOff className="mr-1 h-3 w-3" /> : saveState === "Saved" ? <Check className="mr-1 h-3 w-3" /> : null}
              {saveState}
            </Badge>
            <Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose} aria-label="Close live scoring">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto grid w-full max-w-3xl gap-3">
          <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-[#eeeaf2]">
            <div className={cn("min-w-0", state.activeTeam === "home" && "text-[#007a45]")}>
              <p className="truncate text-xs font-extrabold uppercase text-[#6c5a73]">{payload.fixture.home_team_name}</p>
              <p className="text-4xl font-black tabular-nums">{state.homeScore}</p>
            </div>
            <span className="text-sm font-black text-[#6c5a73]">v</span>
            <div className={cn("min-w-0 text-right", state.activeTeam === "away" && "text-[#007a45]")}>
              <p className="truncate text-xs font-extrabold uppercase text-[#6c5a73]">{payload.fixture.away_team_name}</p>
              <p className="text-4xl font-black tabular-nums">{state.awayScore}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
              <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Current break</p>
              <p className="text-2xl font-black tabular-nums">{state.currentBreak}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-right ring-1 ring-[#eeeaf2]">
              <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Reds left</p>
              <p className="text-2xl font-black tabular-nums">{state.redsRemaining}</p>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
              <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Points left</p>
              <p className="text-2xl font-black tabular-nums">{framePointsRemaining(state)}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-right ring-1 ring-[#eeeaf2]">
              <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Snookers needed</p>
              <p className="text-2xl font-black tabular-nums">{frameSnookersRequired(state)}</p>
            </div>
          </div>

          <div className="relative min-h-36 overflow-hidden rounded-lg border-[6px] border-[#6f4625] bg-[#087a43] p-3 shadow-inner">
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: state.redsRemaining }, (_, index) => (
                <span key={`red-${index}`} className="h-4 w-4 rounded-full bg-[#d2202f] shadow-sm ring-1 ring-black/20" aria-label="Red ball" />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-center gap-3">
              {[2, 3, 4, 5, 6, 7].filter((value) => state.phase === "reds" || state.coloursRemaining.includes(value)).map((value) => (
                <span key={value} className={cn("h-5 w-5 rounded-full shadow-sm ring-1 ring-black/25", colourStyles[value])} title={colourNames[value]} />
              ))}
            </div>
          </div>

          {!session.canControl ? (
            <div className="grid gap-2 rounded-lg bg-[#fff8eb] p-3 ring-1 ring-[#ffb00055]">
              <p className="text-sm font-bold text-[#8a5a00]">
                {session.scorer_name ? `${session.scorer_name} has the scoring controls.` : "Another League Chair has the scoring controls."}
              </p>
              {session.canTakeOver ? (
                <Button type="button" variant="dark" onClick={() => void act({ action: "takeover" })}>Take over scoring</Button>
              ) : null}
            </div>
          ) : null}

          {session.canControl ? (
            <>
              <div className="grid gap-2 rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-[#6c5a73]">At table</p>
                    <p className="text-sm font-black">{state.activeTeam === "home" ? payload.fixture.home_team_name : payload.fixture.away_team_name}</p>
                  </div>
                  <Badge variant="cyan">{state.expectedBall === null ? "Frame decided" : typeof state.expectedBall === "number" ? colourNames[state.expectedBall] : state.expectedBall}</Badge>
                </div>
                {activePlayers.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activePlayers.map((player) => (
                      <Button
                        key={player.id}
                        type="button"
                        size="sm"
                        variant={state.activePlayerId === player.id ? "default" : "secondary"}
                        disabled={scoringDisabled}
                        onClick={() => void act({ action: "selectPlayer", team: state.activeTeam, playerId: player.id })}
                      >
                        {player.name || "Selected player"}
                      </Button>
                    ))}
                  </div>
                ) : <p className="text-sm font-bold text-[#6c5a73]">No player is assigned to this side.</p>}
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={scoringDisabled || !allowedValues.includes(value) || !state.activePlayerId || state.status === "Ready"}
                    onClick={() => void act({ action: "pot", team: state.activeTeam, playerId: state.activePlayerId, value })}
                    className={cn(
                      "grid aspect-square min-h-14 place-items-center rounded-full text-lg font-black shadow-sm ring-2 ring-white transition-transform active:scale-95 disabled:opacity-25",
                      value === 1 ? "bg-[#d2202f] text-white" : colourStyles[value],
                      value === 7 ? "text-white" : "text-[#10233f]"
                    )}
                    aria-label={`Pot ${colourNames[value]}`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="secondary" disabled={scoringDisabled || !state.history.length} onClick={() => void act({ action: "undo" })}>
                  <Undo2 className="h-4 w-4" /> Undo
                </Button>
                <Button type="button" variant="secondary" disabled={scoringDisabled || state.status === "Ready"} onClick={() => void act({ action: "endVisit" })}>
                  End visit
                </Button>
                <Button type="button" variant="secondary" disabled={scoringDisabled || state.status === "Ready"} onClick={() => setShowFoul((open) => !open)}>
                  Foul
                </Button>
              </div>

              {showFoul ? (
                <div className="grid gap-2 rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Points to {otherSide === "home" ? payload.fixture.home_team_name : payload.fixture.away_team_name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[4, 5, 6, 7].map((points) => (
                      <Button key={points} type="button" variant="dark" disabled={scoringDisabled} onClick={() => {
                        setShowFoul(false);
                        void act({ action: "foul", awardedTo: otherSide, points });
                      }}>{points}</Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={scoringDisabled || state.status === "Ready"} onClick={() => {
                  if (window.confirm(`Concede to ${otherSide === "home" ? payload.fixture.home_team_name : payload.fixture.away_team_name}?`)) {
                    void act({ action: "concede", winner: otherSide });
                  }
                }}>Concede</Button>
                <Button type="button" variant="outline" disabled={scoringDisabled} onClick={() => {
                  setCorrectedReds(state.redsRemaining);
                  setCorrectedPhase(state.phase);
                  setCorrectedColours(state.coloursRemaining);
                  setShowCorrection((open) => !open);
                }}>Correct balls</Button>
              </div>

              {showCorrection ? (
                <div className="grid gap-3 rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">
                    Reds remaining
                    <input className="h-11 rounded-lg border border-[#d8d3df] px-3 text-base font-bold text-[#10233f]" type="number" min={0} max={15} value={correctedReds} onChange={(event) => setCorrectedReds(Number(event.target.value))} />
                  </label>
                  <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">
                    Table phase
                    <select className="h-11 rounded-lg border border-[#d8d3df] px-3 text-sm font-bold text-[#10233f]" value={correctedPhase} onChange={(event) => {
                      const phase = event.target.value as LiveFrameState["phase"];
                      setCorrectedPhase(phase);
                      if (phase === "reds") setCorrectedColours([2, 3, 4, 5, 6, 7]);
                      if (phase === "respotted-black") setCorrectedColours([7]);
                    }}>
                      <option value="reds">Reds and colours</option>
                      <option value="colours">Colour clearance</option>
                      <option value="respotted-black">Re-spotted black</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3" aria-label="Colours remaining">
                    {[2, 3, 4, 5, 6, 7].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${colourNames[value]} ${correctedColours.includes(value) ? "on table" : "potted"}`}
                        disabled={correctedPhase !== "colours"}
                        onClick={() => setCorrectedColours((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort())}
                        className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 disabled:opacity-40", colourStyles[value], correctedColours.includes(value) ? "ring-[#10233f]" : "ring-transparent opacity-30")}
                      />
                    ))}
                  </div>
                  <Button type="button" disabled={controlsDisabled} onClick={() => {
                    setShowCorrection(false);
                    void act({ action: "correctBalls", redsRemaining: correctedReds, phase: correctedPhase, coloursRemaining: correctedColours });
                  }}>Apply</Button>
                </div>
              ) : null}

              {state.homeScore === state.awayScore && state.redsRemaining === 0 && state.coloursRemaining.length === 0 && state.status !== "Ready" ? (
                <Button type="button" variant="dark" disabled={controlsDisabled} onClick={() => void act({ action: "respotBlack" })}>Re-spot black</Button>
              ) : null}

              {state.status === "Ready" ? (
                <div className="grid gap-2 rounded-lg bg-[#e9fff4] p-3 ring-1 ring-[#00a85a33]">
                  <p className="text-sm font-black text-[#007a45]">Frame ready: {state.winner === "home" ? payload.fixture.home_team_name : payload.fixture.away_team_name} wins.</p>
                  <Button type="button" disabled={controlsDisabled} onClick={() => {
                    const winnerName = state.winner === "home" ? payload.fixture.home_team_name : payload.fixture.away_team_name;
                    if (window.confirm(`Complete frame and record ${winnerName} as the winner?`)) void act({ action: "complete" });
                  }}>Complete frame</Button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 border-t border-[#d8d3df] pt-3">
                <Button type="button" variant="secondary" disabled={controlsDisabled} onClick={() => void act({ action: session.status === "Paused" ? "resume" : "pause" })}>
                  {session.status === "Paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {session.status === "Paused" ? "Resume" : "Pause"}
                </Button>
                <Button type="button" variant="outline" disabled={controlsDisabled} onClick={() => {
                  if (window.confirm("Abandon live scoring? The official frame result will not change.")) void act({ action: "abandon" });
                }}>
                  <RotateCcw className="h-4 w-4" /> Abandon
                </Button>
                <Button type="button" variant="outline" disabled={controlsDisabled} onClick={async () => {
                  const next = await act({ action: "handover" });
                  if (next) onClose();
                }}>
                  Hand over
                </Button>
              </div>
            </>
          ) : null}

          {message ? <p className="rounded-lg bg-[#fff8eb] p-3 text-sm font-bold text-[#8a5a00]">{message}</p> : null}
        </div>
      </main>
    </div>
  );
}
