"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, KeyRound, LogIn, Mail, Send, ShieldCheck, UserPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SplashScreen } from "@/components/splash-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubTeamStructure } from "@/lib/demo-data";
import type { PlayerGameResult, TeamContext } from "@/lib/types";

type AuthMode = "signin" | "activate" | "request";
type TeamOption = {
  clubId: string;
  clubName: string;
  teamId: string;
  teamName: string;
  leagueName: string;
  seasonName: string;
};
type SessionPayload = {
  authenticated: boolean;
  user?: {
    email: string;
    name: string;
  };
  contexts?: TeamContext[];
  playerGameResults?: PlayerGameResult[];
  error?: string;
};

const demoTeamOptions: TeamOption[] = clubTeamStructure.flatMap((club) =>
  club.teams.map((team) => ({
    clubId: club.club,
    clubName: club.club,
    teamId: team,
    teamName: team,
    leagueName: team.endsWith("B") ? "B League" : team.endsWith("C") ? "C League" : "A League",
    seasonName: "2026/27"
  }))
);

async function jsonFetch<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data as T;
}

export function AuthGateway() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [previewDashboard, setPreviewDashboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [message, setMessage] = useState("");
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>(demoTeamOptions);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jsonFetch<SessionPayload>("/api/session");
      setSession(payload);
      setMessage(payload.error ?? "");
    } catch (error) {
      setSession({ authenticated: false });
      setMessage(error instanceof Error ? error.message : "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    jsonFetch<{ teams: Array<{
      club_id: string;
      club_name: string;
      team_id: string;
      team_name: string;
      league_name: string;
      season_name: string;
    }> }>("/api/invite-options")
      .then(({ teams }) => {
        if (!teams.length) return;
        setTeamOptions(teams.map((team) => ({
          clubId: team.club_id,
          clubName: team.club_name,
          teamId: team.team_id,
          teamName: team.team_name,
          leagueName: team.league_name,
          seasonName: team.season_name
        })));
      })
      .catch(() => {});
  }, [refreshSession]);

  const recordPageVisit = useCallback((pageLabel: string, activeTeam: TeamContext) => {
    fetch("/api/page-visit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pagePath: window.location.pathname,
        pageLabel,
        userAgent: window.navigator.userAgent,
        metadata: {
          team_context_id: activeTeam.id,
          team_name: activeTeam.name,
          role: activeTeam.role
        }
      })
    }).catch(() => {});
  }, []);

  async function signOut() {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    await refreshSession();
  }

  if (loading) return <SplashScreen />;

  if (previewDashboard) {
    return (
      <>
        <DemoAuthNotice />
        <AppShell />
      </>
    );
  }

  if (session?.authenticated) {
    const contexts = session.contexts ?? [];
    if (contexts.length > 0) {
      return (
        <>
          {message ? <SessionBanner message={message} label={session.user?.email ?? "Signed in"} /> : null}
          <AppShell
            contexts={contexts}
            playerGameResults={session.playerGameResults ?? []}
            userLabel={session.user?.email ?? "Signed in"}
            onSignOut={signOut}
            onPageVisit={recordPageVisit}
          />
        </>
      );
    }

    return <NoMemberships email={session.user?.email ?? "Signed in"} onSignOut={signOut} />;
  }

  return (
    <AuthHome
      mode={mode}
      setMode={setMode}
      teamOptions={teamOptions}
      onPreviewDashboard={() => setPreviewDashboard(true)}
      onSignedIn={refreshSession}
    />
  );
}

function AuthHome({
  mode,
  setMode,
  teamOptions,
  onPreviewDashboard,
  onSignedIn
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  teamOptions: TeamOption[];
  onPreviewDashboard: () => void;
  onSignedIn: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <section className="mx-auto grid min-h-screen w-full max-w-[1180px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_460px] lg:items-center lg:px-10">
        <div className="rounded-[18px] bg-[#37003c] p-5 text-white shadow-elevated sm:p-7">
          <Badge variant="cyan">Player access</Badge>
          <h1 className="mt-5 text-4xl font-black leading-none sm:text-5xl">
            Interclub Snooker
          </h1>
          <p className="mt-3 max-w-xl text-base font-semibold text-white/75">
            Sign in, activate an invite, or request player access for your club and team. Manager roles are assigned through backend membership management only.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AuthFeature icon={ShieldCheck} label="Club linked" />
            <AuthFeature icon={CheckCircle2} label="Team roles" />
            <AuthFeature icon={KeyRound} label="App-owned login" />
          </div>
          <Button className="mt-6" variant="secondary" onClick={onPreviewDashboard}>
            <Eye className="h-4 w-4" />
            Preview dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Sign in" : mode === "activate" ? "Activate invite" : "Request invite"}</CardTitle>
            <Badge variant={mode === "request" ? "cyan" : mode === "signin" ? "muted" : "green"}>
              {mode === "request" ? "Player only" : mode === "signin" ? "Existing user" : "Invited user"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 rounded-full bg-[#eeeaf2] p-1">
              {(["signin", "activate", "request"] as AuthMode[]).map((item) => (
                <button
                  key={item}
                  className={`min-h-11 rounded-full text-sm font-black ${mode === item ? "bg-[#37003c] text-white" : "text-[#25002b]"}`}
                  onClick={() => setMode(item)}
                >
                  {item === "signin" ? "Sign in" : item === "activate" ? "Activate" : "Request"}
                </button>
              ))}
            </div>
            {mode === "signin" ? (
              <SignInForm onSignedIn={onSignedIn} />
            ) : mode === "activate" ? (
              <ActivateForm onSignedIn={onSignedIn} />
            ) : (
              <RequestInviteForm teamOptions={teamOptions} />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function AuthFeature({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
      <Icon className="h-5 w-5 text-[#04f5ff]" />
      <p className="mt-2 text-sm font-black">{label}</p>
    </div>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signInWithPassword() {
    setBusy(true);
    setMessage("");
    try {
      await jsonFetch("/api/login", {
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

  return (
    <div className="grid gap-3">
      <TextField label="User ID or email" value={identifier} onChange={setIdentifier} autoComplete="username" />
      <TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
      {message ? <p className="text-sm font-bold text-[#e90052]">{message}</p> : null}
      <Button onClick={signInWithPassword} disabled={busy || !identifier || !password}>
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
      <Button variant="secondary" onClick={() => window.location.assign("/auth/google")}>
        <Mail className="h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}

function ActivateForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function activateWithPassword() {
    setBusy(true);
    setMessage("");
    try {
      await jsonFetch("/api/activate", {
        method: "POST",
        body: JSON.stringify({ email, username, password })
      });
      await onSignedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
      <TextField label="User ID" value={username} onChange={setUsername} autoComplete="username" />
      <TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      {message ? <p className="text-sm font-bold text-[#37003c]">{message}</p> : null}
      <Button onClick={activateWithPassword} disabled={busy || !email || !username || !password}>
        <UserPlus className="h-4 w-4" />
        Create account
      </Button>
      <Button variant="secondary" onClick={() => window.location.assign("/auth/google")}>
        <Mail className="h-4 w-4" />
        Activate with Google
      </Button>
    </div>
  );
}

function RequestInviteForm({ teamOptions }: { teamOptions: TeamOption[] }) {
  const clubNames = Array.from(new Set(teamOptions.map((option) => option.clubName)));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clubName, setClubName] = useState(clubNames[0] ?? "");
  const availableTeams = teamOptions.filter((option) => option.clubName === clubName);
  const [teamId, setTeamId] = useState(availableTeams[0]?.teamId ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!clubNames.includes(clubName)) {
      setClubName(clubNames[0] ?? "");
    }
  }, [clubName, clubNames]);

  useEffect(() => {
    const nextTeams = teamOptions.filter((option) => option.clubName === clubName);
    if (!nextTeams.some((team) => team.teamId === teamId)) {
      setTeamId(nextTeams[0]?.teamId ?? "");
    }
  }, [clubName, teamId, teamOptions]);

  async function submitRequest() {
    setBusy(true);
    setStatus("");
    try {
      await jsonFetch("/api/request-invite", {
        method: "POST",
        body: JSON.stringify({ name, email, teamId, message })
      });
      setStatus("Request sent. The league will review it and send an invite if approved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <TextField label="Full name" value={name} onChange={setName} autoComplete="name" />
      <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
      <SelectField label="Club" value={clubName} onChange={setClubName} options={clubNames.map((club) => ({ value: club, label: club }))} />
      <SelectField
        label="Team"
        value={teamId}
        onChange={setTeamId}
        options={availableTeams.map((team) => ({
          value: team.teamId,
          label: `${team.teamName} - ${team.leagueName}`
        }))}
      />
      <div className="rounded-2xl bg-[#f7f5fa] p-3">
        <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Requested role</p>
        <p className="mt-1 text-base font-black text-[#37003c]">Player</p>
        <p className="mt-1 text-xs font-semibold text-[#6c5a73]">
          Manager access is assigned through backend membership management after verification.
        </p>
      </div>
      <TextAreaField label="Note to league" value={message} onChange={setMessage} />
      {status ? <p className="text-sm font-bold text-[#37003c]">{status}</p> : null}
      <Button onClick={submitRequest} disabled={busy || !name || !email || !teamId}>
        <Send className="h-4 w-4" />
        Request player invite
      </Button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <input
        className="min-h-11 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#04f5ff]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function SelectField({
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
    <label className="grid gap-1.5">
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <select
        className="min-h-11 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#04f5ff]"
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

function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <textarea
        className="min-h-24 rounded-2xl border border-[#eeeaf2] bg-white px-4 py-3 text-base font-bold outline-none focus-visible:outline-[#04f5ff]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DemoAuthNotice() {
  return (
    <div className="bg-[#00ff85] px-4 py-2 text-center text-xs font-black uppercase text-[#25002b]">
      Preview dashboard: live auth uses app-owned sessions backed by Supabase Postgres.
    </div>
  );
}

function SessionBanner({ message, label }: { message: string; label: string }) {
  return (
    <div className="bg-[#37003c] px-4 py-2 text-center text-xs font-bold text-white">
      {label}: {message}
    </div>
  );
}

function NoMemberships({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 text-[#25002b]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account needs a team</CardTitle>
          <Badge variant="muted">{email}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm font-semibold text-[#6c5a73]">
            This login is valid, but it has no active team membership yet. Ask the league to attach a team role.
          </p>
          <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
        </CardContent>
      </Card>
    </main>
  );
}
