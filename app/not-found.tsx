import Link from "next/link";

function BrokenCueLogo() {
  return (
    <div className="relative mx-auto h-36 w-36">
      <div className="absolute inset-0 rounded-[34px] bg-[#10233f] shadow-[0_24px_60px_rgba(16,35,63,.28)]" />
      <div className="absolute inset-3 rounded-[26px] bg-white shadow-[inset_0_0_0_2px_rgba(16,35,63,.08)]" />
      <img
        src="/snooker-logo.png"
        alt=""
        className="absolute inset-6 h-24 w-24 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.22)]"
        aria-hidden="true"
      />
      <svg viewBox="0 0 144 144" className="absolute inset-0 h-full w-full" role="img" aria-label="Interclub Snooker broken cue logo">
        <defs>
          <linearGradient id="cueWood" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#f3d27a" />
            <stop offset="1" stopColor="#b88735" />
          </linearGradient>
          <linearGradient id="snap" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#fff5c4" />
            <stop offset="1" stopColor="#d8b75a" />
          </linearGradient>
        </defs>
        <path d="M19 125 62 82" stroke="url(#cueWood)" strokeWidth="9" strokeLinecap="round" />
        <path d="M82 62 125 19" stroke="url(#cueWood)" strokeWidth="9" strokeLinecap="round" />
        <path d="M62 82 68 61 77 75 87 56 82 62" fill="url(#snap)" stroke="#fff2b4" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M30 114 45 99" stroke="#fff5c4" strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
        <path d="M99 45 114 30" stroke="#fff5c4" strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
      </svg>
      <div className="absolute -right-3 -top-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#00ff85] text-lg font-black text-[#071426] shadow-[0_14px_30px_rgba(0,255,133,.22)]">
        404
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 py-10 text-[#10233f]">
      <section className="w-full max-w-lg text-center">
        <BrokenCueLogo />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#6c5a73]">Interclub Snooker</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">Frame not found</h1>
        <p className="mx-auto mt-3 max-w-sm text-base font-semibold leading-7 text-[#607086]">
          The page you were looking for has gone out of play.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#10233f] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#071426] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#04f5ff]"
          >
            Back to home
          </Link>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#eeeaf2] px-5 py-2.5 text-sm font-bold text-[#10233f] transition-colors hover:bg-[#e3ddea] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#04f5ff]"
          >
            Admin
          </Link>
        </div>
      </section>
    </main>
  );
}
