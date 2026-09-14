"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import { authJsonFetch, AuthTextField } from "@/components/auth-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token")?.trim() ?? "");
  }, []);

  async function resetPassword() {
    setBusy(true);
    setMessage("");
    try {
      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      await authJsonFetch("/api/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 py-6 text-[#25002b]">
      <section className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#10233f] p-1.5 shadow-card">
            <img src="/favicon.ico" alt="Interclub Snooker" className="h-full w-full rounded-lg object-contain" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Interclub Snooker</p>
            <h1 className="text-2xl font-extrabold leading-tight">Set new password</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Password reset</CardTitle>
            <Badge variant="cyan">Secure link</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm font-semibold text-[#6c5a73]">
              Choose a new password for your account. Reset links expire shortly after they are sent.
            </p>
            <AuthTextField label="New password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
            <AuthTextField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" />
            {message ? <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">{message}</p> : null}
            <Button onClick={resetPassword} disabled={busy || !token || password.length < 8 || !confirmPassword}>
              <KeyRound className="h-4 w-4" />
              Save new password
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
