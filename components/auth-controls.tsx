"use client";

import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

export async function authJsonFetch<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data as T;
}

export function AuthSignInForm({
  onSignedIn,
  googleNext,
  identifierLabel = "User ID or email",
  onForgotPassword
}: {
  onSignedIn: () => void;
  googleNext?: string;
  identifierLabel?: string;
  onForgotPassword?: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("info");
  const [currentNext, setCurrentNext] = useState("/");

  useEffect(() => {
    setCurrentNext(`${window.location.pathname}${window.location.search}`);
  }, []);

  async function signInWithPassword() {
    setBusy(true);
    setMessage("");
    setMessageTone("info");
    try {
      await authJsonFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });
      await onSignedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  const googlePath = `/auth/google?next=${encodeURIComponent(googleNext ?? currentNext)}`;

  return (
    <div className="grid gap-3">
      <AuthTextField label={identifierLabel} value={identifier} onChange={setIdentifier} autoComplete="username" />
      <AuthTextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
      {message ? (
        <p
          className={messageTone === "error"
            ? "rounded-xl bg-[#fff3f3] p-3 text-sm font-bold text-[#b42318] ring-1 ring-[#f3b7b2]"
            : "rounded-xl bg-[#f1fbf7] p-3 text-sm font-bold text-[#1b8a72] ring-1 ring-[#bce7d8]"}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      {onForgotPassword ? (
        <button type="button" onClick={onForgotPassword} className="justify-self-start text-sm font-extrabold text-[#1b8a72]">
          Forgot password?
        </button>
      ) : null}
      <Button onClick={signInWithPassword} disabled={busy || !identifier || !password}>
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
      <GoogleAuthButton label="Sign in with Google" href={googlePath} />
    </div>
  );
}

export function GoogleAuthButton({
  label,
  onClick,
  href
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className = "mx-auto inline-flex h-10 w-full max-w-[220px] items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-4 text-[14px] font-medium leading-none text-[#1f1f1f] shadow-none transition-colors hover:bg-[#f8fafd] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]";
  const content = (
    <>
      <GoogleGIcon />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_top" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function GoogleGIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthTextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <input
        className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
      />
    </label>
  );
}

export function AuthSelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <select
        className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AuthTextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <textarea
        className="min-h-24 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 py-3 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
