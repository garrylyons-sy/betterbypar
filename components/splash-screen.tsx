/** Shared startup screen. AuthGateway removes it once the session is ready. */
export function SplashScreen({ preview = false }: { preview?: boolean }) {
  return (
    <div role="status" aria-label="Loading Better By Par" className={`${preview ? 'relative min-h-[640px] rounded-[28px]' : 'fixed inset-0 z-50 min-h-[100svh]'} golf-splash isolate grid place-items-center overflow-hidden bg-[#0a2722] text-[#f5f2e8]`}>
      <div className="golf-splash-light pointer-events-none absolute inset-0" />
      <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-full w-full opacity-40" viewBox="0 0 900 1000" preserveAspectRatio="xMidYMax slice" fill="none">
        {[0,1,2,3,4,5,6].map(i => <path key={i} d={`M-150 ${720+i*48} C80 ${440+i*48} 280 ${1010+i*16} 540 ${700+i*35} S900 ${390+i*42} 1080 ${650+i*46}`} stroke="#83aa8e" strokeOpacity={0.16+i*.035} strokeWidth="1" />)}
        <circle cx="733" cy="235" r="210" stroke="#dcc38c" strokeOpacity=".13" />
        <circle cx="733" cy="235" r="260" stroke="#dcc38c" strokeOpacity=".07" />
      </svg>
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-7 py-20 text-center">
        <p className="mb-10 text-[10px] font-semibold uppercase tracking-[.36em] text-[#b8c7bb]">Your club. Your game.</p>
        <div className="splash-logo-pop relative">
          <div className="absolute -inset-5 rounded-[48px] border border-[#dcc38c]/15" />
          <img src="/brand/platform.svg" width="128" height="128" alt="" aria-hidden="true" className="relative h-32 w-32 rounded-[28px] shadow-[0_24px_80px_#0005]" />
        </div>
        <div className="fade-up mt-10">
          <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-[#dcc38c]">Better By Par</p>
          <h1 className="mt-3 font-serif text-[52px] font-normal leading-none tracking-tight sm:text-6xl">A better<br /><span className="italic text-[#dcc38c]">club experience.</span></h1>
          <p className="mt-5 text-sm leading-relaxed text-[#b8c7bb]">People, play and possibilities.<br />All together, in your pocket.</p>
        </div>
        <div className="mt-12 h-px w-28 overflow-hidden bg-white/15"><div className="golf-loading-line h-full w-1/2 bg-[#dcc38c]" /></div>
        <p className="mt-4 text-[10px] uppercase tracking-[.22em] text-[#b8c7bb]">Preparing your club</p>
      </div>
    </div>
  );
}
