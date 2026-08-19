"use client";

import { useState } from "react";

export default function LineupTestPage() {
  const appOrigin = "https://www.interclubsnooker.com";
  const [frameVersion, setFrameVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const castleSrc = `${appOrigin}/?team=castle%20a&role=manager&season=2026%2F27&embed=1&testRefresh=${frameVersion}`;
  const dunLaoghaireSrc = `${appOrigin}/?team=dun%20laoghaire%20a&role=manager&season=2026%2F27&embed=1&testRefresh=${frameVersion}`;

  async function resetMatch() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/lineup-test/reset", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Reset failed.");
      setMessage("Reset to scheduled fixture. Panes refreshed.");
      setFrameVersion((version) => version + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071426] p-4 text-white">
      <header className="mx-auto mb-4 flex max-w-[1600px] flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-white/55">Lineup workflow test</p>
          <h1 className="text-2xl font-extrabold">Castle A Manager vs Dun Laoghaire A Manager</h1>
        </div>
        <p className="max-w-xl text-sm font-semibold text-white/70">
          Both panes use interclubsnooker.com. If you need to sign in, use Google once in a pane and the login will open as the main page before returning to the app.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {message ? <p className="text-xs font-bold text-white/70">{message}</p> : null}
          <button
            type="button"
            onClick={resetMatch}
            disabled={busy}
            className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-extrabold uppercase text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Resetting" : "Reset match"}
          </button>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-2">
        <TestFrame key={`castle-${frameVersion}`} title="Castle A - Manager" src={castleSrc} />
        <TestFrame key={`dun-laoghaire-${frameVersion}`} title="Dun Laoghaire A - Manager" src={dunLaoghaireSrc} />
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
