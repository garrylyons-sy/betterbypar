import Link from "next/link";

export function MaintenancePage() {
  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[#f2f7fd] px-6 py-16 text-[#061f3e]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-[#0878e8]" />
      <div className="relative mx-auto grid w-full max-w-4xl items-center gap-12 md:grid-cols-[1fr_1.2fr] md:gap-20">
        <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-full border border-[#061f3e]/10 sm:h-80 sm:w-80">
          <div className="absolute inset-5 rounded-full border border-[#061f3e]/10" />
          <img src="/brand/maintenance.svg" width="192" height="192" alt="Platform maintenance" className="relative h-44 w-44 rounded-[38px] shadow-[0_24px_60px_#061f3e20] sm:h-48 sm:w-48" />
        </div>
        <div className="text-center md:text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#0870cc]">A little time for improvement</p>
          <h1 className="mt-5 font-serif text-5xl font-normal leading-[1.08] tracking-tight sm:text-6xl">Keeping your<br /><span className="italic">club in great shape.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#426489]">We’re carrying out scheduled maintenance. Your club, lessons and player information will be ready when we’re back.</p>
          <p className="mt-5 text-sm font-semibold text-[#0870cc]">Thanks for your patience. See you shortly.</p>
          <Link href="/admin" className="mt-9 inline-block text-xs font-semibold uppercase tracking-widest underline underline-offset-8">Administrator access</Link>
        </div>
      </div>
    </main>
  );
}
