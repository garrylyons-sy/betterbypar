"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Clock, Play, RefreshCw, Square, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Actor = {
  accountId: string;
  personId: string;
  username: string;
  name: string;
  email: string | null;
  isPlatformAdmin: boolean;
  roleTypes: string[];
  roleLabels: string[];
};

type ScenarioId = "session" | "fixtures" | "bookings" | "competitions" | "admin";

type ScenarioResult = {
  scenario: ScenarioId;
  label: string;
  ok: boolean;
  status: number;
  durationMs: number;
  detail: string;
};

type ActorRun = {
  accountId: string;
  personId: string;
  name: string;
  email: string | null;
  isPlatformAdmin: boolean;
  ok: boolean;
  results: ScenarioResult[];
};

type HarnessRun = {
  ranAt: string;
  ok: boolean;
  actorRuns: ActorRun[];
  summary: {
    actors: number;
    checks: number;
    passed: number;
    failed: number;
    averageMs: number;
    slowestMs: number;
    totalDurationMs: number;
    concurrency: number;
  };
};

const scenarioOptions: Array<{ id: ScenarioId; label: string; description: string }> = [
  { id: "session", label: "Home/session", description: "Loads the same payload the app uses after login." },
  { id: "fixtures", label: "Fixtures", description: "Loads fixture weeks for the actor's team context." },
  { id: "bookings", label: "Bookings", description: "Checks table booking access and availability." },
  { id: "competitions", label: "Competitions", description: "Loads club competition visibility." },
  { id: "admin", label: "Admin", description: "Confirms admins get in and non-admins are rejected." }
];

const defaultScenarios: ScenarioId[] = ["session", "fixtures", "bookings", "competitions"];
const roleFilters = ["All", "Player", "Manager", "Club Member", "Club Admin", "Platform Admin"];

export function TestHarness() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<ScenarioId[]>(defaultScenarios);
  const [roleFilter, setRoleFilter] = useState("All");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [intervalSeconds, setIntervalSeconds] = useState(20);
  const [concurrency, setConcurrency] = useState(10);
  const [runs, setRuns] = useState<HarnessRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const stopAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadActors();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const visibleActors = useMemo(() => {
    if (roleFilter === "All") return actors;
    if (roleFilter === "Platform Admin") return actors.filter((actor) => actor.isPlatformAdmin);
    return actors.filter((actor) => actor.roleTypes.includes(roleFilter));
  }, [actors, roleFilter]);

  const aggregate = useMemo(() => {
    const allChecks = runs.flatMap((run) => run.actorRuns.flatMap((actorRun) => actorRun.results));
    const durations = allChecks.map((check) => check.durationMs);
    return {
      runs: runs.length,
      checks: allChecks.length,
      failed: allChecks.filter((check) => !check.ok).length,
      averageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      slowestMs: durations.length ? Math.max(...durations) : 0
    };
  }, [runs]);

  async function loadActors() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/test-harness/actors", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load actors.");
      setActors(body.actors ?? []);
      setSelectedActors((current) => current.length ? current : (body.actors ?? []).slice(0, 3).map((actor: Actor) => actor.accountId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load actors.");
    } finally {
      setLoading(false);
    }
  }

  function toggleActor(accountId: string) {
    setSelectedActors((current) => current.includes(accountId)
      ? current.filter((id) => id !== accountId)
      : [...current, accountId]
    );
  }

  function toggleScenario(scenario: ScenarioId) {
    setSelectedScenarios((current) => current.includes(scenario)
      ? current.filter((id) => id !== scenario)
      : [...current, scenario]
    );
  }

  async function runOnce() {
    if (!selectedActors.length || !selectedScenarios.length) {
      setMessage("Select at least one actor and one scenario.");
      return;
    }

    const response = await fetch("/api/test-harness/run-once", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorAccountIds: selectedActors, scenarios: selectedScenarios, concurrency })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Test tick failed.");
    setRuns((current) => [body, ...current].slice(0, 30));
  }

  async function runTickLoop() {
    if (!stopAtRef.current) return;
    const now = Date.now();
    if (now >= stopAtRef.current) {
      setRunning(false);
      setRemainingSeconds(0);
      return;
    }

    try {
      await runOnce();
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test tick failed.");
    }

    const remaining = Math.max(0, Math.ceil(((stopAtRef.current ?? Date.now()) - Date.now()) / 1000));
    setRemainingSeconds(remaining);
    if (remaining <= 0) {
      setRunning(false);
      return;
    }
    timeoutRef.current = setTimeout(runTickLoop, Math.max(5, intervalSeconds) * 1000);
  }

  function startSchedule() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRuns([]);
    setRunning(true);
    const seconds = Math.max(15, durationMinutes * 60);
    stopAtRef.current = Date.now() + seconds * 1000;
    setRemainingSeconds(seconds);
    window.setTimeout(runTickLoop, 0);
  }

  function stopSchedule() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    stopAtRef.current = null;
    setRunning(false);
    setRemainingSeconds(0);
  }

  function selectVisible(limit?: number) {
    setSelectedActors(visibleActors.slice(0, limit ?? visibleActors.length).map((actor) => actor.accountId));
  }

  return (
    <main className="min-h-screen bg-[#f5f3f8] px-4 py-5 text-[#10233f] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="grid gap-4 self-start lg:sticky lg:top-5">
          <div className="rounded-[18px] bg-[#10233f] p-5 text-white shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7bc7d6]">Interclub Snooker</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">Browser test harness</h1>
            <p className="mt-2 text-sm font-semibold text-white/75">
              Simulate multiple logged-in users by running real app API calls with isolated temporary sessions.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              {running ? <StatusPill tone="live">Running</StatusPill> : <StatusPill tone="muted">Stopped</StatusPill>}
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Minutes" value={durationMinutes} min={1} max={10} onChange={setDurationMinutes} />
                <NumberField label="Every seconds" value={intervalSeconds} min={5} max={120} onChange={setIntervalSeconds} />
              </div>
              <NumberField label="Concurrent users" value={concurrency} min={1} max={50} onChange={setConcurrency} />
              <div className="rounded-xl bg-[#f7f5fa] p-3 text-xs font-bold text-[#6c5a73] ring-1 ring-[#eeeaf2]">
                Selected: {selectedActors.length} user(s). Each tick runs up to {concurrency} users at the same time, then starts the next batch.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => runOnce().catch((error) => setMessage(error.message))} variant="secondary" disabled={running || loading}>
                  <RefreshCw className="h-4 w-4" />
                  Run once
                </Button>
                {running ? (
                  <Button onClick={stopSchedule} variant="dark">
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={startSchedule} disabled={loading || !selectedActors.length || !selectedScenarios.length}>
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                )}
              </div>
              <p className="text-sm font-bold text-[#6c5a73]">
                {running ? `${Math.ceil(remainingSeconds / 60)} min remaining (${remainingSeconds}s)` : "Runs stay in this browser window and update live."}
              </p>
              {message ? <p className="rounded-xl bg-[#fff8eb] p-3 text-sm font-bold text-[#8a5a00] ring-1 ring-[#ffb00055]">{message}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scenarios</CardTitle>
              <StatusPill tone="cyan">{selectedScenarios.length}</StatusPill>
            </CardHeader>
            <CardContent className="grid gap-2">
              {scenarioOptions.map((scenario) => (
                <label key={scenario.id} className="grid cursor-pointer grid-cols-[22px_1fr] gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                  <input
                    checked={selectedScenarios.includes(scenario.id)}
                    className="mt-1 h-4 w-4 accent-[#1b8a72]"
                    onChange={() => toggleScenario(scenario.id)}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-extrabold">{scenario.label}</span>
                    <span className="block text-xs font-semibold text-[#6c5a73]">{scenario.description}</span>
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5">
          <Card>
            <CardHeader className="items-center">
              <div>
                <CardTitle>Actors</CardTitle>
                <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Pick real app accounts and role types to simulate.</p>
              </div>
              <Button onClick={loadActors} size="sm" variant="secondary" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {roleFilters.map((role) => (
                  <button
                    key={role}
                    className={cn(
                      "min-h-10 shrink-0 rounded-lg px-3 text-sm font-extrabold ring-1 transition",
                      roleFilter === role ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-[#f7f5fa] text-[#10233f] ring-[#eeeaf2]"
                    )}
                    onClick={() => setRoleFilter(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => selectVisible(50)} size="sm" variant="secondary" disabled={running || loading || !visibleActors.length}>
                  First 50
                </Button>
                <Button onClick={() => selectVisible()} size="sm" variant="secondary" disabled={running || loading || !visibleActors.length}>
                  All visible
                </Button>
                <Button onClick={() => setSelectedActors([])} size="sm" variant="secondary" disabled={running || loading || !selectedActors.length}>
                  Clear
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visibleActors.map((actor) => {
                  const selected = selectedActors.includes(actor.accountId);
                  return (
                    <button
                      key={actor.accountId}
                      className={cn(
                        "grid min-h-[112px] gap-2 rounded-xl p-3 text-left ring-1 transition",
                        selected ? "bg-[#e9f7f3] ring-[#1b8a72]" : "bg-white ring-[#eeeaf2] hover:bg-[#f7f5fa]"
                      )}
                      onClick={() => toggleActor(actor.accountId)}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-extrabold">{actor.name}</span>
                          <span className="block truncate text-xs font-semibold text-[#6c5a73]">{actor.email || actor.username}</span>
                        </span>
                        {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1b8a72]" /> : null}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {(actor.roleTypes.length ? actor.roleTypes : ["No role"]).slice(0, 4).map((role) => (
                          <span key={role} className="rounded-md bg-[#f0edf4] px-2 py-1 text-[11px] font-bold text-[#6c5a73]">
                            {role}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Runs" value={aggregate.runs} />
            <Metric label="Checks" value={aggregate.checks} />
            <Metric label="Failures" value={aggregate.failed} tone={aggregate.failed ? "bad" : "good"} />
            <Metric label="Avg / slowest" value={`${aggregate.averageMs} / ${aggregate.slowestMs} ms`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Live Results</CardTitle>
              <StatusPill tone={aggregate.failed ? "bad" : runs.length ? "good" : "muted"}>
                {runs.length ? (aggregate.failed ? "Issues" : "Passing") : "Waiting"}
              </StatusPill>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!runs.length ? (
                <div className="grid min-h-40 place-items-center rounded-xl bg-[#f7f5fa] text-center ring-1 ring-[#eeeaf2]">
                  <div>
                    <Activity className="mx-auto h-8 w-8 text-[#6c5a73]" />
                    <p className="mt-2 text-sm font-bold text-[#6c5a73]">No test ticks have run yet.</p>
                  </div>
                </div>
              ) : (
                runs.map((run, index) => (
                  <section key={`${run.ranAt}-${index}`} className="rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {run.ok ? <CheckCircle2 className="h-5 w-5 text-[#1b8a72]" /> : <XCircle className="h-5 w-5 text-[#b42318]" />}
                        <p className="text-sm font-extrabold">{new Date(run.ranAt).toLocaleTimeString()}</p>
                      </div>
                      <p className="text-xs font-bold text-[#6c5a73]">
                        {run.summary.passed}/{run.summary.checks} passed · {run.summary.actors} users · concurrency {run.summary.concurrency} · total {run.summary.totalDurationMs} ms
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {run.actorRuns.map((actorRun) => (
                        <div key={`${run.ranAt}-${actorRun.accountId}`} className="rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-extrabold">{actorRun.name}</p>
                            <StatusPill tone={actorRun.ok ? "good" : "bad"}>{actorRun.ok ? "Pass" : "Fail"}</StatusPill>
                          </div>
                          <div className="mt-2 grid gap-1">
                            {actorRun.results.map((result) => (
                              <div key={`${actorRun.accountId}-${result.scenario}`} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 text-xs font-bold">
                                {result.ok ? <CheckCircle2 className="h-4 w-4 text-[#1b8a72]" /> : <XCircle className="h-4 w-4 text-[#b42318]" />}
                                <span className="truncate">{result.label}: {result.detail}</span>
                                <span className="flex items-center gap-1 text-[#6c5a73]">
                                  <Clock className="h-3.5 w-3.5" />
                                  {result.durationMs} ms · {result.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <input
        className="min-h-11 rounded-xl border border-[#eeeaf2] bg-white px-3 text-sm font-extrabold outline-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
        max={max}
        min={min}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
        type="number"
        value={value}
      />
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return (
    <Card className={cn(tone === "good" && "bg-[#e9f7f3]", tone === "bad" && "bg-[#fff1f3]")}>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase text-[#6c5a73]">{label}</p>
        <p className="mt-1 text-2xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: "good" | "bad" | "cyan" | "live" | "muted" }) {
  const classes = {
    good: "bg-[#e9f7f3] text-[#0a6b45]",
    bad: "bg-[#fff1f3] text-[#b42318]",
    cyan: "bg-[#e8fbff] text-[#087385]",
    live: "bg-[#00ff85] text-[#10233f]",
    muted: "bg-[#f0edf4] text-[#6c5a73]"
  };
  return <span className={cn("rounded-md px-2 py-1 text-xs font-extrabold", classes[tone])}>{children}</span>;
}
