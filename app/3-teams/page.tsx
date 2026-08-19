"use client";

import { useState } from "react";

const testPanes = [
  {
    title: "Castle A - Player",
    user: "declan.mcniff@notrealmail.com",
    team: "castle a"
  },
  {
    title: "Castle B - Player",
    user: "declan.mcniff@notrealmail.com",
    team: "castle b"
  },
  {
    title: "Castle C - Player",
    user: "declan.mcniff@notrealmail.com",
    team: "castle c"
  }
];

export default function ThreeCastleTeamsPage() {
  const [frameVersion, setFrameVersion] = useState(0);

  return (
    <main className="min-h-screen bg-[#071426] p-4 text-white">
      <header className="mx-auto mb-4 flex max-w-[1920px] flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-white/55">Castle player test</p>
          <h1 className="text-2xl font-extrabold">Castle A, B and C player windows</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="max-w-xl text-sm font-semibold text-white/70">
            Each pane opens the app as a Castle player in a different team context for 2026/27.
          </p>
          <button
            type="button"
            onClick={() => setFrameVersion((version) => version + 1)}
            className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-extrabold uppercase text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            Refresh panes
          </button>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1920px] gap-4 xl:grid-cols-3">
        {testPanes.map((pane) => (
          <TestFrame
            key={`${pane.team}-${frameVersion}`}
            title={pane.title}
            src={`/?testUser=${encodeURIComponent(pane.user)}&team=${encodeURIComponent(pane.team)}&role=player&season=2026%2F27&embed=1&testRefresh=${frameVersion}`}
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
