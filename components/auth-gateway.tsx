"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, UserPlus } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [message, setMessage] = useState("");
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>(demoTeamOptions);
  const [activationInvite, setActivationInvite] = useState<ActivationInvite | null>(null);

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const testUser = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";
      const sessionUrl = testUser ? `/api/session?testUser=${encodeURIComponent(testUser)}` : "/api/session";
      const payload = await authJsonFetch<SessionPayload>(sessionUrl);
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
    const testUser = new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";
    const pageVisitUrl = testUser ? `/api/page-visit?testUser=${encodeURIComponent(testUser)}` : "/api/page-visit";
    fetch(pageVisitUrl, {
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
      activationInvite={activationInvite}
      message={message}
      onSignedIn={refreshSession}
    />
  );
}

function embeddedTestContexts(contexts: TeamContext[], teamOptions: TeamOption[], standings: Standing[]) {
  if (typeof window === "undefined") return contexts;

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1";
  const requestedRole = normalizeEmbeddedRole(params.get("role"));
  const requestedTeam = normalizeLookupKey(params.get("team"));
  const requestedClub = normalizeLookupKey(params.get("club"));
  const requestedSeason = params.get("season")?.trim() || "2026/27";
  if (!embedded || !requestedRole) return contexts;

  const existing = contexts.find((context) => {
    if (context.role !== requestedRole) return false;
    if (requestedRole === "Club Member" || requestedRole === "Club Admin") {
      return requestedClub ? normalizeLookupKey(context.club) === requestedClub : normalizeLookupKey(context.club) === "castle golf club";
    }
    return Boolean(requestedTeam) && normalizeLookupKey(context.name) === requestedTeam && context.season === requestedSeason;
  });
  if (existing) return contexts;

  if (requestedRole === "Club Member" || requestedRole === "Club Admin") {
    const clubName = requestedClub || "castle golf club";
    const club = clubTeamStructure.find((entry) => normalizeLookupKey(entry.club) === clubName);
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
    normalizeLookupKey(team.teamName) === requestedTeam &&
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

function normalizeLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
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
  activationInvite,
  message,
  onSignedIn
}: {
  mode: AuthMode;
  activationInvite: ActivationInvite | null;
  message: string;
  onSignedIn: () => void;
}) {
  const activating = mode === "activate";

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 py-6 text-[#25002b]">
      <section className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#10233f] p-1.5 shadow-card">
            <img src="/favicon.ico" alt="Interclub Snooker" className="h-full w-full rounded-lg object-contain" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Interclub Snooker</p>
            <h1 className="text-2xl font-extrabold leading-tight">{activating ? "Activate account" : "Sign in"}</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{activating ? "Invitation details" : "Existing account"}</CardTitle>
            <Badge variant={activating ? "green" : "muted"}>{activating ? "Invited user" : "Administrator set up"}</Badge>
          </CardHeader>
          <CardContent>
            {message ? (
              <div className="mb-4 rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">
                {message}
              </div>
            ) : null}
            {activating ? (
              <ActivateForm invite={activationInvite} onSignedIn={onSignedIn} />
            ) : (
              <div className="grid gap-4">
                <p className="text-sm font-semibold text-[#6c5a73]">
                  Accounts must be created by an administrator before you can sign in.
                </p>
                <AuthSignInForm onSignedIn={onSignedIn} />
              </div>
            )}
          </CardContent>
        </Card>
        {!activating ? (
          <p className="mt-4 text-center text-xs font-semibold text-[#6c5a73]">
            New users should use the invite link sent by their club or league administrator.
          </p>
        ) : null}
      </section>
    </main>
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
