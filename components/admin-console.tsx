"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Eye, KeyRound, LayoutPanelTop, LogOut, Mail, PlusCircle, ShieldCheck, Smartphone, Trash2, Trophy, UserPlus, Users, XCircle } from "lucide-react";
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
  admin?: boolean;
  clubHandicaps?: Array<{ club_id: string; club_name: string; handicap: number | string | null }>;
  clubAdmins?: Array<{ club_id: string; club_name: string }>;
};
type InviteRoleRow = {
  id: string;
  role: InviteRole;
  teamId: string;
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

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Add player or member</CardTitle>
          <Badge variant="cyan">No login created</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput label="First name" value={firstName} onChange={setFirstName} />
            <AdminInput label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
            <AdminInput label="Phone" value={phone} onChange={setPhone} type="tel" />
          </div>
          <AdminInput label="Club handicap" value={handicap} onChange={setHandicap} type="number" placeholder="Blank if none" />
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminSelect label="Club" value={clubId} onChange={setClubId} options={clubs.map((club) => ({ value: club.clubId, label: club.clubName }))} />
            <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as InviteRole)} options={inviteRoles.map((item) => ({ value: item, label: item }))} />
            {clubLevelInviteRoles.includes(role) ? null : (
              <AdminSelect label="Team" value={teamId} onChange={setTeamId} options={clubTeams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.leagueName}` }))} />
            )}
          </div>
          <AdminCheckbox label="Make administrator" checked={admin} onChange={setAdmin} description="Administrators can access the admin console once they have a login." />
          <Button onClick={addPerson} disabled={!firstName || !lastName || (!clubLevelInviteRoles.includes(role) && !teamId)}>
            <UserPlus className="h-4 w-4" />
            Add person
          </Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>People</CardTitle>
          <Badge variant="muted">{people.length}</Badge>
        </CardHeader>
        <CardContent className="grid max-h-[680px] gap-2 overflow-auto pr-1">
          {people.map((person) => (
            <div key={person.personId} className="rounded-xl bg-[#f7f5fa] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{person.name}</p>
                  <p className="truncate text-xs font-bold text-[#6c5a73]">{person.email || "No email yet"}</p>
                  {person.phone ? <p className="text-xs font-semibold text-[#6c5a73]">{person.phone}</p> : null}
                  {person.clubHandicaps?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.clubHandicaps
                        .filter((item) => item.handicap !== null && item.handicap !== undefined)
                        .map((item) => (
                          <Badge key={item.club_id} variant="muted">
                            {item.club_name.replace(" Golf Club", "")}: {formatHandicap(item.handicap)}
                          </Badge>
                        ))}
                    </div>
                  ) : null}
                </div>
                {person.admin ? <Badge variant="green">Admin</Badge> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clubId, setClubId] = useState(clubs[0]?.clubId ?? "");
  const clubTeams = teams.filter((team) => team.clubId === clubId);
  const [roleRows, setRoleRows] = useState<InviteRoleRow[]>([newInviteRoleRow("Player", clubTeams[0]?.teamId ?? "")]);
  const [administrator, setAdministrator] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [emailPreview, setEmailPreview] = useState<{ to: string; subject: string; body: string; activationUrl: string } | null>(null);

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
    if (demo) {
      onMessage("Demo invite created: CASTLE-DEMO-2026");
      return;
    }

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
      setEmailPreview({
        to: data.email_to ?? "garlyons@gmail.com",
        subject: data.email_subject ?? "You have been invited to join Interclub Snooker",
        body: data.email_preview ?? "",
        activationUrl: data.activation_url ?? ""
      });
      onMessage(data.activation_url ? `Invite created and queued to ${data.email_to ?? "garlyons@gmail.com"}.` : data.invitation_code ? `Invite created: ${data.invitation_code}` : "Invite created.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not create invite.");
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Create invite</CardTitle>
            <Badge variant="green">Google activation</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput label="Full name" value={name} onChange={setName} />
              <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput label="Phone" value={phone} onChange={setPhone} type="tel" />
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
            <Button onClick={createInvite} disabled={!name || !email || !clubId || (!administrator && !roleRows.length)}>
              <PlusCircle className="h-4 w-4" />
              Create and queue invite email
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
      <ExistingInvites invites={invites} />
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
          const statusVariant = displayStatus === "Accepted" ? "green" : displayStatus === "Pending" ? "cyan" : displayStatus === "Expired" ? "muted" : "muted";
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
                <Badge variant={statusVariant}>{displayStatus}</Badge>
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
        <div className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] md:grid-cols-5">
          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Person
            <select
              className="min-h-10 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              value={personFilter}
              onChange={(event) => setPersonFilter(event.target.value)}
            >
              <option value="all">All people</option>
              {personOptions.map((person) => (
                <option key={person.person_id} value={person.person_id}>{logPersonOptionName(person)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Area visited
            <select
              className="min-h-10 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
            >
              <option value="all">All areas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            From
            <input
              className="min-h-10 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            To
            <input
              className="min-h-10 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            Rows
            <select
              className="min-h-10 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
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
