import Link from "next/link";
import { HardHat, Wrench } from "lucide-react";

export function MaintenancePage() {
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#f7f5fa] px-5 py-10 text-[#10233f] sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[#10233f]" />
      <div className="relative mx-auto grid w-full max-w-5xl content-center items-center gap-7 md:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)] md:gap-12">
        <div className="order-2 text-center md:order-1 md:text-left">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-[#00e5f0] px-3 py-2 text-xs font-black uppercase text-[#10233f]">
            <Wrench className="h-4 w-4" />
            Scheduled maintenance
          </div>
          <h1 className="text-4xl font-black leading-tight text-[#25002b] sm:text-5xl">Down for maintenance</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold leading-relaxed text-[#6c5a73] md:mx-0">
            We&apos;re making a few improvements. Interclub Snooker will be back shortly.
          </p>
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-bold text-[#6c5a73] md:justify-start">
            <HardHat className="h-5 w-5 text-[#1b8a72]" />
            Fixtures, tables and results are safely tucked away while we work.
          </div>
          <Link
            href="/admin"
            className="mt-9 inline-block text-sm font-extrabold text-[#6c5a73] underline decoration-[#b8acbf] underline-offset-4 transition-colors hover:text-[#25002b]"
          >
            Administrator access
          </Link>
        </div>
        <div className="order-1 flex min-h-[280px] items-end justify-center md:order-2 md:min-h-[520px]">
          <img
            src="/snooker-logo-maintenance.png"
            alt="Interclub Snooker maintenance character"
            className="max-h-[360px] w-auto max-w-full object-contain drop-shadow-[0_24px_42px_rgba(16,35,63,0.22)] md:max-h-[520px]"
          />
        </div>
      </div>
    </main>
  );
}
