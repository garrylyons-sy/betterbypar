"use client";

const mobileSrc = `/?testUser=${encodeURIComponent("garlyons@gmail.com")}&embed=1&isolate=1`;

export default function GarryMobilePage() {
  return (
    <main className="min-h-screen bg-[#071426] px-3 py-4 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] bg-white shadow-elevated ring-1 ring-white/15">
        <div className="flex min-h-11 items-center justify-between bg-[#10233f] px-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Mobile preview</p>
            <h1 className="text-sm font-extrabold">Garry Lyons</h1>
          </div>
          <a className="text-xs font-bold text-[#7bc7d6]" href={mobileSrc} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
        <iframe
          title="Garry mobile app"
          src={mobileSrc}
          className="h-[calc(100vh-4.75rem)] min-h-[760px] w-full border-0 bg-[#f7f5fa]"
        />
      </section>
    </main>
  );
}
