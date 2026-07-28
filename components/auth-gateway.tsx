"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, KeyRound, Send, ShieldCheck, UserPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { AuthSelectField, AuthSignInForm, AuthTextAreaField, AuthTextField, GoogleAuthButton, authJsonFetch } from "@/components/auth-controls";
import { SplashScreen } from "@/components/splash-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubTeamStructure } from "@/lib/demo-data";
import type { AppearanceConfig, MatchResult, PlayerGameResult, Role, Standing, TeamContext } from "@/lib/types";

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
  standings?: Standing[];
  playerGameResults?: PlayerGameResult[];
  matchResults?: MatchResult[];
  activeMatchCount?: number;
  appearance?: AppearanceConfig;
  error?: string;
};
type ActivationInvite = {
  code: string;
  email: string;
  name: string;
  role: string;
  club: string | null;
  memberships: Array<{ team_name: string; league_name: string; role: string }>;
};

const demoTeamOptions: TeamOption[] = clubTeamStructure.flatMap((club) =>
  club.teams.map((team) => ({
    clubId: club.club,
    clubName: club.club,
    teamId: team,
    teamName: team,
    leagueName: team.endsWith("B") ? "B League" : team.endsWith("C") ? "C League" : "A League",
    seasonName: "Club setup"
  }))
);

export function AuthGateway() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [previewDashboard, setPreviewDashboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [message, setMessage] = useState("");
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>(demoTeamOptions);
  const [activationInvite, setActivationInvite] = useState<ActivationInvite | null>(null);

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const payload = await authJsonFetch<SessionPayload>("/api/session");
      setSession(payload);
      setMessage(payload.error ?? "");
    } catch (error) {
      setSession({ authenticated: false });
      setMessage(error instanceof Error ? error.message : "");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testUser = params.get("user")?.trim();
    if (testUser) {
      window.location.replace(`/home.html?user=${encodeURIComponent(testUser)}`);
      return;
    }

    refreshSession();

    const inviteCode = params.get("invite") || params.get("code");
    if (window.location.pathname === "/activate") {
      setMode("activate");
    }
    if (inviteCode) {
      setMode("activate");
      authJsonFetch<{ invitation: ActivationInvite }>(`/api/invitation?code=${encodeURIComponent(inviteCode)}`)
        .then(({ invitation }) => setActivationInvite(invitation))
        .catch((error) => setMessage(error instanceof Error ? error.message : "Invitation unavailable."));
    }

    authJsonFetch<{ teams: Array<{
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

  useEffect(() => {
    if (!session?.authenticated || !session.activeMatchCount) return;

    const poll = window.setInterval(() => {
      refreshSession({ silent: true });
    }, 60000);

    return () => window.clearInterval(poll);
  }, [refreshSession, session?.activeMatchCount, session?.authenticated]);

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
    const contexts = embeddedTestContexts(session.contexts ?? [], teamOptions, session.standings ?? []);
    if (contexts.length > 0) {
      return (
        <>
          {message ? <SessionBanner message={message} label={session.user?.name ?? session.user?.email ?? "Signed in"} /> : null}
          <AppShell
            key={session.user?.email ?? session.user?.name ?? "signed-in"}
            contexts={contexts}
            standingsData={session.standings ?? []}
            playerGameResults={session.playerGameResults ?? []}
            matchResults={session.matchResults ?? []}
            activeMatchCount={session.activeMatchCount ?? 0}
            appearance={session.appearance}
            userLabel={session.user?.name ?? session.user?.email ?? "Signed in"}
            onSignOut={signOut}
            onPageVisit={recordPageVisit}
            onDataRefresh={() => refreshSession({ silent: true })}
          />
        </>
      );
    }

    return <NoMemberships email={session.user?.name ?? session.user?.email ?? "Signed in"} onSignOut={signOut} />;
  }

  return (
    <AuthHome
      mode={mode}
      setMode={setMode}
      teamOptions={teamOptions}
      activationInvite={activationInvite}
      message={message}
      onPreviewDashboard={() => setPreviewDashboard(true)}
      onSignedIn={refreshSession}
    />
  );
}

function embeddedTestContexts(contexts: TeamContext[], teamOptions: TeamOption[], standings: Standing[]) {
  if (typeof window === "undefined") return contexts;

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1";
  const requestedRole = normalizeEmbeddedRole(params.get("role"));
  const requestedTeam = params.get("team")?.trim().toLowerCase();
  const requestedClub = params.get("club")?.trim().toLowerCase();
  const requestedSeason = params.get("season")?.trim() || "2026/27";
  if (!embedded || !requestedRole) return contexts;

  const existing = contexts.find((context) => {
    if (context.role !== requestedRole) return false;
    if (requestedRole === "Club Member" || requestedRole === "Club Admin") {
      return requestedClub ? context.club.toLowerCase() === requestedClub : context.club.toLowerCase() === "castle golf club";
    }
    return Boolean(requestedTeam) && context.name.toLowerCase() === requestedTeam && context.season === requestedSeason;
  });
  if (existing) return contexts;

  if (requestedRole === "Club Member" || requestedRole === "Club Admin") {
    const clubName = requestedClub || "castle golf club";
    const club = clubTeamStructure.find((entry) => entry.club.toLowerCase() === clubName);
    if (!club) return contexts;
    const embeddedContext: TeamContext = {
      id: `embedded-${requestedRole.toLowerCase().replace(/\s+/g, "-")}-${club.club.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      personId: contexts[0]?.personId,
      name: club.club,
      club: club.club,
      logoPath: club.logoPath,
      primaryColor: club.primaryColor,
      accentColor: club.accentColor,
      league: "A League",
      season: "Club",
      role: requestedRole,
      leaguePosition: 0,
      leagueMatchesPlayed: 0
    };
    return [embeddedContext, ...contexts];
  }

  if (!requestedTeam) return contexts;
  const option = teamOptions.find((team) =>
    team.teamName.toLowerCase() === requestedTeam &&
    team.seasonName === requestedSeason
  );
  if (!option || !/^[0-9a-f-]{36}$/i.test(option.teamId)) return contexts;

  const club = clubTeamStructure.find((entry) => entry.club === option.clubName);
  const standing = standings.find((row) =>
    row.team === option.teamName &&
    row.league === option.leagueName &&
    row.season === option.seasonName
  );
  const embeddedContext: TeamContext = {
    id: `embedded-${requestedRole.toLowerCase().replace(/\s+/g, "-")}-${option.teamId}`,
    personId: contexts[0]?.personId,
    teamId: option.teamId,
    name: option.teamName,
    club: option.clubName,
    logoPath: club?.logoPath ?? "/favicon.ico",
    primaryColor: club?.primaryColor ?? "#10233F",
    accentColor: club?.accentColor ?? "#1B8A72",
    league: option.leagueName as TeamContext["league"],
    season: option.seasonName,
    role: requestedRole,
    leaguePosition: standing?.position ?? 0,
    leagueMatchesPlayed: standing?.played ?? 0,
    matchesWon: standing?.won ?? 0,
    matchesLost: standing?.lost ?? 0,
    pointsFor: standing?.pointsFor ?? 0,
    pointsAgainst: standing?.pointsAgainst ?? 0,
    leaguePoints: standing?.leaguePoints ?? 0
  };

  return [embeddedContext, ...contexts];
}

function normalizeEmbeddedRole(value: string | null): Role | null {
  const role = value?.trim().toLowerCase();
  if (role === "manager") return "Manager";
  if (role === "player") return "Player";
  if (role === "assistant manager" || role === "assistant") return "Assistant Manager";
  if (role === "club member" || role === "member") return "Club Member";
  if (role === "club admin" || role === "club administrator") return "Club Admin";
  return null;
}

function AuthHome({
  mode,
  setMode,
  teamOptions,
  activationInvite,
  message,
  onPreviewDashboard,
  onSignedIn
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  teamOptions: TeamOption[];
  activationInvite: ActivationInvite | null;
  message: string;
  onPreviewDashboard: () => void;
  onSignedIn: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <section className="mx-auto grid min-h-screen w-full max-w-[1180px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_460px] lg:items-center lg:px-10">
        <div className="rounded-[18px] bg-[#10233f] p-5 text-white shadow-elevated sm:p-7">
          <Badge variant="cyan">Player access</Badge>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
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
            {message ? (
              <div className="mb-4 rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">
                {message}
              </div>
            ) : null}
            <div className="mb-4 grid grid-cols-3 rounded-xl bg-[#eeeaf2] p-1">
              {(["signin", "activate", "request"] as AuthMode[]).map((item) => (
                <button
                  key={item}
                  className={`min-h-11 rounded-lg text-sm font-bold ${mode === item ? "bg-[#10233f] text-white" : "text-[#25002b]"}`}
                  onClick={() => setMode(item)}
                >
                  {item === "signin" ? "Sign in" : item === "activate" ? "Activate" : "Request"}
                </button>
              ))}
            </div>
            {mode === "signin" ? (
              <AuthSignInForm onSignedIn={onSignedIn} />
            ) : mode === "activate" ? (
              <ActivateForm invite={activationInvite} onSignedIn={onSignedIn} />
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
      <Icon className="h-5 w-5 text-[#7bc7d6]" />
      <p className="mt-2 text-sm font-bold">{label}</p>
    </div>
  );
}

function ActivateForm({ invite, onSignedIn }: { invite: ActivationInvite | null; onSignedIn: () => void }) {
  const [email, setEmail] = useState(invite?.email ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!invite) return;
    setEmail(invite.email);
    setUsername(invite.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, "") || "");
  }, [invite]);

  async function activateWithPassword() {
    setBusy(true);
    setMessage("");
    try {
      await authJsonFetch("/api/activate", {
        method: "POST",
        body: JSON.stringify({ email, username, password, invitationCode: invite?.code })
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
      {invite ? (
        <div className="rounded-2xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-bold uppercase text-[#6c5a73]">Invitation</p>
          <p className="mt-1 text-base font-extrabold text-[#25002b]">{invite.name}</p>
          <p className="text-sm font-bold text-[#6c5a73]">{invite.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="cyan">{invite.club ?? "Club"}</Badge>
            {invite.memberships.map((membership) => (
              <Badge key={`${membership.team_name}-${membership.role}`} variant="muted">
                {membership.team_name} - {membership.role}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <AuthTextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" disabled={Boolean(invite)} />
      <AuthTextField label="User ID" value={username} onChange={setUsername} autoComplete="username" />
      <AuthTextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      {message ? <p className="text-sm font-bold text-[#10233f]">{message}</p> : null}
      <Button onClick={activateWithPassword} disabled={busy || !email || !username || !password}>
        <UserPlus className="h-4 w-4" />
        Create account
      </Button>
      <GoogleAuthButton
        label="Sign in with Google"
        href={invite ? `/auth/google?next=${encodeURIComponent(`/activate?invite=${invite.code}`)}` : "/auth/google"}
      />
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
      await authJsonFetch("/api/request-invite", {
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
      <AuthTextField label="Full name" value={name} onChange={setName} autoComplete="name" />
      <AuthTextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
      <AuthSelectField label="Club" value={clubName} onChange={setClubName} options={clubNames.map((club) => ({ value: club, label: club }))} />
      <AuthSelectField
        label="Team"
        value={teamId}
        onChange={setTeamId}
        options={availableTeams.map((team) => ({
          value: team.teamId,
          label: `${team.teamName} - ${team.leagueName}`
        }))}
      />
      <div className="rounded-2xl bg-[#f7f5fa] p-3">
        <p className="text-xs font-bold uppercase text-[#6c5a73]">Requested role</p>
        <p className="mt-1 text-base font-extrabold text-[#10233f]">Player</p>
        <p className="mt-1 text-xs font-semibold text-[#6c5a73]">
          Manager access is assigned through backend membership management after verification.
        </p>
      </div>
      <AuthTextAreaField label="Note to league" value={message} onChange={setMessage} />
      {status ? <p className="text-sm font-bold text-[#10233f]">{status}</p> : null}
      <Button onClick={submitRequest} disabled={busy || !name || !email || !teamId}>
        <Send className="h-4 w-4" />
        Request player invite
      </Button>
    </div>
  );
}

function DemoAuthNotice() {
  return (
    <div className="bg-[#00ff85] px-4 py-2 text-center text-xs font-bold uppercase text-[#25002b]">
      Preview dashboard: live auth uses app-owned sessions backed by Supabase Postgres.
    </div>
  );
}

function SessionBanner({ message, label }: { message: string; label: string }) {
  return (
    <div className="bg-[#10233f] px-4 py-2 text-center text-xs font-bold text-white">
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
