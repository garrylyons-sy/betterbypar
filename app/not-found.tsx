import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found | Better By Par"
};

function NotFoundLogo() {
  return (
    <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64">
      <div className="absolute inset-x-6 bottom-3 h-10 rounded-full bg-[#10233f]/14 blur-xl" />
      <img
        src="/brand/platform.svg"
        alt="Better By Par"
        className="relative h-full w-full object-contain drop-shadow-[0_18px_32px_rgba(16,35,63,.24)]"
      />
      <div className="absolute right-0 top-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#00ff85] text-xl font-black text-[#071426] shadow-[0_14px_30px_rgba(0,255,133,.22)]">
        404
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 py-10 text-[#10233f]">
      <section className="w-full max-w-lg text-center">
        <NotFoundLogo />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#6c5a73]">Better By Par</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">Page not found</h1>
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
