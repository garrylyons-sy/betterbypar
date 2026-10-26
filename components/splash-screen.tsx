/** Shared startup screen. AuthGateway removes it once the session is ready. */
export function SplashScreen({ preview = false }: { preview?: boolean }) {
  return (
    <div role="status" aria-label="Loading Better By Par" className={`${preview ? 'relative min-h-[480px] rounded-[28px]' : 'fixed inset-0 z-50 min-h-[100svh]'} golf-splash isolate grid place-items-center overflow-hidden bg-white text-[#061f3e]`}>
      <div className="golf-splash-light pointer-events-none absolute inset-0" />
      <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-full w-full" viewBox="0 0 900 1000" preserveAspectRatio="xMidYMax slice" fill="none">
        {[0,1,2,3,4].map(i => <path key={i} d={`M-150 ${850+i*38} C80 ${630+i*38} 280 ${1050+i*16} 540 ${810+i*28} S900 ${620+i*32} 1080 ${790+i*38}`} stroke="#0878e8" strokeOpacity={.04+i*.015} strokeWidth="1" />)}
      </svg>
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-5 py-8 text-center sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[.3em] text-[#426489]">Your club. Your game.</p>
        <img src="/brand/better-by-par-logo.png" width="1774" height="887" alt="Better By Par Golf" className="splash-logo-pop mt-4 h-auto max-h-[32svh] w-full object-contain" fetchPriority="high" />
        <p className="fade-up mt-3 text-lg font-semibold tracking-tight sm:text-xl">A better game starts here.</p>
        <p className="mt-3 text-sm leading-relaxed text-[#426489]">Your golf, your lessons, your progress.</p>
        <div className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-[#e3effc]"><div className="golf-loading-line h-full w-1/2 rounded-full bg-[#0878e8]" /></div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.2em] text-[#426489]">Preparing your club</p>
      </div>
    </div>
  );
}
