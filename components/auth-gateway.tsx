"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, Eye, KeyRound, LogIn, Mail, Send, ShieldCheck, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SplashScreen } from "@/components/splash-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubTeamStructure } from "@/lib/demo-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Role, TeamContext } from "@/lib/types";

type AuthMode = "signin" | "activate" | "request";
type TeamOption = {
  clubId: string;
  clubName: string;
  teamId: string;
  teamName: string;
  leagueName: string;
  seasonName: string;
};
type TeamOptionRow = {
  club_id: string;
  club_name: string;
  team_id: string;
  team_name: string;
  league_name: string;
  season_name: string;
};
type UserContextRow = {
  membership_id: string;
  role: string;
  team_name: string;
  club_name: string;
  logo_path: string;
  primary_color: string;
  league_name: TeamContext["league"];
  season_name: string;
};

const pendingInviteKey = "interclub-pending-invitation";
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

export function AuthGateway() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [previewDashboard, setPreviewDashboard] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [message, setMessage] = useState("");
  const [contexts, setContexts] = useState<TeamContext[]>([]);
  const [contextsLoading, setContextsLoading] = useState(false);
  const [contextsRefreshKey, setContextsRefreshKey] = useState(0);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>(demoTeamOptions);
  const loggedSessionIdRef = useRef<string | null>(null);
  const loggedVisitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.rpc("player_invite_team_options").then(({ data, error }) => {
      if (error || !data) return;

      setTeamOptions((data as TeamOptionRow[]).map((row) => ({
        clubId: row.club_id,
        clubName: row.club_name,
        teamId: row.team_id,
        teamName: row.team_name,
        leagueName: row.league_name,
        seasonName: row.season_name
      })));
    });
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;

    const pending = window.localStorage.getItem(pendingInviteKey);
    if (!pending) return;

    const { invitationCode, username } = JSON.parse(pending) as {
      invitationCode: string;
      username: string;
    };

    supabase.rpc("accept_invitation_for_current_user", {
      invitation_code_input: invitationCode,
      username_input: username
    }).then(({ error }) => {
      if (error) {
        setMessage(error.message);
        return;
      }

      window.localStorage.removeItem(pendingInviteKey);
      setMessage("Account activated. Your club and team roles are ready.");
      setContextsRefreshKey((key) => key + 1);
    });
  }, [session]);

  useEffect(() => {
    if (!supabase || !session) {
      setContexts([]);
      return;
    }

    setContextsLoading(true);
    supabase
      .from("user_team_context_view")
      .select("membership_id, role, team_name, club_name, logo_path, primary_color, league_name, season_name")
      .eq("auth_user_id", session.user.id)
      .then(({ data, error }) => {
        setContextsLoading(false);
        if (error || !data) {
          setMessage(error?.message ?? "");
          setContexts([]);
          return;
        }

        setContexts((data as UserContextRow[]).map((row) => ({
          id: row.membership_id,
          name: row.team_name,
          club: row.club_name,
          logoPath: row.logo_path,
          primaryColor: row.primary_color,
          league: row.league_name,
          season: row.season_name,
          role: row.role as Role,
          leaguePosition: 0
        } as TeamContext)));
      });
  }, [session, contextsRefreshKey]);

  useEffect(() => {
    if (!supabase || !session || loggedSessionIdRef.current === session.access_token) return;

    loggedSessionIdRef.current = session.access_token;
    supabase.rpc("record_user_login", {
      user_agent_input: window.navigator.userAgent,
      metadata_input: { provider: session.user.app_metadata.provider ?? "password" }
    });
  }, [session]);

  const recordPageVisit = useCallback((pageLabel: string, activeTeam: TeamContext) => {
    if (!supabase || !session) return;

    const visitKey = `${session.user.id}:${window.location.pathname}:${pageLabel}:${activeTeam.id}`;
    if (loggedVisitKeyRef.current === visitKey) return;

    loggedVisitKeyRef.current = visitKey;
    supabase.rpc("record_page_visit", {
      page_path_input: window.location.pathname,
      page_label_input: pageLabel,
      user_agent_input: window.navigator.userAgent,
      metadata_input: {
        team_context_id: activeTeam.id,
        team_name: activeTeam.name,
        role: activeTeam.role
      }
    });
  }, [session]);

  const signedInLabel = useMemo(() => session?.user.email ?? "Signed in", [session]);

  if (loading) return <SplashScreen />;

  if (!isSupabaseConfigured && previewDashboard) {
    return (
      <>
        <DemoAuthNotice />
        <AppShell />
      </>
    );
  }

  if (session) {
    return (
      <>
        {message ? <SessionBanner message={message} label={signedInLabel} /> : null}
        {contexts.length > 0 ? (
          <AppShell
            contexts={contexts}
            userLabel={signedInLabel}
            onSignOut={() => supabase?.auth.signOut()}
            onPageVisit={recordPageVisit}
          />
        ) : contextsLoading ? (
          <SplashScreen />
        ) : (
          <NoMemberships email={signedInLabel} onSignOut={() => supabase?.auth.signOut()} />
        )}
      </>
    );
  }

  return (
    <AuthHome
      mode={mode}
      setMode={setMode}
      teamOptions={teamOptions}
      demo={!isSupabaseConfigured}
      onPreviewDashboard={() => setPreviewDashboard(true)}
    />
  );
}

function AuthHome({
  mode,
  setMode,
  teamOptions,
  demo,
  onPreviewDashboard
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  teamOptions: TeamOption[];
  demo: boolean;
  onPreviewDashboard: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      {demo ? <DemoAuthNotice /> : null}
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
            <AuthFeature icon={KeyRound} label="Google or password" />
          </div>
          {demo ? (
            <Button className="mt-6" variant="secondary" onClick={onPreviewDashboard}>
              <Eye className="h-4 w-4" />
              Preview dashboard
            </Button>
          ) : null}
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
              <button
                className={`min-h-11 rounded-full text-sm font-black ${mode === "signin" ? "bg-[#37003c] text-white" : "text-[#25002b]"}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                className={`min-h-11 rounded-full text-sm font-black ${mode === "activate" ? "bg-[#37003c] text-white" : "text-[#25002b]"}`}
                onClick={() => setMode("activate")}
              >
                Activate
              </button>
              <button
                className={`min-h-11 rounded-full text-sm font-black ${mode === "request" ? "bg-[#37003c] text-white" : "text-[#25002b]"}`}
                onClick={() => setMode("request")}
              >
                Request
              </button>
            </div>
            {mode === "signin" ? <SignInForm /> : mode === "activate" ? <ActivateForm /> : <RequestInviteForm teamOptions={teamOptions} demo={demo} />}
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

function SignInForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signInWithPassword() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const email = identifier.includes("@")
      ? identifier
      : await resolveUsername(identifier);

    if (!email) {
      setBusy(false);
      setMessage("No account found for that user ID.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setMessage("Google login needs Supabase Auth configured with the Google provider.");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });
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
      <Button variant="secondary" onClick={signInWithGoogle}>
        <Mail className="h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}

function ActivateForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function activateWithPassword() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          invitation_code: invitationCode
        }
      }
    });

    if (signUpError) {
      setBusy(false);
      setMessage(signUpError.message);
      return;
    }

    if (!data.session) {
      window.localStorage.setItem(pendingInviteKey, JSON.stringify({ invitationCode, username }));
      setBusy(false);
      setMessage("Check your email to confirm the account, then sign in to finish activation.");
      return;
    }

    const { error: rpcError } = await supabase.rpc("accept_invitation_for_current_user", {
      invitation_code_input: invitationCode,
      username_input: username
    });

    setBusy(false);
    setMessage(rpcError ? rpcError.message : "Account activated. You can now sign in.");
  }

  async function activateWithGoogle() {
    if (!supabase) {
      setMessage("Google activation needs Supabase Auth configured with the Google provider.");
      return;
    }

    window.localStorage.setItem(pendingInviteKey, JSON.stringify({ invitationCode, username }));
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          login_hint: email
        }
      }
    });
  }

  return (
    <div className="grid gap-3">
      <TextField label="Invitation code" value={invitationCode} onChange={setInvitationCode} autoComplete="one-time-code" />
      <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
      <TextField label="User ID" value={username} onChange={setUsername} autoComplete="username" />
      <TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      {message ? <p className="text-sm font-bold text-[#37003c]">{message}</p> : null}
      <Button onClick={activateWithPassword} disabled={busy || !email || !username || !password || !invitationCode}>
        <UserPlus className="h-4 w-4" />
        Create account
      </Button>
      <Button variant="secondary" onClick={activateWithGoogle} disabled={!email || !username || !invitationCode}>
        <Mail className="h-4 w-4" />
        Activate with Google
      </Button>
    </div>
  );
}

function RequestInviteForm({ teamOptions, demo }: { teamOptions: TeamOption[]; demo: boolean }) {
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

    if (demo) {
      setBusy(false);
      setStatus("Demo request captured. In live mode this goes to the league review queue.");
      return;
    }

    if (!supabase) return;

    const { error } = await supabase.rpc("request_player_invitation", {
      requested_person_name_input: name,
      email_input: email,
      team_id_input: teamId,
      message_input: message
    });

    setBusy(false);
    setStatus(error ? error.message : "Request sent. The league will review it and send an invite if approved.");
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

async function resolveUsername(username: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("resolve_login_identifier", {
    login_identifier: username
  });

  if (error || !data) return null;
  return data as string;
}

function DemoAuthNotice() {
  return (
    <div className="bg-[#00ff85] px-4 py-2 text-center text-xs font-black uppercase text-[#25002b]">
      Demo mode: add Supabase env vars to enable real invite-only accounts.
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
            This login is valid, but it has no active team membership yet. Activate an invitation code, or ask the league to attach a team role.
          </p>
          <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
        </CardContent>
      </Card>
    </main>
  );
}
