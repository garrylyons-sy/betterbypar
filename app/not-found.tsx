import Link from "next/link";

function BrokenCueLogo() {
  return (
    <div className="relative mx-auto h-36 w-36">
      <div className="absolute inset-0 rounded-[32px] bg-[#10233f] shadow-[0_24px_60px_rgba(16,35,63,.28)]" />
      <div className="absolute inset-3 rounded-[24px] border-2 border-[#d8b75a] bg-[linear-gradient(135deg,#0b694c,#053427)]" />
      <svg viewBox="0 0 144 144" className="absolute inset-0 h-full w-full" role="img" aria-label="Interclub Snooker broken cue logo">
        <defs>
          <filter id="ballShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#020713" floodOpacity=".35" />
          </filter>
          <linearGradient id="cueWood" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#f3d27a" />
            <stop offset="1" stopColor="#b88735" />
          </linearGradient>
          <linearGradient id="snap" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#fff5c4" />
            <stop offset="1" stopColor="#d8b75a" />
          </linearGradient>
        </defs>
        <path d="M30 111 65 76" stroke="url(#cueWood)" strokeWidth="8" strokeLinecap="round" />
        <path d="M78 63 114 27" stroke="url(#cueWood)" strokeWidth="8" strokeLinecap="round" />
        <path d="M65 76 70 59 77 70 84 56 78 63" fill="url(#snap)" stroke="#fff2b4" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="51" cy="93" r="18" fill="#f7f4e9" filter="url(#ballShadow)" />
        <circle cx="46" cy="87" r="4" fill="#ffffff" opacity=".92" />
        <circle cx="96" cy="47" r="13" fill="#d32035" filter="url(#ballShadow)" />
        <circle cx="99" cy="96" r="12" fill="#111111" filter="url(#ballShadow)" />
        <circle cx="42" cy="44" r="12" fill="#f0c548" filter="url(#ballShadow)" />
        <path d="M28 27h88v88H28z" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        <path d="M44 27v88M72 27v88M100 27v88M28 44h88M28 72h88M28 100h88" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
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
