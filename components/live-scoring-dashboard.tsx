"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Radio, RefreshCw } from "lucide-react";

import {
  LeagueChairMatchControls,
  liveFrameStatusLabel,
  type LiveFrameState
} from "@/components/league-chair-live-scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CompactLiveStatus = {
  fixture_id: string;
  game_id: string;
  game_number: number;
  game_type: string;
  status: "Live" | "Paused";
  state: LiveFrameState;
  scorer_name: string | null;
  active_player_name: string | null;
};

type DashboardFixture = {
  id: string;
  fixture_date: string;
  status: string;
  season_name: string;
  league_name: string;
  home_team_name: string;
  away_team_name: string;
  home_team_score: number;
  away_team_score: number;
  has_live_session: boolean;
};

type DashboardPayload = {
  fixtures: DashboardFixture[];
  statuses: CompactLiveStatus[];
};

function groupStatuses(statuses: CompactLiveStatus[]) {
  return statuses.reduce<Record<string, CompactLiveStatus[]>>((grouped, status) => {
    (grouped[status.fixture_id] ??= []).push(status);
    return grouped;
  }, {});
}

async function fetchLiveStatuses(fixtureIds: string[]) {
  if (!fixtureIds.length) return [];
  const response = await fetch(
    `/api/league-chair/live-scoring/dashboard?fixtureIds=${encodeURIComponent(fixtureIds.join(","))}`,
    { credentials: "same-origin", cache: "no-store" }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Live status is unavailable.");
  return (data.statuses ?? []) as CompactLiveStatus[];
}

export function useLiveScoringStatuses(fixtureIds: string[], enabled = true) {
  const fixtureKey = fixtureIds.join(",");
  const [statuses, setStatuses] = useState<CompactLiveStatus[]>([]);

  useEffect(() => {
    if (!enabled || !fixtureKey) {
      setStatuses([]);
      return;
    }
    let active = true;
    const ids = fixtureKey.split(",").filter(Boolean);
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetchLiveStatuses(ids).then((next) => {
        if (active) setStatuses(next);
      }).catch(() => undefined);
    };
    load();
    const pollId = window.setInterval(load, 10000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled, fixtureKey]);

  return useMemo(() => groupStatuses(statuses), [statuses]);
}

export function LeagueChairLiveIndicator({ statuses }: { statuses: CompactLiveStatus[] }) {
  if (!statuses.length) return null;
  const status = statuses[0];
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#e9fff4] px-2 py-1 text-[11px] font-black uppercase text-[#007a45] ring-1 ring-[#00a85a33]">
      <Radio className="h-3 w-3 shrink-0" />
      <span>Live</span>
      <span className="font-extrabold normal-case text-[#49645e]">
        G{status.game_number} · {status.state.homeScore}-{status.state.awayScore}
      </span>
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(value));
}

function CompactStatus({ status }: { status: CompactLiveStatus }) {
  return (
    <div className="grid gap-1 rounded-md bg-[#edf8f5] p-2.5 text-xs ring-1 ring-[#1b8a7233] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={status.status === "Paused" ? "muted" : "green"}>{status.status}</Badge>
        <strong className="text-sm tabular-nums text-[#10233f]">{status.state.homeScore}-{status.state.awayScore}</strong>
      </div>
      <div className="min-w-0 font-bold text-[#49645e]">
        <p>Game {status.game_number} · {liveFrameStatusLabel(status.state)}</p>
        <p className="truncate">{status.active_player_name ? `${status.active_player_name} · ` : ""}Current break {status.state.currentBreak}</p>
      </div>
      <p className="font-bold text-[#6c5a73] sm:text-right">{status.scorer_name ?? "Unassigned scorer"}</p>
    </div>
  );
}

export function LiveScoringDashboard({ userName }: { userName: string }) {
  const [payload, setPayload] = useState<DashboardPayload>({ fixtures: [], statuses: [] });
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [league, setLeague] = useState("All leagues");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/league-chair/live-scoring/dashboard", {
        credentials: "same-origin",
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Live scoring fixtures are unavailable.");
      setPayload(data as DashboardPayload);
      setMessage("");
    } catch (error) {
      if (!quiet) setMessage(error instanceof Error ? error.message : "Live scoring fixtures are unavailable.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const pollId = window.setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [load]);

  const statuses = useMemo(() => groupStatuses(payload.statuses), [payload.statuses]);
  const leagues = useMemo(() => Array.from(new Set(payload.fixtures.map((fixture) => fixture.league_name))), [payload.fixtures]);
  const fixtures = payload.fixtures.filter((fixture) => {
    if (league !== "All leagues" && fixture.league_name !== league) return false;
    return !date || fixture.fixture_date.slice(0, 10) === date;
  });

  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#10233f]">
      <header className="sticky top-0 z-40 bg-[#10233f] px-4 py-3 text-white shadow-elevated sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10" aria-label="Back to Interclub Snooker">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-white/65">Interclub Snooker</p>
              <h1 className="truncate text-lg font-black">Live scoring</h1>
            </div>
          </div>
          <p className="max-w-[42%] truncate text-xs font-bold text-white/70">{userName}</p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-4 sm:px-6">
        <section className="grid gap-3 rounded-lg bg-white p-4 ring-1 ring-[#eeeaf2]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Match control</h2>
              <p className="text-sm font-semibold text-[#6c5a73]">Select a fixture to score or monitor.</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">
              League
              <select value={league} onChange={(event) => setLeague(event.target.value)} className="min-h-11 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]">
                <option>All leagues</option>
                {leagues.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">
              Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]" />
            </label>
          </div>
        </section>

        {message ? <p className="rounded-lg bg-[#fff8eb] p-3 text-sm font-bold text-[#8a5a00]">{message}</p> : null}
        {loading ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73] ring-1 ring-[#eeeaf2]">Loading fixtures...</p> : null}
        {!loading && !fixtures.length ? <p className="rounded-lg bg-white p-4 text-sm font-bold text-[#6c5a73] ring-1 ring-[#eeeaf2]">No upcoming fixtures match these filters.</p> : null}

        <section className="grid gap-3">
          {fixtures.map((fixture) => {
            const fixtureStatuses = statuses[fixture.id] ?? [];
            const selected = selectedFixtureId === fixture.id;
            return (
              <article key={fixture.id} className={cn("overflow-hidden rounded-lg bg-white ring-1", selected ? "ring-[#1b8a72]" : "ring-[#eeeaf2]") }>
                <button type="button" className="grid w-full gap-2 p-3 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" onClick={() => setSelectedFixtureId(selected ? "" : fixture.id)}>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#6c5a73]" />
                    <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{formatDate(fixture.fixture_date)}</span>
                  </div>
                  <div className="min-w-0 text-sm font-black sm:text-center">
                    <span>{fixture.home_team_name}</span>
                    <span className="px-2 text-[#6c5a73]">v</span>
                    <span>{fixture.away_team_name}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge variant="muted">{fixture.league_name}</Badge>
                    {fixtureStatuses.length ? <Badge variant="green"><Radio className="mr-1 h-3 w-3" />Live now</Badge> : null}
                  </div>
                </button>
                {fixtureStatuses.length ? (
                  <div className="grid gap-2 border-t border-[#eeeaf2] px-3 py-2">
                    {fixtureStatuses.map((status) => <CompactStatus key={status.game_id} status={status} />)}
                  </div>
                ) : null}
                {selected ? (
                  <div className="border-t border-[#eeeaf2] bg-[#f7f5fa] p-3">
                    <LeagueChairMatchControls fixtureId={fixture.id} defaultOpen onDataRefresh={() => void load(true)} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
