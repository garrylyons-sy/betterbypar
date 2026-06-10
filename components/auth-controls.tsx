"use client";

import { useState } from "react";
import { LogIn, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

export async function authJsonFetch<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
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
  identifierLabel = "User ID or email"
}: {
  onSignedIn: () => void;
  googleNext?: string;
  identifierLabel?: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signInWithPassword() {
    setBusy(true);
    setMessage("");
    try {
      await authJsonFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });
      await onSignedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  const googlePath = googleNext ? `/auth/google?next=${encodeURIComponent(googleNext)}` : "/auth/google";

  return (
    <div className="grid gap-3">
      <AuthTextField label={identifierLabel} value={identifier} onChange={setIdentifier} autoComplete="username" />
      <AuthTextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
      {message ? <p className="text-sm font-bold text-[#1b8a72]">{message}</p> : null}
      <Button onClick={signInWithPassword} disabled={busy || !identifier || !password}>
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
      <Button variant="secondary" onClick={() => window.location.assign(googlePath)}>
        <Mail className="h-4 w-4" />
        Continue with Google
      </Button>
    </div>
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
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
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
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
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
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <textarea
        className="min-h-24 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 py-3 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
