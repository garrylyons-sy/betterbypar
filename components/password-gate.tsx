"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const ACCESS_PASSWORD = "sPectacular!87";
const STORAGE_KEY = "interclub-snooker-access-granted";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsUnlocked(sessionStorage.getItem(STORAGE_KEY) === "true");
    setIsReady(true);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === ACCESS_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsUnlocked(true);
      setError("");
      return;
    }

    setError("Incorrect password");
  }

  if (pathname.startsWith("/admin")) {
    return children;
  }

  if (!isReady) {
    return null;
  }

  if (isUnlocked) {
    return children;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#071426_0%,#0E2742_54%,#092016_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[#E8C766]/70" />
        <div className="absolute -top-28 right-[-100px] h-72 w-72 rounded-full bg-[#123B5F]/55 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-96px] h-80 w-80 rounded-full bg-[#0A6B45]/35 blur-3xl" />
        <section className="relative w-full max-w-sm rounded-[18px] border border-white/10 bg-white p-5 text-[#071426] shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0E2742] text-[#E8C766]">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#0A6B45]">
                Private preview
              </p>
              <h1 className="text-2xl font-black leading-tight">
                Interclub Snooker
              </h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#526174]">
                Access password
              </span>
              <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#D8E0EA] bg-[#F5F7FA] px-4 focus-within:border-[#0A6B45] focus-within:ring-2 focus-within:ring-[#0A6B45]/20">
                <LockKeyhole
                  className="h-5 w-5 shrink-0 text-[#526174]"
                  aria-hidden="true"
                />
                <input
                  className="h-12 min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-[#8B98A8]"
                  autoComplete="current-password"
                  autoFocus
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  type="password"
                  value={password}
                />
              </div>
            </label>

            {error ? (
              <p className="text-sm font-bold text-[#B42318]" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="min-h-12 w-full rounded-full bg-[#0E2742] text-sm font-black uppercase text-white hover:bg-[#143B63]">
              Enter app
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
