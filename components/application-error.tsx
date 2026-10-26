"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { isLikelyStaleClientError, shouldAutoReloadClient } from "@/lib/client-error-recovery.mjs";

const RELOAD_KEY = "interclub-stale-client-reload";

export function ApplicationError({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  const staleClient = isLikelyStaleClientError(error);

  useEffect(() => {
    if (!staleClient) return;
    const previousReloadAt = Number(window.sessionStorage.getItem(RELOAD_KEY)) || null;
    if (!shouldAutoReloadClient(error, previousReloadAt)) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [error, staleClient]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] p-6 text-[#10233f]">
      <section className="grid w-full max-w-md gap-5 rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-[#ded7e5]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-[#fff1d6] text-[#8a5a00]">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="grid gap-2">
          <p className="text-xs font-black uppercase text-[#6c5a73]">Better By Par</p>
          <h1 className="text-2xl font-black">The app needs a quick reload</h1>
          <p className="text-sm font-semibold leading-6 text-[#6c5a73]">
            {staleClient
              ? "A newer version was released while this page was open. Reload to continue with the latest version."
              : "Something unexpected interrupted this screen. Your saved information has not been changed."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (staleClient) {
              window.location.reload();
              return;
            }
            reset?.();
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#10233f] px-4 text-sm font-black text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {staleClient ? "Reload app" : "Try again"}
        </button>
      </section>
    </main>
  );
}
