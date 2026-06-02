export function SplashScreen() {
  return (
    <div className="splash fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[var(--pl-purple-900)] text-white">
      <div className="splash-glow absolute h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(233,0,82,0.45),transparent_70%)] blur-2xl" />
      <div className="absolute inset-0 matchday-gradient opacity-80" />
      <div className="relative flex w-full max-w-xs flex-col items-center px-8 text-center">
        <div className="relative mb-6 grid h-24 w-44 place-items-center">
          <svg viewBox="0 0 190 92" className="h-24 w-44" aria-hidden="true">
            <path className="fixture-line" d="M17 70 C 52 16, 112 16, 172 68" fill="none" stroke="#04F5FF" strokeWidth="5" strokeLinecap="round" />
            <circle cx="52" cy="42" r="12" fill="#fff" />
            <circle cx="110" cy="26" r="10" fill="#00FF85" />
            <circle cx="154" cy="62" r="13" fill="#E90052" />
          </svg>
        </div>
        <div className="fade-up">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#04f5ff]">
            Interclub
          </p>
          <h1 className="mt-1 text-4xl font-black leading-none text-white">Snooker</h1>
        </div>
        <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="loading-line h-full rounded-full bg-[#e90052]" />
        </div>
      </div>
    </div>
  );
}
