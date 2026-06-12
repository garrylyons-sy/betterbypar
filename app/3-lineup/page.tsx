"use client";

import { useState } from "react";

const appOrigin = "https://www.interclubsnooker.com";

const testPanes = [
  { title: "Castle A - Manager", team: "castle a" },
  { title: "Grange A - Manager", team: "grange a" },
  { title: "Milltown A - Manager", team: "milltown a" }
];

export default function ThreeLineupPage() {
  const [frameVersion, setFrameVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function resetMatch() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/lineup-test/reset", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Reset failed.");
      setMessage("Reset to scheduled fixtures. Panes refreshed.");
      setFrameVersion((version) => version + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071426] p-4 text-white">
      <header className="mx-auto mb-4 flex max-w-[1920px] flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-white/55">Lineup workflow test</p>
          <h1 className="text-2xl font-extrabold">Three manager windows</h1>
        </div>
        <p className="max-w-xl text-sm font-semibold text-white/70">
          Each pane runs interclubsnooker.com with a manager context for the 2026/27 A League test week.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {message ? <p className="text-xs font-bold text-white/70">{message}</p> : null}
          <button
            type="button"
            onClick={resetMatch}
            disabled={busy}
            className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-extrabold uppercase text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Resetting" : "Reset fixtures"}
          </button>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1920px] gap-4 xl:grid-cols-3">
        {testPanes.map((pane) => (
          <TestFrame
            key={`${pane.team}-${frameVersion}`}
            title={pane.title}
            src={`${appOrigin}/?team=${encodeURIComponent(pane.team)}&role=manager&season=2026%2F27&embed=1&testRefresh=${frameVersion}`}
          />
        ))}
      </section>
    </main>
  );
}

function TestFrame({ title, src }: { title: string; src: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-elevated ring-1 ring-white/10">
      <div className="flex min-h-12 items-center justify-between bg-[#10233f] px-4 text-white">
        <h2 className="text-sm font-extrabold">{title}</h2>
        <a className="text-xs font-bold text-[#7bc7d6]" href={src} target="_blank" rel="noreferrer">
          Open pane
        </a>
      </div>
      <iframe
        title={title}
        src={src}
        className="h-[calc(100vh-120px)] min-h-[760px] w-full border-0 bg-[#f7f5fa]"
      />
    </section>
  );
}
