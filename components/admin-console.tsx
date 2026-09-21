"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Eye, FileSpreadsheet, KeyRound, LayoutPanelTop, LogOut, Mail, PlusCircle, ShieldCheck, Smartphone, Trash2, Trophy, UserPlus, Users, XCircle } from "lucide-react";
import { AuthSignInForm } from "@/components/auth-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appearancePanelOptions, defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import { clubTeamStructure } from "@/lib/demo-data";
import type { AppearanceConfig, AppearancePanelId, Role as AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminTab = "desktop" | "competitions" | "people" | "invites" | "permissions" | "appearance" | "logs";
type TeamRole = "Player" | "Manager" | "Assistant Manager";
type InviteRole = "Player" | "Manager" | "Club Member" | "Club Admin";
type TeamOption = {
  teamId: string;
  clubId: string;
  teamName: string;
  clubName: string;
  leagueName: string;
};
type ClubOption = {
  clubId: string;
  clubName: string;
};
type PersonOption = {
  personId: string;
  name: string;
  email: string;
  phone?: string;
  accountId?: string | null;
  username?: string | null;
  loginActive?: boolean | null;
  lastLogin?: string | null;
  invitationId?: string | null;
  inviteStatus?: string | null;
  invitedAt?: string | null;
  inviteSentAt?: string | null;
  inviteAcceptedAt?: string | null;
  admin?: boolean;
  clubHandicaps?: Array<{ club_id: string; club_name: string; handicap: number | string | null }>;
  clubAdmins?: Array<{ club_id: string; club_name: string }>;
};
type InviteRoleRow = {
  id: string;
  role: InviteRole;
  teamId: string;
};
type ParsedInviteRow = {
  name: string;
  email: string;
  phone: string;
  club: string;
  role: InviteRole;
  team: string;
  administrator: boolean;
  sendInvite: boolean;
  clubId?: string;
  teamId?: string;
  error?: string;
};
type ActivityRow = {
  id: string;
  activity_type: string;
  page_label: string | null;
  page_path: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  personId?: string | null;
  person?: { first_name: string; last_name: string; email: string | null } | null;
};
type LogPersonOption = {
  person_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};
type InviteRequestRow = {
  id: string;
  requested_person_name: string;
  email: string;
  status: string;
  message: string | null;
  created_at: string;
};
type InviteRow = {
  id: string;
  email: string;
  invited_person_name: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  invite_administrator: boolean;
  club_name: string | null;
  roles: Array<{ role: string; team_name: string; league_name: string }>;
};
type AdminCompetitionRow = {
  id: string;
  name: string;
  competition_type: string;
  status: string;
  entry_closes_at: string;
  created_at: string;
  club_name: string;
  entrant_count: number;
  round_count: number;
  match_count: number;
};
type AdminCompetitionDetail = {
  id: string;
  name: string;
  clubName: string;
  competitionType: string;
  entryClosesAt: string;
  status: string;
  roundSettingsConfirmed: boolean;
  entrantCount: number;
  entries: Array<{ id: string; playerName: string; handicap: number | null; status: string }>;
  rounds: Array<{ id: string; name: string; roundNumber: number; playByDate: string; framesToPlay: number }>;
  matches: Array<{ id: string; roundName: string; matchNumber: number; player1Name: string; player2Name: string; status: string; isPlaceholder?: boolean }>;
};
type AdminUser = {
  email: string;
  name: string;
};

const roles: TeamRole[] = ["Player", "Manager", "Assistant Manager"];
const inviteRoles: InviteRole[] = ["Player", "Manager", "Club Member", "Club Admin"];
const rolesWithClubMember: AppRole[] = ["Player", "Manager", "Assistant Manager", "Club Member", "Club Admin"];
const clubLevelInviteRoles: InviteRole[] = ["Club Member", "Club Admin"];
const demoTeams: TeamOption[] = clubTeamStructure.flatMap((club) =>
  club.teams.map((team) => ({
    teamId: team,
    clubId: club.club,
    teamName: team,
    clubName: club.club,
    leagueName: team.endsWith("B") ? "B League" : team.endsWith("C") ? "C League" : "A League"
  }))
);
const demoPeople: PersonOption[] = [
  { personId: "person-garry", name: "Garry Lyons", email: "garry@example.com" },
  { personId: "person-andrew", name: "Andrew Foley", email: "andrew@example.com" },
  { personId: "person-conor", name: "Conor O'Boyle", email: "conor@example.com" }
];
const demoLogs: ActivityRow[] = [
  {
    id: "log-1",
    activity_type: "Login",
    page_label: null,
    page_path: null,
    created_at: new Date().toISOString(),
    metadata: { provider: "password" },
    person: { first_name: "Garry", last_name: "Lyons", email: "garry@example.com" }
  },
  {
    id: "log-2",
    activity_type: "Page Visit",
    page_label: "Home",
    page_path: "/",
    created_at: new Date().toISOString(),
    metadata: { team_name: "Castle A", role: "Player" },
    person: { first_name: "Andrew", last_name: "Foley", email: "andrew@example.com" }
  }
];

function logPersonName(log: ActivityRow) {
  if (!log.person) return "Unknown user";
  const name = `${log.person.first_name ?? ""} ${log.person.last_name ?? ""}`.trim();
  return name || log.person.email || "Unknown user";
}

function formatAdminLogTime(value: string) {
  return new Date(value).toLocaleString("en-IE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function metadataText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function activityLabel(activityType: string) {
  if (activityType === "Page Visit") return "Page visit";
  if (activityType === "Login") return "Login";
  return activityType.replace(/_/g, " ");
}

function activitySummary(log: ActivityRow) {
  if (log.activity_type === "Page Visit") {
    return `Visited ${log.page_label || log.page_path || "the app"}`;
  }
  if (log.activity_type === "Login") {
    const provider = metadataText(log.metadata?.provider);
    return `Signed in${provider ? ` with ${provider === "google" ? "Google" : provider}` : ""}`;
  }
  return activityLabel(log.activity_type);
}

function activityContext(log: ActivityRow) {
  const teamName = metadataText(log.metadata?.team_name);
  const role = metadataText(log.metadata?.role);
  const pagePath = log.page_path && log.page_path !== "/" ? log.page_path : "";
  const pieces = [
    teamName && role ? `${teamName} - ${role}` : teamName || role,
    pagePath
  ].filter(Boolean);
  return pieces.length ? pieces.join(" - ") : "Session activity";
}

function activityBadgeVariant(log: ActivityRow): "cyan" | "green" | "muted" {
  if (log.activity_type === "Page Visit") return "cyan";
  if (log.activity_type === "Login") return "green";
  return "muted";
}

function activityArea(log: ActivityRow) {
  if (log.activity_type === "Login") return "Login";
  return log.page_label || log.page_path || activityLabel(log.activity_type);
}

function compactActivityLine(log: ActivityRow) {
  const area = activityArea(log);
  const context = activityContext(log);
  if (log.activity_type === "Page Visit") {
    return context === "Session activity" ? area : `${area} - ${context}`;
  }
  return activitySummary(log);
}

function logPersonOptionName(person: LogPersonOption) {
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || person.email || "Unknown user";
}

function isoDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("desktop");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminDataLoaded, setAdminDataLoaded] = useState(false);
  const [administrator, setAdministrator] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>(demoTeams);
  const [people, setPeople] = useState<PersonOption[]>(demoPeople);
  const [logs, setLogs] = useState<ActivityRow[]>(demoLogs);
  const [requests, setRequests] = useState<InviteRequestRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [competitions, setCompetitions] = useState<AdminCompetitionRow[]>([]);
  const [appearance, setAppearance] = useState<AppearanceConfig>(defaultAppearanceConfig);

  useEffect(() => {
    refreshAdminData();
  }, []);

  async function refreshAdminData(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    try {
      const response = await fetchWithTimeout("/api/admin", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      setAuthenticated(Boolean(data.authenticated));
      setAdministrator(Boolean(data.administrator));
      setAdminUser(data.user ? {
        email: data.user.email ?? "",
        name: data.user.name ?? data.user.email ?? "Signed in"
      } : null);

      if (response.ok) {
        setAdminDataLoaded(true);
        setTeams((data.teams ?? []).map((team: { club_id: string; team_id: string; team_name: string; club_name: string; league_name: string }) => ({
          teamId: team.team_id,
          clubId: team.club_id,
          teamName: team.team_name,
          clubName: team.club_name,
          leagueName: team.league_name
        })));

        const seen = new Map<string, PersonOption>();
        for (const person of data.people ?? []) {
          seen.set(person.person_id, {
            personId: person.person_id,
            name: `${person.first_name} ${person.last_name}`.trim(),
            email: person.email ?? "",
            phone: person.phone ?? "",
            accountId: person.account_id ?? null,
            username: person.username ?? null,
            loginActive: person.login_active ?? null,
            lastLogin: person.last_login ?? null,
            invitationId: person.invitation_id ?? null,
            inviteStatus: person.invite_status ?? null,
            invitedAt: person.invited_at ?? null,
            inviteSentAt: person.invite_sent_at ?? null,
            inviteAcceptedAt: person.invite_accepted_at ?? null,
            clubHandicaps: person.club_handicaps ?? [],
            clubAdmins: person.club_admins ?? [],
            admin: Boolean(person.admin)
          });
        }
        setPeople(Array.from(seen.values()));
        setLogs(data.logs ?? []);
        setRequests(data.requests ?? []);
        setInvites(data.invites ?? []);
        setCompetitions(data.competitions ?? []);
        setAppearance(normalizeAppearanceConfig(data.appearance ?? defaultAppearanceConfig));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin data unavailable.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      setAuthenticated(false);
      setAdministrator(false);
      setAdminUser(null);
      setAdminDataLoaded(false);
      setMessage("Signed out.");
      window.location.assign("/admin");
    }
  }

  if (loading) {
    return <AdminShell title="Loading admin" subtitle="Checking your session." />;
  }

  if (!authenticated) {
    return <AdminLogin onSignedIn={refreshAdminData} />;
  }

  if (!administrator) {
    return <AdminShell title="No administrator access" subtitle="Your account is signed in, but it has not been granted administrator access." onLogout={logout} />;
  }

  return (
    <AdminLayout tab={tab} setTab={setTab} message={message} adminUser={adminUser} onLogout={logout}>
      <AdminTabPanel tab={tab} teams={teams} people={people} logs={logs} requests={requests} invites={invites} competitions={competitions} competitionsLoading={!adminDataLoaded} appearance={appearance} onAppearanceChange={setAppearance} onMessage={setMessage} onRefresh={() => refreshAdminData({ silent: true })} />
    </AdminLayout>
  );
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000) {
  return Promise.race([
    fetch(input, init),
    new Promise<Response>((_, reject) => {
      window.setTimeout(() => reject(new Error("Admin data request timed out.")), timeoutMs);
    })
  ]);
}

function AdminLayout({
  tab,
  setTab,
  message,
  adminUser,
  onLogout,
  children
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  message: string;
  adminUser: AdminUser | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <header className="bg-[#10233f] px-4 py-5 text-white shadow-elevated sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-white/65">League operations</p>
            <h1 className="text-2xl font-extrabold leading-tight">Admin console</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Badge variant="cyan">Administrator</Badge>
              {adminUser ? <p className="max-w-[220px] truncate text-sm font-bold text-white/80">{adminUser.name}</p> : null}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-extrabold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>
      <section className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-10">
        <aside className="flex min-w-0 gap-2 overflow-x-auto rounded-[18px] bg-white p-2 shadow-card lg:sticky lg:top-4 lg:block lg:self-start lg:overflow-visible">
          {[
            { id: "desktop" as const, label: "Dashboard", icon: LayoutPanelTop },
            { id: "competitions" as const, label: "Competitions", icon: Trophy },
            { id: "people" as const, label: "People", icon: UserPlus },
            { id: "invites" as const, label: "Invites", icon: KeyRound },
            { id: "permissions" as const, label: "Permissions", icon: Users },
            { id: "appearance" as const, label: "Appearance", icon: LayoutPanelTop },
            { id: "logs" as const, label: "Logs", icon: Activity }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-4 text-sm font-bold lg:w-full ${tab === item.id ? "bg-[#10233f] text-white" : "text-[#25002b]"}`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </aside>
        <div className="grid min-w-0 gap-4">
          {message ? <div className="rounded-xl bg-[#00ff85] px-4 py-3 text-sm font-bold text-[#25002b]">{message}</div> : null}
          {children}
        </div>
      </section>
    </main>
  );
}

function AdminTabPanel(props: {
  tab: AdminTab;
  teams: TeamOption[];
  people: PersonOption[];
  logs: ActivityRow[];
  requests: InviteRequestRow[];
  invites: InviteRow[];
  competitions: AdminCompetitionRow[];
  competitionsLoading: boolean;
  appearance: AppearanceConfig;
  demo?: boolean;
  onAppearanceChange: (appearance: AppearanceConfig) => void;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  if (props.tab === "desktop") return <DesktopAdminPanel teams={props.teams} people={props.people} requests={props.requests} logs={props.logs} onMessage={props.onMessage} onRefresh={props.onRefresh} />;
  if (props.tab === "competitions") return <CompetitionsAdminPanel competitions={props.competitions} loading={props.competitionsLoading} onMessage={props.onMessage} onRefresh={props.onRefresh} />;
  if (props.tab === "people") return <PeoplePanel {...props} />;
  if (props.tab === "permissions") return <PermissionsPanel {...props} />;
  if (props.tab === "appearance") return <AppearancePanel {...props} />;
  if (props.tab === "logs") return <LogsPanel logs={props.logs} />;
  return <InvitesPanel {...props} />;
}

function DesktopAdminPanel({
  teams,
  people,
  requests,
  logs,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  people: PersonOption[];
  requests: InviteRequestRow[];
  logs: ActivityRow[];
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const admins = people.filter((person) => person.admin).length;
  const clubs = uniqueClubs(teams).length;
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function resetMatchData() {
    setResetting(true);
    try {
      const response = await fetch("/api/admin/reset-2026-27-match-data", {
        method: "POST",
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not reset 2026/27 match data.");
      const reset = data.reset ?? {};
      onMessage(
        `2026/27 test data cleared: ${reset.games_deleted ?? 0} games, ${reset.breaks_deleted ?? 0} breaks, ${reset.fixture_lineups_deleted ?? 0} lineups. Fixtures kept.`
      );
      setResetOpen(false);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not reset 2026/27 match data.");
    } finally {
      setResetting(false);
    }
  }

  async function generateSeasonResults() {
    setGenerating(true);
    try {
      const response = await fetch("/api/admin/generate-2026-27-results", {
        method: "POST",
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not generate 2026/27 results.");
      const result = data.result ?? {};
      onMessage(
        `2026/27 generated: ${result.fixtures_completed ?? 0} fixtures, ${result.games ?? 0} games, ${result.breaks ?? 0} breaks. SQL stored in ${data.sqlFile ?? "supabase/simulate_2026_27_results.sql"}.`
      );
      setGenerateOpen(false);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not generate 2026/27 results.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Platform administration</CardTitle>
            <Badge variant="cyan">Desktop console</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetric label="Clubs" value={clubs} />
            <AdminMetric label="Teams" value={teams.length} />
            <AdminMetric label="People" value={people.length} />
            <AdminMetric label="Admins" value={admins} />
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Admin flow</CardTitle>
              <Badge variant="green">Ready</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                "Add people without creating logins",
                "Create branded invites with multiple role rows",
                "Grant administrator access to any person",
                "Control each role's home panels and menus"
              ].map((item) => (
                <div key={item} className="rounded-xl bg-[#f7f5fa] px-4 py-3 text-sm font-bold text-[#10233f]">{item}</div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2026/27 test data</CardTitle>
              <Badge variant="muted">2026/27</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
                Generate or clear simulated match results, lineups, games and breaks for 2026/27. Fixtures and weekly schedules stay in place.
              </p>
              <Button className="w-full justify-center" onClick={() => setGenerateOpen(true)}>
                <Trophy className="h-4 w-4" />
                Generate 2026/27 results
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => setResetOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Clear 2026/27 test results
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent logs</CardTitle>
              <Badge variant="muted">{logs.length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-xl bg-[#f7f5fa] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#10233f]">{activitySummary(log)}</p>
                      <p className="truncate text-xs font-semibold text-[#6c5a73]">{logPersonName(log)} - {activityContext(log)}</p>
                    </div>
                    <Badge variant={activityBadgeVariant(log)}>{activityLabel(log.activity_type)}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#6c5a73]">{formatAdminLogTime(log.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invite requests</CardTitle>
          <Badge variant="muted">{requests.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(requests.length ? requests : [{ id: "no-requests", requested_person_name: "No pending requests", email: "New requests will appear here", status: "Clear", message: null, created_at: new Date().toISOString() }]).slice(0, 8).map((request) => (
            <div key={request.id} className="rounded-xl bg-[#f7f5fa] p-3">
              <p className="font-extrabold">{request.requested_person_name}</p>
              <p className="text-xs font-bold text-[#6c5a73]">{request.email}</p>
              <Badge variant={request.status === "Pending" ? "cyan" : "muted"}>{request.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      {resetOpen ? (
        <ConfirmResetMatchDataModal
          busy={resetting}
          onCancel={() => setResetOpen(false)}
          onConfirm={resetMatchData}
        />
      ) : null}
      {generateOpen ? (
        <ConfirmGenerateMatchDataModal
          busy={generating}
          onCancel={() => setGenerateOpen(false)}
          onConfirm={generateSeasonResults}
        />
      ) : null}
    </div>
  );
}

function CompetitionsAdminPanel({
  competitions,
  loading,
  onMessage,
  onRefresh
}: {
  competitions: AdminCompetitionRow[];
  loading: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [competitionDetail, setCompetitionDetail] = useState<AdminCompetitionDetail | null>(null);
  const [competitionLoading, setCompetitionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCompetitionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCompetitionDetail(competitionId: string) {
    setCompetitionLoading(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load competition.");
      setSelectedCompetitionId(competitionId);
      setCompetitionDetail(data.competition);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not load competition.");
    } finally {
      setCompetitionLoading(false);
    }
  }

  function returnToCompetitionList() {
    setSelectedCompetitionId("");
    setCompetitionDetail(null);
  }

  async function createAutoCastleCompetition() {
    try {
      const response = await fetch("/api/admin/competitions/auto-castle", {
        method: "POST",
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create auto competition.");
      onMessage(`${data.competitionName} created with ${data.players?.length ?? 8} Castle entrants. Entries close ${data.entryClosesAt}.`);
      onRefresh();
      if (data.competitionId) loadCompetitionDetail(data.competitionId);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not create auto competition.");
    }
  }

  async function deleteCompetition() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/competitions/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete competition.");
      if (selectedCompetitionId === deleteTarget.id) {
        setSelectedCompetitionId("");
        setCompetitionDetail(null);
      }
      onMessage(`${data.name ?? deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not delete competition.");
    } finally {
      setDeleting(false);
    }
  }

  async function removeCompetitionEntry(entryId: string) {
    if (!competitionDetail) return;
    try {
      const response = await fetch(`/api/competitions/${competitionDetail.id}/entries`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not remove player.");
      setCompetitionDetail(data.competition);
      onMessage("Player removed from competition.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not remove player.");
    }
  }

  async function runCompetitionDraw() {
    if (!competitionDetail) return;
    try {
      const response = await fetch(`/api/competitions/${competitionDetail.id}/draw`, {
        method: "POST",
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not run draw.");
      setCompetitionDetail(data.competition);
      onMessage("Draw created.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not run draw.");
    }
  }

  async function saveCompetitionRoundSetup(rounds: Array<{ id: string; framesToPlay: number; playByDate: string }>) {
    if (!competitionDetail) return;
    try {
      const response = await fetch(`/api/admin/competitions/${competitionDetail.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rounds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update round setup.");
      onMessage("Round setup saved.");
      await loadCompetitionDetail(competitionDetail.id);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update round setup.");
    }
  }

  if (selectedCompetitionId || competitionLoading) {
    return (
      <div className="grid min-w-0 gap-4">
        <AdminCompetitionDetailCard
          competition={competitionDetail}
          loading={competitionLoading}
          selectedCompetitionId={selectedCompetitionId}
          onBack={returnToCompetitionList}
          onRemoveEntry={removeCompetitionEntry}
          onRunDraw={runCompetitionDraw}
          onSaveRoundSetup={saveCompetitionRoundSetup}
        />
        {deleteTarget ? (
          <ConfirmDeleteCompetitionModal
            competition={deleteTarget}
            busy={deleting}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={deleteCompetition}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Competitions</CardTitle>
            <Badge variant="muted">{competitions.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] sm:grid-cols-[1fr_auto] sm:items-center">
              <p className="text-sm font-semibold text-[#6c5a73]">
                Manage club competitions, entrants, draws, round dates and results from this screen.
              </p>
              <Button onClick={createAutoCastleCompetition}>
                <PlusCircle className="h-4 w-4" />
                Auto-create Castle competition
              </Button>
            </div>
            {competitions.map((competition) => (
              <div key={competition.id} className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-extrabold leading-tight text-[#10233f]">{competition.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-[#6c5a73]">{competition.club_name}</p>
                  </div>
                  <Badge variant={competition.status === "Drawn" ? "cyan" : competition.status === "Open" ? "green" : "muted"}>
                    {competition.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">{competition.competition_type}</Badge>
                  <Badge variant="muted">Closes {formatAdminDate(competition.entry_closes_at)}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <AdminMiniMetric label="Entrants" value={competition.entrant_count} />
                  <AdminMiniMetric label="Rounds" value={competition.round_count} />
                  <AdminMiniMetric label="Matches" value={competition.match_count} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="w-full justify-center" onClick={() => loadCompetitionDetail(competition.id)}>
                    <Trophy className="h-4 w-4" />
                    Manage
                  </Button>
                  <Button className="w-full justify-center" variant="secondary" onClick={() => setDeleteTarget(competition)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {loading ? (
              <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                <p className="text-sm font-semibold text-[#6c5a73]">Loading...</p>
              </div>
            ) : !competitions.length ? (
              <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                <p className="text-sm font-semibold text-[#6c5a73]">No competitions have been created yet.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {deleteTarget ? (
        <ConfirmDeleteCompetitionModal
          competition={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteCompetition}
        />
      ) : null}
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#10233f] p-4 text-white">
      <p className="text-xs font-bold uppercase text-white/60">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function ConfirmResetMatchDataModal({
  busy,
  onCancel,
  onConfirm
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Confirm 2026/27 match data reset">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 text-[#10233f] shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Confirm reset</p>
            <h3 className="mt-1 text-xl font-extrabold">Clear 2026/27 test results?</h3>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7f5fa] text-[#10233f]"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel reset"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">
          This removes entered match scores, lineups, generated games, personal game rows and breaks for 2026/27. Fixtures and week groupings will remain.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Trash2 className="h-4 w-4" />
            {busy ? "Clearing..." : "Clear test results"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmGenerateMatchDataModal({
  busy,
  onCancel,
  onConfirm
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Confirm 2026/27 result generation">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 text-[#10233f] shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Confirm generation</p>
            <h3 className="mt-1 text-xl font-extrabold">Generate 2026/27 results?</h3>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7f5fa] text-[#10233f]"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel generation"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">
          This replaces existing 2026/27 test match data with fresh random completed results and linked player breaks. The reusable SQL is stored in supabase/simulate_2026_27_results.sql.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Trophy className="h-4 w-4" />
            {busy ? "Generating..." : "Generate results"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteCompetitionModal({
  competition,
  busy,
  onCancel,
  onConfirm
}: {
  competition: AdminCompetitionRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Delete competition">
      <div className="w-full max-w-md rounded-[18px] bg-white p-4 shadow-elevated ring-1 ring-[#eeeaf2]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Confirm delete</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#10233f]">{competition.name}</h2>
          </div>
          <Badge variant="muted">{competition.status}</Badge>
        </div>
        <p className="mt-3 rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
          This removes the competition, entries, rounds, matches and recorded results. This cannot be undone.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="bg-[#b42318] hover:bg-[#8f1d14]">
            <Trash2 className="h-4 w-4" />
            {busy ? "Deleting..." : "Delete competition"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminCompetitionDetailCard({
  competition,
  loading,
  selectedCompetitionId,
  onBack,
  onRemoveEntry,
  onRunDraw,
  onSaveRoundSetup
}: {
  competition: AdminCompetitionDetail | null;
  loading: boolean;
  selectedCompetitionId: string;
  onBack: () => void;
  onRemoveEntry: (entryId: string) => void;
  onRunDraw: () => void;
  onSaveRoundSetup: (rounds: Array<{ id: string; framesToPlay: number; playByDate: string }>) => void;
}) {
  const [roundDates, setRoundDates] = useState<Record<string, string>>({});
  const [roundFrames, setRoundFrames] = useState<Record<string, string>>({});
  const [editingDates, setEditingDates] = useState(false);

  useEffect(() => {
    setRoundDates(Object.fromEntries((competition?.rounds ?? []).map((round) => [round.id, round.playByDate?.slice(0, 10) ?? ""])));
    setRoundFrames(Object.fromEntries((competition?.rounds ?? []).map((round) => [round.id, String(round.framesToPlay || 1)])));
    setEditingDates(Boolean(competition?.matches.length && !competition?.roundSettingsConfirmed));
  }, [competition?.id, competition?.rounds]);

  if (!competition && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competition details</CardTitle>
          <Badge variant="muted">Select</Badge>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Select Manage on a competition above to edit entrants, run the draw and review matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  const drawHasRun = Boolean(competition?.matches.length);
  const canRemoveEntries = Boolean(competition && competition.status === "Open" && !drawHasRun);
  const canRunDraw = Boolean(competition && competition.status === "Open" && competition.entrantCount >= 2 && !drawHasRun);
  const setupNeedsAttention = Boolean(competition && drawHasRun && !competition.roundSettingsConfirmed);

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="secondary" size="sm" onClick={onBack}>
            Back
          </Button>
          <div className="min-w-0">
            <CardTitle>{competition?.name ?? "Loading competition"}</CardTitle>
            {competition ? <p className="mt-1 text-sm font-semibold text-[#6c5a73]">{competition.clubName}</p> : null}
          </div>
        </div>
        <Badge variant={competition?.status === "Open" ? "green" : competition?.status === "Drawn" ? "cyan" : "muted"}>
          {loading ? "Loading" : competition?.status ?? "Selected"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Loading competition details...</p>
        ) : competition ? (
          <>
            <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] sm:grid-cols-4">
              {[
                ["Type", competition.competitionType],
                ["Entrants", competition.entrantCount.toString()],
                ["Rounds", competition.rounds.length.toString()],
                ["Matches", competition.matches.length.toString()]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#eeeaf2]">
                  <p className="text-[10px] font-bold uppercase text-[#6c5a73]">{label}</p>
                  <p className="mt-1 text-lg font-extrabold leading-none text-[#10233f]">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
              <Badge variant="muted">{competition.competitionType}</Badge>
              <Badge variant="muted">Entries close {formatAdminDate(competition.entryClosesAt)}</Badge>
              <Button onClick={onRunDraw} disabled={!canRunDraw}>
                <Trophy className="h-4 w-4" />
                Run draw
              </Button>
              {!canRemoveEntries && drawHasRun ? (
                <Badge variant="muted">Draw already made</Badge>
              ) : null}
            </div>
            {competition.status === "Open" && competition.entrantCount < 2 ? (
              <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Add at least two entrants before running a draw.</p>
            ) : null}
            {drawHasRun ? (
              <div className={cn("grid gap-2 rounded-xl p-3 ring-1", setupNeedsAttention ? "bg-[#fff8eb] ring-[#ffb00055]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#6c5a73]">{setupNeedsAttention ? "Round setup needed" : "Round setup"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#10233f]">
                      {competition.rounds.map((round) => `${round.name}: best of ${round.framesToPlay}, ${formatAdminDate(round.playByDate)}`).join(" / ")}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setEditingDates((current) => !current)}>
                    {editingDates ? "Hide setup" : "Edit setup"}
                  </Button>
                </div>
                {setupNeedsAttention ? (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#6c5a73] ring-1 ring-[#eeeaf2]">
                    Set the best-of format and finish date for each round. Once saved, this panel will collapse.
                  </p>
                ) : null}
                {editingDates ? (
                  <>
                    <div className="grid gap-2">
                      {competition.rounds.map((round) => (
                        <div key={round.id} className="grid gap-2 rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2] sm:grid-cols-[1fr_120px_180px] sm:items-end">
                          <p className="text-sm font-extrabold text-[#10233f]">{round.name}</p>
                          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
                            Best of
                            <select
                              className="min-h-10 rounded-lg border border-[#eeeaf2] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
                              value={roundFrames[round.id] ?? "1"}
                              onChange={(event) => setRoundFrames((current) => ({ ...current, [round.id]: event.target.value }))}
                            >
                              {[1, 3, 5, 7, 9, 11].map((frames) => (
                                <option key={frames} value={frames}>{frames}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
                            Finish by
                            <input
                              className="min-h-10 rounded-lg border border-[#eeeaf2] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
                              type="date"
                              value={roundDates[round.id] ?? ""}
                              onChange={(event) => setRoundDates((current) => ({ ...current, [round.id]: event.target.value }))}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        onSaveRoundSetup(competition.rounds.map((round) => ({ id: round.id, framesToPlay: Number(roundFrames[round.id] ?? round.framesToPlay), playByDate: roundDates[round.id] ?? "" })));
                        setEditingDates(false);
                      }}
                    >
                      Save round setup
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase text-[#6c5a73]">Entrants</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {competition.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[#10233f]">{entry.playerName}</p>
                      {competition.competitionType === "Handicap" ? (
                        <p className="text-xs font-bold text-[#6c5a73]">Handicap {entry.handicap === null ? "-" : entry.handicap}</p>
                      ) : null}
                    </div>
                    {canRemoveEntries ? (
                      <Button variant="secondary" size="icon" className="h-10 w-10 shrink-0" onClick={() => onRemoveEntry(entry.id)} aria-label={`Remove ${entry.playerName}`}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              {!competition.entries.length ? (
                <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No active entrants.</p>
              ) : null}
            </div>
            {drawHasRun ? (
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">Draw</p>
                {competition.matches.slice(0, 8).map((match) => (
                  <div key={match.id} className="rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#6c5a73]">{match.roundName} - Match {match.matchNumber}</p>
                        <p className="font-extrabold text-[#10233f]">{match.player1Name} v {match.player2Name}</p>
                      </div>
                      <Badge variant={match.status === "Completed" ? "green" : match.status === "Bye" ? "cyan" : "muted"}>{match.status}</Badge>
                    </div>
                  </div>
                ))}
                {competition.matches.length > 8 ? (
                  <p className="text-xs font-bold text-[#6c5a73]">Showing first 8 of {competition.matches.length} matches.</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Competition {selectedCompetitionId} could not be loaded.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-center ring-1 ring-[#eeeaf2]">
      <p className="text-lg font-extrabold leading-none text-[#10233f]">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase text-[#6c5a73]">{label}</p>
    </div>
  );
}

function PeoplePanel({
  teams,
  people,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  people: PersonOption[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const clubs = uniqueClubs(teams);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [handicap, setHandicap] = useState("");
  const [clubId, setClubId] = useState(clubs[0]?.clubId ?? "");
  const clubTeams = teams.filter((team) => team.clubId === clubId);
  const [teamId, setTeamId] = useState(clubTeams[0]?.teamId ?? "");
  const [role, setRole] = useState<InviteRole>("Player");
  const [admin, setAdmin] = useState(false);
  const [busyPersonId, setBusyPersonId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PersonOption | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    const nextTeams = teams.filter((team) => team.clubId === clubId);
    if (!nextTeams.some((team) => team.teamId === teamId)) {
      setTeamId(nextTeams[0]?.teamId ?? "");
    }
  }, [clubId, teamId, teams]);

  async function addPerson() {
    if (demo) {
      onMessage("Person added.");
      return;
    }

    try {
      const response = await fetch("/api/admin/people", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, handicap, clubId, teamId, role, admin })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not add person.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setHandicap("");
      setAdmin(false);
      onMessage("Person added. No login was created.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not add person.");
    }
  }

  async function setLoginAccess(person: PersonOption, loginActive: boolean) {
    if (demo) {
      onMessage(loginActive ? "Login enabled." : "Login disabled.");
      return;
    }

    setBusyPersonId(person.personId);
    try {
      const response = await fetch("/api/admin/people", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: person.personId, loginActive })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update user.");
      onMessage(`${person.name}'s login has been ${loginActive ? "enabled" : "disabled"}.`);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update user.");
    } finally {
      setBusyPersonId("");
    }
  }

  async function resendInvite(person: PersonOption) {
    if (!person.invitationId) return;
    if (demo) {
      onMessage(`Invite resent to ${person.email}.`);
      return;
    }

    setBusyPersonId(person.personId);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: person.invitationId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not resend invite.");
      const status = data.email_status ? String(data.email_status).toLowerCase() : "queued";
      onMessage(`Invite email ${status} to ${data.email_to ?? person.email}.`);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not resend invite.");
    } finally {
      setBusyPersonId("");
    }
  }

  async function deletePerson() {
    if (!deleteTarget) return;
    if (demo) {
      onMessage(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      return;
    }

    setBusyPersonId(deleteTarget.personId);
    try {
      const response = await fetch("/api/admin/people", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: deleteTarget.personId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete user.");
      onMessage(`${data.name ?? deleteTarget.name} deleted. Historical results are retained.`);
      setDeleteTarget(null);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not delete user.");
    } finally {
      setBusyPersonId("");
    }
  }

  const visiblePeople = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    function personClubNames(person: PersonOption) {
      const names = [
        ...(person.clubHandicaps ?? []).map((item) => item.club_name),
        ...(person.clubAdmins ?? []).map((item) => item.club_name)
      ];
      return Array.from(new Set(names.filter(Boolean)));
    }

    function matchesStatus(person: PersonOption) {
      if (statusFilter === "all") return true;
      if (statusFilter === "login-on") return Boolean(person.accountId && person.loginActive);
      if (statusFilter === "login-off") return Boolean(person.accountId && !person.loginActive);
      if (statusFilter === "no-login") return !person.accountId;
      if (statusFilter === "invited") return Boolean(person.invitedAt);
      if (statusFilter === "pending") return person.inviteStatus === "Pending";
      if (statusFilter === "accepted") return person.inviteStatus === "Accepted";
      if (statusFilter === "no-invite") return !person.invitedAt;
      return true;
    }

    return people
      .filter((person) => {
        const clubsForPerson = personClubNames(person);
        const searchHaystack = [
          person.name,
          person.email,
          person.phone,
          person.username,
          person.inviteStatus,
          ...clubsForPerson
        ].filter(Boolean).join(" ").toLowerCase();

        return (!search || searchHaystack.includes(search))
          && (clubFilter === "all" || clubsForPerson.includes(clubFilter))
          && matchesStatus(person);
      })
      .sort((a, b) => {
        if (sortBy === "email") return (a.email || "").localeCompare(b.email || "");
        if (sortBy === "club") {
          const clubA = a.clubHandicaps?.[0]?.club_name ?? a.clubAdmins?.[0]?.club_name ?? "";
          const clubB = b.clubHandicaps?.[0]?.club_name ?? b.clubAdmins?.[0]?.club_name ?? "";
          return clubA.localeCompare(clubB) || a.name.localeCompare(b.name);
        }
        if (sortBy === "invite") return (Date.parse(b.invitedAt ?? "") || 0) - (Date.parse(a.invitedAt ?? "") || 0);
        if (sortBy === "status") return (a.inviteStatus || "No invite").localeCompare(b.inviteStatus || "No invite") || a.name.localeCompare(b.name);
        if (sortBy === "login") return Number(Boolean(b.loginActive)) - Number(Boolean(a.loginActive)) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [clubFilter, people, searchTerm, sortBy, statusFilter]);

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>People</CardTitle>
          <Badge variant="muted">{visiblePeople.length} / {people.length}</Badge>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3">
          <div className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] md:grid-cols-[minmax(180px,1.5fr)_1fr_1fr_1fr]">
            <label className="grid gap-1">
              <span className="text-xs font-bold uppercase text-[#6c5a73]">Search</span>
              <input
                className="min-h-11 rounded-xl border border-[#eeeaf2] bg-white px-3 text-sm font-bold text-[#10233f] outline-none focus-visible:outline-[#7bc7d6]"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, email, club"
              />
            </label>
            <AdminSelect label="Club" value={clubFilter} onChange={setClubFilter} options={[{ value: "all", label: "All clubs" }, ...clubs.map((club) => ({ value: club.clubName, label: club.clubName }))]} />
            <AdminSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "login-on", label: "Login on" },
                { value: "login-off", label: "Login off" },
                { value: "no-login", label: "No login" },
                { value: "pending", label: "Pending invite" },
                { value: "accepted", label: "Accepted invite" },
                { value: "invited", label: "Any invite" },
                { value: "no-invite", label: "No invite" }
              ]}
            />
            <AdminSelect
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "name", label: "Name" },
                { value: "email", label: "Email" },
                { value: "club", label: "Club" },
                { value: "login", label: "Login status" },
                { value: "invite", label: "Newest invite" },
                { value: "status", label: "Invite status" }
              ]}
            />
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl ring-1 ring-[#eeeaf2]">
            <div className="hidden grid-cols-[minmax(130px,1fr)_minmax(170px,1.2fr)_minmax(110px,.85fr)_82px_84px_104px_300px] gap-2 bg-[#f7f5fa] px-3 py-2 text-xs font-black uppercase text-[#6c5a73] lg:grid">
              <span>Person</span>
              <span>Email</span>
              <span>Club</span>
              <span>Login</span>
              <span>Invited</span>
              <span>Invite status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="max-h-[680px] min-w-0 overflow-y-auto overflow-x-hidden">
              {visiblePeople.map((person) => {
                const handicaps = (person.clubHandicaps ?? []).filter((item) => item.handicap !== null && item.handicap !== undefined);
                const clubsForPerson = Array.from(new Set([
                  ...(person.clubHandicaps ?? []).map((item) => item.club_name),
                  ...(person.clubAdmins ?? []).map((item) => item.club_name)
                ].filter(Boolean)));
                return (
                  <div key={person.personId} className="grid min-w-0 gap-2 border-t border-[#eeeaf2] px-3 py-2 text-sm font-bold text-[#10233f] lg:grid-cols-[minmax(130px,1fr)_minmax(170px,1.2fr)_minmax(110px,.85fr)_82px_84px_104px_300px] lg:items-center lg:gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-extrabold">{person.name}</span>
                      {person.admin ? <Badge variant="green">Admin</Badge> : null}
                    </div>
                    <p className="min-w-0 truncate text-[#6c5a73]">{person.email || "No email yet"}</p>
                    <p className="min-w-0 truncate text-xs text-[#6c5a73]" title={clubsForPerson.join(" / ")}>
                      {clubsForPerson.length ? clubsForPerson.map((club) => club.replace(" Golf Club", "")).join(" / ") : "-"}
                      {handicaps.length ? ` (${handicaps.map((item) => formatHandicap(item.handicap)).join("/")})` : ""}
                    </p>
                    <div className="flex min-w-0 items-center gap-1">
                      {person.accountId ? (
                        <Badge variant={person.loginActive ? "green" : "muted"}>
                          {person.loginActive ? "Login on" : "Login off"}
                        </Badge>
                      ) : (
                        <Badge variant="muted">No login</Badge>
                      )}
                    </div>
                    <p className="min-w-0 truncate text-xs text-[#6c5a73]">{person.invitedAt ? formatAdminDate(person.invitedAt) : "-"}</p>
                    <InviteStatusBadge person={person} />
                    <div className="flex min-w-0 items-center justify-end gap-1">
                      {person.invitationId && person.inviteStatus === "Pending" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resendInvite(person)}
                          disabled={busyPersonId === person.personId}
                          className="min-h-9 shrink-0 px-2 text-xs"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Resend
                        </Button>
                      ) : null}
                      {person.accountId ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLoginAccess(person, !person.loginActive)}
                          disabled={busyPersonId === person.personId}
                          className="min-h-9 shrink-0 px-2 text-xs"
                        >
                          {person.loginActive ? "Disable" : "Enable"}
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeleteTarget(person)}
                        disabled={busyPersonId === person.personId}
                        className="min-h-9 shrink-0 px-2 text-xs text-[#b42318]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!visiblePeople.length ? (
                <div className="px-3 py-4 text-sm font-semibold text-[#6c5a73]">No people match those filters.</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Add person</CardTitle>
          <Badge variant="cyan">No login created</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-5">
            <AdminInput label="First name" value={firstName} onChange={setFirstName} />
            <AdminInput label="Last name" value={lastName} onChange={setLastName} />
            <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
            <AdminInput label="Phone" value={phone} onChange={setPhone} type="tel" />
            <AdminInput label="Club handicap" value={handicap} onChange={setHandicap} type="number" placeholder="Blank" />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <AdminSelect label="Club" value={clubId} onChange={setClubId} options={clubs.map((club) => ({ value: club.clubId, label: club.clubName }))} />
            <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as InviteRole)} options={inviteRoles.map((item) => ({ value: item, label: item }))} />
            {clubLevelInviteRoles.includes(role) ? (
              <div className="rounded-xl bg-[#f7f5fa] px-3 py-2 text-xs font-bold text-[#6c5a73] ring-1 ring-[#eeeaf2]">
                Club role
              </div>
            ) : (
              <AdminSelect label="Team" value={teamId} onChange={setTeamId} options={clubTeams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.leagueName}` }))} />
            )}
            <Button onClick={addPerson} disabled={!firstName || !lastName || (!clubLevelInviteRoles.includes(role) && !teamId)}>
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <AdminCheckbox label="Make administrator" checked={admin} onChange={setAdmin} description="Administrators can access the admin console once they have a login." />
        </CardContent>
      </Card>
      {deleteTarget ? (
        <ConfirmDeletePersonModal
          person={deleteTarget}
          busy={busyPersonId === deleteTarget.personId}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deletePerson}
        />
      ) : null}
    </div>
  );
}

function InviteStatusBadge({ person }: { person: PersonOption }) {
  if (!person.invitedAt) return <Badge variant="muted">Not invited</Badge>;

  const status = person.inviteStatus ?? "Invited";
  const variant = status === "Accepted" ? "green" : status === "Pending" ? "cyan" : "muted";
  const detail = [
    person.inviteSentAt ? `Sent ${formatAdminDate(person.inviteSentAt)}` : "",
    person.inviteAcceptedAt ? `Accepted ${formatAdminDate(person.inviteAcceptedAt)}` : ""
  ].filter(Boolean).join(" / ");

  return (
    <span title={detail || undefined}>
      <Badge variant={variant}>{status}</Badge>
    </span>
  );
}

function ConfirmDeletePersonModal({
  person,
  busy,
  onCancel,
  onConfirm
}: {
  person: PersonOption;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Delete user">
      <div className="w-full max-w-md rounded-[18px] bg-white p-4 shadow-elevated ring-1 ring-[#eeeaf2]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Confirm delete</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#10233f]">{person.name}</h2>
            {person.email ? <p className="mt-1 text-sm font-bold text-[#6c5a73]">{person.email}</p> : null}
          </div>
          {person.loginActive ? <Badge variant="green">Login enabled</Badge> : <Badge variant="muted">{person.accountId ? "Login disabled" : "No login"}</Badge>}
        </div>
        <p className="mt-3 rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
          This deactivates the person, disables their login, removes active sessions and hides their current roles. Historical results, breaks and logs are retained.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="bg-[#b42318] hover:bg-[#8f1d14]">
            <Trash2 className="h-4 w-4" />
            {busy ? "Deleting..." : "Delete user"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InvitesPanel({
  teams,
  requests,
  invites,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  requests: InviteRequestRow[];
  invites: InviteRow[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const clubs = uniqueClubs(teams);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clubId, setClubId] = useState(clubs[0]?.clubId ?? "");
  const clubTeams = teams.filter((team) => team.clubId === clubId);
  const [roleRows, setRoleRows] = useState<InviteRoleRow[]>([newInviteRoleRow("Player", clubTeams[0]?.teamId ?? "")]);
  const [administrator, setAdministrator] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [emailPreview, setEmailPreview] = useState<{ to: string; subject: string; body: string; activationUrl: string } | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setRoleRows((rows) => rows.map((row) => {
      if (clubLevelInviteRoles.includes(row.role)) return { ...row, teamId: "" };
      if (clubTeams.some((team) => team.teamId === row.teamId)) return row;
      return { ...row, teamId: clubTeams[0]?.teamId ?? "" };
    }));
  }, [clubId, teams]);

  function addRoleRow() {
    setRoleRows((rows) => [...rows, newInviteRoleRow("Player", clubTeams[0]?.teamId ?? "")]);
  }

  function updateRoleRow(id: string, next: Partial<InviteRoleRow>) {
    setRoleRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const nextRole = next.role ?? row.role;
      return {
        ...row,
        ...next,
        teamId: clubLevelInviteRoles.includes(nextRole) ? "" : (next.teamId || row.teamId || clubTeams[0]?.teamId || "")
      };
    }));
  }

  function removeRoleRow(id: string) {
    setRoleRows((rows) => rows.length === 1 ? rows : rows.filter((row) => row.id !== id));
  }

  async function createInvite() {
    const name = `${inviteFirstName.trim()} ${inviteLastName.trim()}`.trim();
    if (demo) {
      onMessage("Demo invite created: CASTLE-DEMO-2026");
      return;
    }

    setInviteSending(true);
    setInviteStatus({ tone: "info", text: `Sending invite email to ${email}...` });
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          phone,
          clubId,
          roles: roleRows.map((row) => ({ role: row.role, teamId: row.teamId, clubId })),
          administrator,
          expiresAt
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create invite.");
      const emailStatus = data.email_status ? String(data.email_status).toLowerCase() : "queued";
      setEmailPreview({
        to: data.email_to ?? "garlyons@gmail.com",
        subject: data.email_subject ?? "You have been invited to join Interclub Snooker",
        body: data.email_preview ?? "",
        activationUrl: data.activation_url ?? ""
      });
      setInviteStatus({
        tone: data.email_status === "Failed" ? "error" : "success",
        text: data.email_status === "Failed"
          ? `Invite created, but the email could not be sent to ${data.email_to ?? email}.`
          : `Invite email ${emailStatus} to ${data.email_to ?? email}.`
      });
      setInviteFirstName("");
      setInviteLastName("");
      onMessage(data.activation_url ? `Invite created and email ${emailStatus} to ${data.email_to ?? email}.` : data.invitation_code ? `Invite created: ${data.invitation_code}` : "Invite created.");
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create invite.";
      setInviteStatus({ tone: "error", text: message });
      onMessage(message);
    } finally {
      setInviteSending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Create invite</CardTitle>
            <Badge variant="green">Secure activation</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput label="First name" value={inviteFirstName} onChange={setInviteFirstName} />
              <AdminInput label="Last name" value={inviteLastName} onChange={setInviteLastName} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
              <AdminInput label="Phone" value={phone} onChange={setPhone} type="tel" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminSelect label="Club" value={clubId} onChange={setClubId} options={clubs.map((club) => ({ value: club.clubId, label: club.clubName }))} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">Roles</p>
                <Button variant="secondary" size="sm" onClick={addRoleRow}>
                  <PlusCircle className="h-4 w-4" />
                  Add role
                </Button>
              </div>
              {roleRows.map((row, index) => (
                <div key={row.id} className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] lg:grid-cols-[160px_minmax(0,1fr)_44px]">
                  <AdminSelect label={`Role ${index + 1}`} value={row.role} onChange={(value) => updateRoleRow(row.id, { role: value as InviteRole })} options={inviteRoles.map((item) => ({ value: item, label: item }))} />
                  {clubLevelInviteRoles.includes(row.role) ? (
                    <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#10233f] ring-1 ring-[#eeeaf2]">
                      {row.role === "Club Admin" ? "Club administration access" : "Club-wide member access"}
                      <span className="block text-xs font-semibold text-[#6c5a73]">
                        {row.role === "Club Admin" ? "Can manage club members, invites, competitions and bookings." : "Can book club tables and receive messages."}
                      </span>
                    </div>
                  ) : (
                    <AdminSelect label="Team" value={row.teamId} onChange={(value) => updateRoleRow(row.id, { teamId: value })} options={clubTeams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.leagueName}` }))} />
                  )}
                  <Button variant="secondary" size="icon" onClick={() => removeRoleRow(row.id)} disabled={roleRows.length === 1}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove role</span>
                  </Button>
                </div>
              ))}
            </div>
            <AdminCheckbox label="Make administrator" checked={administrator} onChange={setAdministrator} description="After activation, this person can access admin and manage the platform." />
            <AdminInput label="Expires" value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
            {inviteStatus ? <InviteSendStatus tone={inviteStatus.tone} text={inviteStatus.text} /> : null}
            <Button onClick={createInvite} disabled={inviteSending || !inviteFirstName.trim() || !inviteLastName.trim() || !email || !clubId || (!administrator && !roleRows.length)}>
              <PlusCircle className="h-4 w-4" />
              {inviteSending ? "Sending invite email..." : "Create and queue invite email"}
            </Button>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Invite email</CardTitle>
            <Badge variant="cyan">Test to Garry</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            {emailPreview ? (
              <div className="grid gap-3">
                <div className="rounded-xl bg-[#10233f] p-4 text-white">
                  <Mail className="mb-3 h-5 w-5 text-[#7bc7d6]" />
                  <p className="text-xs font-bold uppercase text-white/60">To</p>
                  <p className="font-extrabold">{emailPreview.to}</p>
                  <p className="mt-3 text-xs font-bold uppercase text-white/60">Subject</p>
                  <p className="font-bold">{emailPreview.subject}</p>
                </div>
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#f7f5fa] p-4 text-sm font-semibold text-[#10233f]">{emailPreview.body}</pre>
                {emailPreview.activationUrl ? <a className="text-sm font-extrabold text-[#1b8a72]" href={emailPreview.activationUrl}>Open activation link</a> : null}
              </div>
            ) : (
              <div className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-semibold text-[#6c5a73]">
                The next invite will queue a branded email record and, for testing, address it to garlyons@gmail.com.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <BulkInviteImportPanel teams={teams} demo={demo} onMessage={onMessage} onRefresh={onRefresh} />
      <ExistingInvites invites={invites} />
    </div>
  );
}

function BulkInviteImportPanel({
  teams,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const example = "name\temail\tphone\tclub\trole\tteam\tadministrator\tsend_invite\nStephen Finlan\tstephen@example.com\t\tCastle Golf Club\tManager\tCastle A\tno\tyes\nCastle A Player\tplayer@example.com\t\tCastle Golf Club\tPlayer\tCastle A\tno\tno";
  const [pastedRows, setPastedRows] = useState(example);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const parsedRows = parseInviteSpreadsheetRows(pastedRows, teams);
  const readyRows = parsedRows.filter((row) => !row.error);

  async function sendBulkInvites() {
    if (demo) {
      onMessage(`Demo import ready: ${readyRows.length} invite rows.`);
      return;
    }
    if (!readyRows.length) {
      onMessage("No valid invite rows to send.");
      return;
    }

    setSending(true);
    const inviteRows = readyRows.filter((row) => row.sendInvite);
    const createOnlyRows = readyRows.filter((row) => !row.sendInvite);
    setSendStatus({
      tone: "info",
      text: `Processing ${readyRows.length} row${readyRows.length === 1 ? "" : "s"} (${inviteRows.length} invite${inviteRows.length === 1 ? "" : "s"}, ${createOnlyRows.length} create-only).`
    });
    let sent = 0;
    let createdOnly = 0;
    const failures: string[] = [];
    const completedEmails = new Set<string>();
    for (const row of readyRows) {
      try {
        const [firstName, ...lastNameParts] = row.name.trim().split(/\s+/);
        const response = await fetch(row.sendInvite ? "/api/admin/invites" : "/api/admin/people", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(row.sendInvite
            ? {
                email: row.email,
                name: row.name,
                phone: row.phone,
                clubId: row.clubId,
                roles: [{ role: row.role, teamId: row.teamId, clubId: row.clubId }],
                administrator: row.administrator
              }
            : {
                firstName,
                lastName: lastNameParts.join(" ") || "-",
                email: row.email,
                phone: row.phone,
                clubId: row.clubId,
                role: row.role,
                teamId: row.teamId,
                admin: row.administrator
              })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || (row.sendInvite ? "Could not create invite." : "Could not create person."));
        if (row.sendInvite) sent += 1;
        else createdOnly += 1;
        if (!row.sendInvite || data.email_status !== "Failed") completedEmails.add(row.email);
      } catch (error) {
        failures.push(`${row.email}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    setSending(false);
    if (completedEmails.size) {
      const lines = pastedRows.split(/\r?\n/);
      const delimiter = lines[0]?.includes("\t") ? "\t" : ",";
      setPastedRows(lines.filter((line, index) => {
        if (index === 0 || !line.trim()) return true;
        const cells = splitDelimitedLine(line, delimiter);
        const headers = splitDelimitedLine(lines[0] ?? "", delimiter).map(normalizeHeader);
        const emailIndex = headers.indexOf("email") >= 0 ? headers.indexOf("email") : headers.indexOf("emailaddress");
        const rowEmail = readCell(cells, emailIndex).toLowerCase();
        return !completedEmails.has(rowEmail);
      }).join("\n").trimEnd());
    }
    onRefresh();
    const successParts = [
      sent ? `sent ${sent} invite${sent === 1 ? "" : "s"}` : "",
      createdOnly ? `created ${createdOnly} person record${createdOnly === 1 ? "" : "s"} without invites` : ""
    ].filter(Boolean);
    const resultMessage = failures.length
      ? `${successParts.join(" and ") || "Processed 0 rows"}; ${failures.length} failed. ${failures[0]}`
      : `${successParts.join(" and ") || "Processed 0 rows"} and removed them from the import list.`;
    setSendStatus({ tone: failures.length ? "error" : "success", text: resultMessage });
    onMessage(resultMessage);
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Import from spreadsheet</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Paste rows copied from Excel or Google Sheets. Headers are required.</p>
        </div>
        <Badge variant="cyan">{readyRows.length} ready</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase text-[#6c5a73]">Spreadsheet rows</span>
          <textarea
            className="min-h-44 rounded-2xl border border-[#eeeaf2] bg-white px-4 py-3 text-sm font-semibold text-[#10233f] outline-none focus-visible:outline-[#7bc7d6]"
            value={pastedRows}
            onChange={(event) => setPastedRows(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="overflow-hidden rounded-xl ring-1 ring-[#eeeaf2]">
          <div className="grid grid-cols-[1.2fr_1.4fr_1fr_.8fr_1fr] gap-2 bg-[#f7f5fa] px-3 py-2 text-xs font-black uppercase text-[#6c5a73]">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Invite</span>
            <span>Status</span>
          </div>
          <div className="max-h-56 overflow-auto">
            {parsedRows.length ? parsedRows.map((row, index) => (
              <div key={`${row.email}-${index}`} className="grid grid-cols-[1.2fr_1.4fr_1fr_.8fr_1fr] gap-2 border-t border-[#eeeaf2] px-3 py-2 text-sm font-bold text-[#10233f]">
                <span className="min-w-0 truncate">{row.name || "-"}</span>
                <span className="min-w-0 truncate">{row.email || "-"}</span>
                <span className="min-w-0 truncate">{row.role}{row.team ? ` - ${row.team}` : ""}</span>
                <span className={row.sendInvite ? "text-[#1b8a72]" : "text-[#6c5a73]"}>{row.sendInvite ? "Yes" : "No"}</span>
                <span className={row.error ? "text-[#ba1a1a]" : "text-[#1b8a72]"}>{row.error || "Ready"}</span>
              </div>
            )) : (
              <div className="px-3 py-4 text-sm font-semibold text-[#6c5a73]">No rows parsed yet.</div>
            )}
          </div>
        </div>
        <Button onClick={sendBulkInvites} disabled={sending || !readyRows.length}>
          <FileSpreadsheet className="h-4 w-4" />
          {sending ? "Processing import..." : "Import rows"}
        </Button>
        {sendStatus ? <InviteSendStatus tone={sendStatus.tone} text={sendStatus.text} /> : null}
      </CardContent>
    </Card>
  );
}

function InviteSendStatus({ tone, text }: { tone: "info" | "success" | "error"; text: string }) {
  const classes = {
    info: "bg-[#eef6fb] text-[#10233f] ring-[#d5e7f0]",
    success: "bg-[#ebfff4] text-[#0f6f47] ring-[#b9f6d4]",
    error: "bg-[#fff1f1] text-[#9f1d1d] ring-[#ffd0d0]"
  }[tone];

  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-bold ring-1 ${classes}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {text}
    </div>
  );
}

function PermissionsPanel({
  teams,
  people,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  people: PersonOption[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const [personId, setPersonId] = useState(people[0]?.personId ?? "");
  const [adminPersonId, setAdminPersonId] = useState(people.find((person) => person.email.toLowerCase() === "garlyons@gmail.com")?.personId ?? people[0]?.personId ?? "");
  const [clubAdminPersonId, setClubAdminPersonId] = useState(people.find((person) => person.email.toLowerCase() === "garlyons@gmail.com")?.personId ?? people[0]?.personId ?? "");
  const [clubAdminClubId, setClubAdminClubId] = useState(uniqueClubs(teams)[0]?.clubId ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [role, setRole] = useState<TeamRole>("Player");
  const clubs = uniqueClubs(teams);

  useEffect(() => {
    if (people.some((person) => person.personId === adminPersonId)) return;
    setAdminPersonId(people.find((person) => person.email.toLowerCase() === "garlyons@gmail.com")?.personId ?? people[0]?.personId ?? "");
  }, [adminPersonId, people]);

  useEffect(() => {
    if (people.some((person) => person.personId === personId)) return;
    setPersonId(people[0]?.personId ?? "");
  }, [people, personId]);

  useEffect(() => {
    if (people.some((person) => person.personId === clubAdminPersonId)) return;
    setClubAdminPersonId(people.find((person) => person.email.toLowerCase() === "garlyons@gmail.com")?.personId ?? people[0]?.personId ?? "");
  }, [clubAdminPersonId, people]);

  useEffect(() => {
    if (clubs.some((club) => club.clubId === clubAdminClubId)) return;
    setClubAdminClubId(clubs[0]?.clubId ?? "");
  }, [clubAdminClubId, clubs]);

  async function savePermission(payload: Record<string, unknown>, successMessage: string) {
    if (demo) {
      onMessage(successMessage);
      return;
    }

    try {
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save permission.");
      onMessage(successMessage);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save permission.");
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Admin access</CardTitle>
          <Badge variant="cyan">Administrators</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <AdminSelect
            label="Person"
            value={adminPersonId}
            onChange={setAdminPersonId}
            options={people.map((person) => ({
              value: person.personId,
              label: `${person.name} ${person.email ? `- ${person.email}` : ""}${person.admin ? " - Admin" : ""}`
            }))}
          />
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Administrator access lets any logged-in person open the admin console, create invites, set permissions and view logs.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => savePermission({ permissionType: "admin", personId: adminPersonId, active: true }, "Admin access granted.")}>
              <ShieldCheck className="h-4 w-4" />
              Grant admin
            </Button>
            <Button variant="secondary" onClick={() => savePermission({ permissionType: "admin", personId: adminPersonId, active: false }, "Admin access revoked.")}>
              Revoke admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Club admin access</CardTitle>
          <Badge variant="green">Club scoped</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <AdminSelect
            label="Person"
            value={clubAdminPersonId}
            onChange={setClubAdminPersonId}
            options={people.map((person) => ({
              value: person.personId,
              label: `${person.name} ${person.email ? `- ${person.email}` : ""}${person.clubAdmins?.length ? ` - ${person.clubAdmins.map((club) => club.club_name.replace(" Golf Club", "")).join(", ")}` : ""}`
            }))}
          />
          <AdminSelect label="Club" value={clubAdminClubId} onChange={setClubAdminClubId} options={clubs.map((club) => ({ value: club.clubId, label: club.clubName }))} />
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Club admins can create competitions, add entrants, run draws and record results for this club.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => savePermission({ permissionType: "clubAdmin", personId: clubAdminPersonId, clubId: clubAdminClubId, active: true }, "Club admin access granted.")}>
              <ShieldCheck className="h-4 w-4" />
              Grant club admin
            </Button>
            <Button variant="secondary" onClick={() => savePermission({ permissionType: "clubAdmin", personId: clubAdminPersonId, clubId: clubAdminClubId, active: false }, "Club admin access revoked.")}>
              Revoke club admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Team permissions</CardTitle>
          <Badge variant="cyan">Membership based</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <AdminSelect label="Person" value={personId} onChange={setPersonId} options={people.map((person) => ({ value: person.personId, label: `${person.name} ${person.email ? `- ${person.email}` : ""}` }))} />
          <AdminSelect label="Team" value={teamId} onChange={setTeamId} options={teams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.clubName}` }))} />
          <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as TeamRole)} options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => savePermission({ personId, teamId, role, active: true }, "Permission saved.")}>
              <ShieldCheck className="h-4 w-4" />
              Save permission
            </Button>
            <Button variant="secondary" onClick={() => savePermission({ personId, teamId, role, active: false }, "Permission disabled.")}>
              Disable permission
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function parseInviteSpreadsheetRows(input: string, teams: TeamOption[]): ParsedInviteRow[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const indexFor = (...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(normalizeHeader(name));
      if (index >= 0) return index;
    }
    return -1;
  };
  const indexes = {
    name: indexFor("name", "full name", "person"),
    email: indexFor("email", "email address"),
    phone: indexFor("phone", "phone number", "mobile"),
    club: indexFor("club"),
    role: indexFor("role", "roles"),
    team: indexFor("team"),
    administrator: indexFor("administrator", "admin", "platform admin"),
    sendInvite: indexFor("send_invite", "send invite", "invite", "email invite", "send email")
  };
  const clubs = uniqueClubs(teams);

  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const role = normalizeInviteRole(readCell(cells, indexes.role) || "Player");
    const clubName = readCell(cells, indexes.club);
    const teamName = readCell(cells, indexes.team);
    const sendInviteValue = readCell(cells, indexes.sendInvite);
    const club = clubs.find((item) => normalizeText(item.clubName) === normalizeText(clubName));
    const team = teamName
      ? teams.find((item) => normalizeText(item.teamName) === normalizeText(teamName) && (!club || item.clubId === club.clubId))
      : undefined;
    const row: ParsedInviteRow = {
      name: readCell(cells, indexes.name),
      email: readCell(cells, indexes.email).toLowerCase(),
      phone: readCell(cells, indexes.phone),
      club: clubName,
      role,
      team: teamName,
      administrator: ["yes", "y", "true", "1", "admin"].includes(readCell(cells, indexes.administrator).toLowerCase()),
      sendInvite: sendInviteValue ? !["no", "n", "false", "0", "create only", "createonly", "none"].includes(normalizeText(sendInviteValue).replace(/\s+/g, "")) : true,
      clubId: club?.clubId,
      teamId: team?.teamId
    };

    if (!row.name) row.error = "Missing name";
    else if (!row.email || !row.email.includes("@")) row.error = "Missing email";
    else if (!row.clubId) row.error = "Unknown club";
    else if (!clubLevelInviteRoles.includes(row.role) && !row.teamId) row.error = "Unknown team";

    return row;
  });
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function readCell(cells: string[], index: number) {
  return index >= 0 ? (cells[index] ?? "").trim() : "";
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeInviteRole(value: string): InviteRole {
  const normalized = normalizeText(value);
  if (normalized === "manager") return "Manager";
  if (normalized === "club member" || normalized === "member") return "Club Member";
  if (normalized === "club admin" || normalized === "club administrator") return "Club Admin";
  return "Player";
}

function ExistingInvites({ invites }: { invites: InviteRow[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Existing invites</CardTitle>
        <Badge variant="muted">{invites.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {invites.length ? invites.map((invite) => {
          const displayStatus = invite.status === "Pending" && new Date(invite.expires_at).getTime() <= Date.now() ? "Expired" : invite.status;
          const visibleStatus = displayStatus === "Pending" && invite.sent_at ? "Email sent" : displayStatus;
          const statusVariant = visibleStatus === "Accepted" || visibleStatus === "Email sent" ? "green" : visibleStatus === "Pending" ? "cyan" : visibleStatus === "Expired" ? "muted" : "muted";
          const roles = [
            ...invite.roles.map((role) => `${role.role}${role.team_name ? ` - ${role.team_name}` : ""}`),
            invite.invite_administrator ? "Administrator" : ""
          ].filter(Boolean);
          return (
            <div key={invite.id} className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px]">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-[#10233f]">{invite.invited_person_name}</p>
                <p className="truncate text-xs font-bold text-[#6c5a73]">{invite.email}</p>
                <p className="mt-1 text-xs font-semibold text-[#6c5a73]">{invite.club_name ?? "No club"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">Roles</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(roles.length ? roles : ["No roles"]).map((role) => (
                    <span key={role} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#10233f] ring-1 ring-[#eeeaf2]">{role}</span>
                  ))}
                </div>
              </div>
              <div className="grid gap-1 lg:justify-items-end">
                <Badge variant={statusVariant}>{visibleStatus}</Badge>
                {invite.sent_at ? <p className="text-xs font-semibold text-[#1b8a72]">Sent {formatAdminDate(invite.sent_at)}</p> : null}
                <p className="text-xs font-semibold text-[#6c5a73]">Created {formatAdminDate(invite.created_at)}</p>
                <p className="text-xs font-semibold text-[#6c5a73]">{invite.accepted_at ? `Accepted ${formatAdminDate(invite.accepted_at)}` : `Expires ${formatAdminDate(invite.expires_at)}`}</p>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-semibold text-[#6c5a73]">
            Created invites will appear here with their current status.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppearancePanel({
  appearance,
  demo,
  onAppearanceChange,
  onMessage
}: {
  appearance: AppearanceConfig;
  demo?: boolean;
  onAppearanceChange: (appearance: AppearanceConfig) => void;
  onMessage: (message: string) => void;
}) {
  const [role, setRole] = useState<AppRole>("Player");
  const roleConfig = appearance[role];
  const availablePanels = appearancePanelOptions.filter((option) => option.roles.includes(role));

  function updateRole(next: { panels?: AppearancePanelId[] }) {
    onAppearanceChange(normalizeAppearanceConfig({
      ...appearance,
      [role]: {
        role,
        panels: next.panels ?? roleConfig.panels,
        menuItems: roleConfig.menuItems
      }
    }));
  }

  function togglePanel(panel: AppearancePanelId) {
    updateRole({
      panels: roleConfig.panels.includes(panel)
        ? roleConfig.panels.filter((item) => item !== panel)
        : [...roleConfig.panels, panel]
    });
  }

  function movePanel(panel: AppearancePanelId, direction: -1 | 1) {
    updateRole({ panels: moveItem(roleConfig.panels, panel, direction) });
  }

  async function saveAppearance() {
    if (demo) {
      onMessage("Appearance saved.");
      return;
    }

    try {
      const response = await fetch("/api/admin/appearance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(roleConfig)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save appearance.");
      onMessage(`${role} appearance saved.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save appearance.");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Role appearance</CardTitle>
            <Badge variant="cyan">Home tab</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as AppRole)} options={rolesWithClubMember.map((item) => ({ value: item, label: item }))} />
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              Choose which panels appear on the role home screen. Order is top-to-bottom on mobile and left-to-right where panels form a desktop grid.
            </p>
          </CardContent>
        </Card>

        <AppearanceChecklist
          title="Home panels"
          items={availablePanels}
          selected={roleConfig.panels}
          onToggle={(id) => togglePanel(id as AppearancePanelId)}
          onMove={(id, direction) => movePanel(id as AppearancePanelId, direction)}
        />

        <Button onClick={saveAppearance}>
          <ShieldCheck className="h-4 w-4" />
          Save appearance
        </Button>
      </div>

      <div className="hidden xl:block">
        <AppearancePhonePreview role={role} panels={roleConfig.panels} />
      </div>
    </div>
  );
}

function AppearanceChecklist<T extends string>({
  title,
  items,
  selected,
  onToggle,
  onMove
}: {
  title: string;
  items: Array<{ id: T; label: string; description: string }>;
  selected: T[];
  onToggle: (id: T) => void;
  onMove: (id: T, direction: -1 | 1) => void;
}) {
  const selectedSet = new Set(selected);
  const orderedItems = [
    ...selected.map((id) => items.find((item) => item.id === id)).filter((item): item is { id: T; label: string; description: string } => Boolean(item)),
    ...items.filter((item) => !selectedSet.has(item.id))
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="muted">{selected.length} visible</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {orderedItems.map((item) => {
          const active = selectedSet.has(item.id);
          return (
            <div key={item.id} className={`grid gap-2 rounded-xl p-3 ring-1 ${active ? "bg-[#f7f5fa] ring-[#d8d0df]" : "bg-white ring-[#eeeaf2]"}`}>
              <label className="flex items-start gap-3">
                <input className="mt-1 h-4 w-4 accent-[#10233f]" type="checkbox" checked={active} onChange={() => onToggle(item.id)} />
                <span className="min-w-0">
                  <span className="block font-extrabold text-[#10233f]">{item.label}</span>
                  <span className="block text-xs font-semibold text-[#6c5a73]">{item.description}</span>
                </span>
              </label>
              {active ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onMove(item.id, -1)} disabled={selected[0] === item.id}>
                    <ArrowUp className="h-4 w-4" />
                    Up
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onMove(item.id, 1)} disabled={selected[selected.length - 1] === item.id}>
                    <ArrowDown className="h-4 w-4" />
                    Down
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AppearancePhonePreview({ role, panels }: { role: AppRole; panels: AppearancePanelId[] }) {
  return (
    <div className="sticky top-4">
      <Card>
        <CardHeader>
          <CardTitle>Mobile preview</CardTitle>
          <Badge variant="cyan">{role}</Badge>
        </CardHeader>
        <CardContent>
          <div className="relative mx-auto h-[720px] w-[320px] overflow-hidden rounded-[32px] border-8 border-[#10233f] bg-[#f7f5fa] shadow-elevated">
            <div className="bg-[#10233f] p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-white/65">Interclub Snooker</p>
                  <p className="text-xl font-extrabold">Castle A</p>
                </div>
                <Smartphone className="h-5 w-5 text-[#7bc7d6]" />
              </div>
              <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#10233f]">{role}</div>
            </div>
            <div className="grid max-h-[590px] gap-3 overflow-hidden p-3 pb-20">
              {panels.map((panel) => {
                const option = appearancePanelOptions.find((item) => item.id === panel);
                return (
                  <div key={panel} className="rounded-xl bg-white p-3 shadow-card ring-1 ring-[#eeeaf2]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase text-[#6c5a73]">{option?.label ?? panel}</p>
                      <Eye className="h-4 w-4 text-[#1b8a72]" />
                    </div>
                    <div className="h-16 rounded-lg bg-[#10233f]/10" />
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-5 left-1/2 w-[280px] -translate-x-1/2 rounded-2xl bg-white p-2 text-center text-[10px] font-bold uppercase text-[#6c5a73] shadow-elevated">
              Navigation is fixed by role
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function moveItem<T>(items: T[], item: T, direction: -1 | 1) {
  const index = items.indexOf(item);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function uniqueClubs(teams: TeamOption[]) {
  const clubs = new Map<string, ClubOption>();
  for (const team of teams) {
    clubs.set(team.clubId, { clubId: team.clubId, clubName: team.clubName });
  }
  return Array.from(clubs.values()).sort((a, b) => a.clubName.localeCompare(b.clubName));
}

function newInviteRoleRow(role: InviteRole, teamId: string): InviteRoleRow {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    role,
    teamId: clubLevelInviteRoles.includes(role) ? "" : teamId
  };
}

function formatAdminDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function AdminCheckbox({
  label,
  checked,
  onChange,
  description
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
      <input className="mt-1 h-4 w-4 accent-[#10233f]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm font-extrabold text-[#10233f]">{label}</span>
        {description ? <span className="block text-xs font-semibold text-[#6c5a73]">{description}</span> : null}
      </span>
    </label>
  );
}

function LogsPanel({ logs }: { logs: ActivityRow[] }) {
  const [activityLogs, setActivityLogs] = useState<ActivityRow[]>(logs);
  const [personOptions, setPersonOptions] = useState<LogPersonOption[]>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => isoDateDaysAgo(7));
  const [toDate, setToDate] = useState(() => isoDateDaysAgo(0));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(logs.length);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [personFilter, areaFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });
    if (personFilter !== "all") params.set("personId", personFilter);
    if (areaFilter !== "all") params.set("area", areaFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    setLoading(true);
    setLoadError("");
    fetch(`/api/admin/logs?${params.toString()}`, { credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Activity logs unavailable.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setActivityLogs(data.logs ?? []);
        setPersonOptions(data.people ?? []);
        setAreaOptions(data.areas ?? []);
        setTotal(Number(data.total ?? 0));
      })
      .catch((error) => {
        if (!active) return;
        setActivityLogs([]);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : "Activity logs unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [areaFilter, fromDate, page, pageSize, personFilter, toDate]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>User activity</CardTitle>
        <Badge variant="muted">{loading ? "Loading" : `${total}`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] md:grid-cols-5">
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Person
            <select
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              value={personFilter}
              onChange={(event) => setPersonFilter(event.target.value)}
            >
              <option value="all">All people</option>
              {personOptions.map((person) => (
                <option key={person.person_id} value={person.person_id}>{logPersonOptionName(person)}</option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Area visited
            <select
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
            >
              <option value="all">All areas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            From
            <input
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            To
            <input
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Rows
            <select
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-[#6c5a73]">
            Showing {fromDate || "start"} to {toDate || "today"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFromDate(isoDateDaysAgo(7));
              setToDate(isoDateDaysAgo(0));
            }}
          >
            Last 7 days
          </Button>
        </div>
        {loadError ? (
          <p className="rounded-xl bg-[#fff8eb] p-3 text-sm font-semibold text-[#8a5a00] ring-1 ring-[#ffb00055]">{loadError}</p>
        ) : null}
        <div className="overflow-hidden rounded-xl ring-1 ring-[#eeeaf2]">
          <div className="hidden grid-cols-[130px_170px_120px_minmax(0,1fr)] gap-3 bg-[#10233f] px-3 py-2 text-xs font-bold uppercase text-white/70 md:grid">
            <span>When</span>
            <span>Person</span>
            <span>Area</span>
            <span>Visit detail</span>
          </div>
          <div className="grid divide-y divide-[#eeeaf2] bg-white">
            {activityLogs.map((log) => (
              <div key={log.id} className="grid gap-1 px-3 py-2 text-sm md:grid-cols-[130px_170px_120px_minmax(0,1fr)] md:items-center md:gap-3">
                <span className="text-xs font-bold text-[#6c5a73] md:text-sm">{formatAdminLogTime(log.created_at)}</span>
                <span className="min-w-0 truncate font-bold text-[#10233f]">{logPersonName(log)}</span>
                <span className="min-w-0">
                  <Badge variant={activityBadgeVariant(log)}>{activityArea(log)}</Badge>
                </span>
                <span className="min-w-0 truncate font-semibold text-[#6c5a73]">{compactActivityLine(log)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
          <p className="text-sm font-bold text-[#6c5a73]">
            Page {page} of {totalPages} - {total} matching visits
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
              Next
            </Button>
          </div>
        </div>
        {!activityLogs.length && total > 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No activity matches those filters.</p>
        ) : null}
        {!activityLogs.length && total === 0 && !loadError ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No activity has been recorded yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <AdminShell title="Admin sign in" subtitle="Use an account that has been granted administrator access.">
      <AuthSignInForm onSignedIn={onSignedIn} googleNext="/admin" />
    </AdminShell>
  );
}

function AdminShell({ title, subtitle, children, onLogout }: { title: string; subtitle: string; children?: React.ReactNode; onLogout?: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fa] px-4 text-[#25002b]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <Badge variant="muted">Admin</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm font-semibold text-[#6c5a73]">{subtitle}</p>
          {children}
          {onLogout ? (
            <Button variant="dark" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function AdminInput({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <input className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} />
    </label>
  );
}

function formatHandicap(value: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "");
  const rounded = Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1);
  return numeric > 0 ? `+${rounded}` : rounded;
}

function AdminSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <select className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
