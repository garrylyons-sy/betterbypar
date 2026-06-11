export default function LineupTestPage() {
  const appOrigin = "https://www.interclubsnooker.com";
  const castleSrc = `${appOrigin}/?team=castle%20a&role=manager&season=2026%2F27&embed=1`;
  const grangeSrc = `${appOrigin}/?team=grange%20a&role=manager&season=2026%2F27&embed=1`;

  return (
    <main className="min-h-screen bg-[#071426] p-4 text-white">
      <header className="mx-auto mb-4 flex max-w-[1600px] flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-white/55">Lineup workflow test</p>
          <h1 className="text-2xl font-extrabold">Castle A Manager vs Grange A Manager</h1>
        </div>
        <p className="max-w-xl text-sm font-semibold text-white/70">
          Both panes use interclubsnooker.com. If you need to sign in, use Google once in a pane and the login will open as the main page before returning to the app.
        </p>
      </header>
      <section className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-2">
        <TestFrame title="Castle A - Manager" src={castleSrc} />
        <TestFrame title="Grange A - Manager" src={grangeSrc} />
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
