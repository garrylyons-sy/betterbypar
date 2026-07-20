export function SplashScreen() {
  return (
    <div className="splash fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#071426] text-white">
      <div className="splash-glow absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(123,199,214,0.24),transparent_70%)] blur-2xl" />
      <div className="absolute inset-0 splash-navy-gradient opacity-95" />
      <div className="relative flex w-full max-w-xs flex-col items-center px-8 text-center">
        <div className="splash-logo-pop relative mb-5 grid h-36 w-36 place-items-center p-1">
          <img
            src="/snooker-logo.png"
            alt=""
            className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.35)]"
            aria-hidden="true"
          />
        </div>
        <div className="fade-up">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#7bc7d6]">
            Interclub
          </p>
          <h1 className="mt-1 text-4xl font-black leading-none text-white">Snooker</h1>
        </div>
        <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="loading-line h-full rounded-full bg-[#7bc7d6]" />
        </div>
      </div>
    </div>
  );
}
