"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, CalendarDays, Eye, FileSpreadsheet, LayoutPanelTop, LogOut, Mail, Megaphone, Pencil, PlusCircle, ShieldCheck, Smartphone, Trash2, Trophy, UserPlus, Users, XCircle } from "lucide-react";
import { AuthSignInForm } from "@/components/auth-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appearancePanelOptions, defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import { clubTeamStructure } from "@/lib/demo-data";
import type { AppearanceConfig, AppearancePanelId, Role as AppRole, SponsorAd } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminTab = "desktop" | "competitions" | "matches" | "people" | "invites" | "permissions" | "appearance" | "adverts" | "logs";
type AdminMode = "platform" | "club";
type TeamRole = "Player" | "Manager";
type InviteRole = "Player" | "Manager" | "Club Member" | "Club Admin" | "League Chair";
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
  firstName: string;
  lastName: string;
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
  clubHandicaps?: Array<{ club_id: string; club_name: string; role?: string; handicap: number | string | null }>;
  clubAdmins?: Array<{ club_id: string; club_name: string }>;
  teamRoles?: Array<{ role: string; team_name: string; league_name: string; club_name: string }>;
};
type InviteRoleRow = {
  id: string;
  role: InviteRole;
  teamId: string;
};
type EditRoleRow = {
  id: string;
  role: TeamRole;
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
type AdminMatchRow = {
  fixture_id: string;
  fixture_date: string;
  status: string;
  fixture_type: string;
  season_id: string;
  season_name: string;
  league_id: string;
  league_name: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  match_id: string | null;
  home_team_score: number | null;
  away_team_score: number | null;
  home_lineup_status: string | null;
  away_lineup_status: string | null;
  lineup_count: number;
  game_count: number;
  completed_game_count: number;
};
type AdminMatchSeason = { id: string; name: string };
type AdminMatchLeague = { id: string; name: string };
type AdminMatchDraft = {
  fixtureDate: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamScore: string;
  awayTeamScore: string;
  status: string;
};
type AdminLineupSlot = {
  slotNumber: number;
  gameType: "Singles" | "Doubles";
  label: string;
  player1Id: string;
  player2Id: string;
  player1GuestName?: string;
  player2GuestName?: string;
  player1IsGuest?: boolean;
  player2IsGuest?: boolean;
};
type AdminLineupPlayer = {
  id: string;
  name: string;
  teamName?: string;
  disabledReason?: string;
};
type AdminLineupPayload = {
  players: AdminLineupPlayer[];
  guestPlayers?: AdminLineupPlayer[];
  lineup: { status: "Draft" | "Published"; slots: AdminLineupSlot[] } | null;
};
type AdminLineupEditorTarget = {
  fixtureId: string;
  teamId: string;
  teamName: string;
  leagueName: string;
} | null;
type AdminAdRow = SponsorAd & {
  active: boolean;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
};
type AdminUser = {
  email: string;
  name: string;
};

const roles: TeamRole[] = ["Player", "Manager"];
const inviteRoles: InviteRole[] = ["Player", "Manager", "Club Member", "Club Admin", "League Chair"];
const rolesWithClubMember: AppRole[] = ["Player", "Manager", "Club Member", "Club Admin", "League Chair"];
const clubLevelInviteRoles: InviteRole[] = ["Club Member", "Club Admin", "League Chair"];
const clubAdminTabs: AdminTab[] = ["people", "competitions", "matches"];
const adminNavItems = [
  { id: "desktop" as const, label: "Dashboard", icon: LayoutPanelTop },
  { id: "competitions" as const, label: "Competitions", icon: Trophy },
  { id: "matches" as const, label: "Matches", icon: CalendarDays },
  { id: "people" as const, label: "People", icon: UserPlus },
  { id: "permissions" as const, label: "Permissions", icon: Users },
  { id: "appearance" as const, label: "Appearance", icon: LayoutPanelTop },
  { id: "adverts" as const, label: "Adverts", icon: Megaphone },
  { id: "logs" as const, label: "Logs", icon: Activity }
];
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
  { personId: "person-garry", name: "Garry Lyons", firstName: "Garry", lastName: "Lyons", email: "garry@example.com" },
  { personId: "person-andrew", name: "Andrew Foley", firstName: "Andrew", lastName: "Foley", email: "andrew@example.com" },
  { personId: "person-conor", name: "Conor O'Boyle", firstName: "Conor", lastName: "O'Boyle", email: "conor@example.com" }
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
  if (activityType === "Advert Click") return "Advert click";
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
  if (log.activity_type === "Advert Click") {
    const adName = metadataText(log.metadata?.ad_name);
    return `Clicked ${adName || "an advert"}`;
  }
  return activityLabel(log.activity_type);
}

function activityContext(log: ActivityRow) {
  const teamName = metadataText(log.metadata?.team_name);
  const opponentTeamName = metadataText(log.metadata?.opponent_team_name);
  const homeTeamName = metadataText(log.metadata?.home_team_name);
  const awayTeamName = metadataText(log.metadata?.away_team_name);
  const leagueName = metadataText(log.metadata?.league_name);
  const role = metadataText(log.metadata?.role);
  const adName = metadataText(log.metadata?.ad_name);
  const homeTeamScore = log.metadata?.home_team_score;
  const awayTeamScore = log.metadata?.away_team_score;
  const score = typeof homeTeamScore === "number" && typeof awayTeamScore === "number" ? `${homeTeamScore}-${awayTeamScore}` : "";
  const pagePath = log.page_path && log.page_path !== "/" ? log.page_path : "";
  if (log.activity_type === "Advert Click") {
    const pieces = [adName, pagePath].filter(Boolean);
    return pieces.length ? pieces.join(" - ") : "Advert click";
  }
  if (homeTeamName || awayTeamName) {
    return [leagueName, `${homeTeamName || "Home"} v ${awayTeamName || "Away"}`, score].filter(Boolean).join(" - ");
  }
  const pieces = [
    leagueName,
    teamName && opponentTeamName ? `${teamName} v ${opponentTeamName}` : "",
    opponentTeamName ? "" : teamName && role ? `${teamName} - ${role}` : teamName || role,
    pagePath
  ].filter(Boolean);
  return pieces.length ? pieces.join(" - ") : "Session activity";
}

function activityBadgeVariant(log: ActivityRow): "cyan" | "green" | "muted" {
  if (log.activity_type === "Page Visit") return "cyan";
  if (log.activity_type === "Login") return "green";
  if (log.activity_type === "Advert Click") return "green";
  return "muted";
}

function activityArea(log: ActivityRow) {
  if (log.activity_type === "Login") return "Login";
  if (log.activity_type === "Advert Click") return "Advert";
  return log.page_label || log.page_path || activityLabel(log.activity_type);
}

function compactActivityLine(log: ActivityRow) {
  const area = activityArea(log);
  const context = activityContext(log);
  if (log.activity_type === "Page Visit") {
    return context === "Session activity" ? area : `${area} - ${context}`;
  }
  if (log.activity_type === "Advert Click") {
    return context;
  }
  return activitySummary(log);
}

function logPersonOptionName(person: LogPersonOption) {
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || person.email || "Unknown user";
}

export function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("desktop");
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminDataLoaded, setAdminDataLoaded] = useState(false);
  const [administrator, setAdministrator] = useState(false);
  const [adminMode, setAdminMode] = useState<AdminMode>("platform");
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>(demoTeams);
  const [people, setPeople] = useState<PersonOption[]>(demoPeople);
  const [requests, setRequests] = useState<InviteRequestRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [competitions, setCompetitions] = useState<AdminCompetitionRow[]>([]);
  const [ads, setAds] = useState<AdminAdRow[]>([]);
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
      const nextAdminMode: AdminMode = data.adminMode === "club" ? "club" : "platform";
      setAdminMode(nextAdminMode);
      setAdminUser(data.user ? {
        email: data.user.email ?? "",
        name: data.user.name ?? data.user.email ?? "Signed in"
      } : null);

      if (response.ok) {
        if (tab === "invites") {
          setTab("people");
        }
        if (nextAdminMode === "club" && !clubAdminTabs.includes(tab)) {
          setTab("people");
        }
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
            firstName: person.first_name ?? "",
            lastName: person.last_name ?? "",
            name: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
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
            teamRoles: person.team_roles ?? [],
            admin: Boolean(person.admin)
          });
        }
        setPeople(Array.from(seen.values()));
        setRequests(data.requests ?? []);
        setInvites(data.invites ?? []);
        setCompetitions(data.competitions ?? []);
        setAds((data.ads ?? []).map((ad: {
          id: string;
          name: string;
          placement: SponsorAd["placement"];
          audience: SponsorAd["audience"];
          image_path: string;
          link_url: string;
          affiliate_code?: string | null;
          alt_text: string;
          active: boolean;
          sort_order: number;
          starts_at?: string | null;
          ends_at?: string | null;
        }) => ({
          id: ad.id,
          name: ad.name,
          placement: ad.placement,
          audience: ad.audience,
          imagePath: ad.image_path,
          linkUrl: ad.link_url,
          affiliateCode: ad.affiliate_code ?? "",
          altText: ad.alt_text,
          active: Boolean(ad.active),
          sortOrder: Number(ad.sort_order ?? 100),
          startsAt: ad.starts_at ?? null,
          endsAt: ad.ends_at ?? null
        })));
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
      setAdminMode("platform");
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
    <AdminLayout
      tab={tab}
      setTab={(nextTab) => {
        if (nextTab === "logs") setLogsRefreshKey((current) => current + 1);
        setTab(nextTab);
      }}
      message={message}
      adminUser={adminUser}
      adminMode={adminMode}
      onLogout={logout}
    >
      <AdminTabPanel tab={tab} adminMode={adminMode} teams={teams} people={people} logsRefreshKey={logsRefreshKey} requests={requests} invites={invites} competitions={competitions} ads={ads} competitionsLoading={!adminDataLoaded} appearance={appearance} onAppearanceChange={setAppearance} onMessage={setMessage} onRefresh={() => refreshAdminData({ silent: true })} />
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
  adminMode,
  onLogout,
  children
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  message: string;
  adminUser: AdminUser | null;
  adminMode: AdminMode;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const navItems = adminNavItems.filter((item) => adminMode === "platform" || clubAdminTabs.includes(item.id));
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <header className="bg-[#10233f] px-4 py-5 text-white shadow-elevated sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/admin-icon.png"
              alt="Interclub Snooker admin"
              className="h-14 w-14 shrink-0 rounded-2xl bg-black object-cover ring-1 ring-white/20"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-white/65">League operations</p>
              <h1 className="truncate text-2xl font-extrabold leading-tight">Admin console</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Badge variant="cyan">{adminMode === "platform" ? "Administrator" : "Club admin"}</Badge>
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
          {navItems.map((item) => {
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
  adminMode: AdminMode;
  teams: TeamOption[];
  people: PersonOption[];
  logsRefreshKey: number;
  requests: InviteRequestRow[];
  invites: InviteRow[];
  competitions: AdminCompetitionRow[];
  ads: AdminAdRow[];
  competitionsLoading: boolean;
  appearance: AppearanceConfig;
  demo?: boolean;
  onAppearanceChange: (appearance: AppearanceConfig) => void;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  if (props.adminMode === "club" && !clubAdminTabs.includes(props.tab)) return <PeoplePanel {...props} />;
  if (props.tab === "desktop") return <DesktopAdminPanel adminMode={props.adminMode} teams={props.teams} people={props.people} requests={props.requests} competitions={props.competitions} onMessage={props.onMessage} onRefresh={props.onRefresh} />;
  if (props.tab === "competitions") return <CompetitionsAdminPanel competitions={props.competitions} loading={props.competitionsLoading} onMessage={props.onMessage} onRefresh={props.onRefresh} />;
  if (props.tab === "matches") return <MatchesAdminPanel onMessage={props.onMessage} />;
  if (props.tab === "people") return <PeoplePanel {...props} />;
  if (props.tab === "invites") return <PeoplePanel {...props} />;
  if (props.tab === "permissions") return <PermissionsPanel {...props} />;
  if (props.tab === "appearance") return <AppearancePanel {...props} />;
  if (props.tab === "adverts") return <AdvertsPanel {...props} />;
  if (props.tab === "logs") return <LogsPanel refreshKey={props.logsRefreshKey} />;
  return <InvitesPanel {...props} />;
}

function DesktopAdminPanel({
  adminMode,
  teams,
  people,
  requests,
  competitions,
  onMessage,
  onRefresh
}: {
  adminMode: AdminMode;
  teams: TeamOption[];
  people: PersonOption[];
  requests: InviteRequestRow[];
  competitions: AdminCompetitionRow[];
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const admins = people.filter((person) => person.admin).length;
  const clubs = uniqueClubs(teams).length;
  const players = people.filter((person) => person.teamRoles?.some((role) => role.role === "Player"));
  const managers = people.filter((person) => person.teamRoles?.some((role) => role.role === "Manager"));
  const withEmail = (person: PersonOption) => Boolean(person.email?.trim());
  const invitesSent = people.filter((person) => person.inviteSentAt || person.invitedAt).length;
  const invitesAccepted = people.filter((person) => person.inviteStatus === "Accepted" || person.inviteAcceptedAt).length;
  const invitesPending = people.filter((person) => person.inviteStatus === "Pending").length;
  const peopleWithEmail = people.filter(withEmail).length;
  const playersWithEmail = players.filter(withEmail).length;
  const playersWithoutEmail = players.length - playersWithEmail;
  const managersWithoutEmail = managers.filter((person) => !withEmail(person)).length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const loggedInThisWeek = people.filter((person) => person.lastLogin && Date.parse(person.lastLogin) >= oneWeekAgo).length;
  const activeLogins = people.filter((person) => person.loginActive).length;
  const neverLoggedIn = people.filter((person) => person.accountId && !person.lastLogin).length;
  const openCompetitions = competitions.filter((competition) => competition.status === "Open").length;
  const liveCompetitions = competitions.filter((competition) => competition.status === "Drawn" || competition.status === "In Progress").length;
  const completeCompetitions = competitions.filter((competition) => competition.status === "Complete").length;
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
    <div className="grid min-w-0 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{adminMode === "platform" ? "Admin overview" : "Club admin overview"}</CardTitle>
          <Badge variant="cyan">{adminMode === "platform" ? "Platform" : "Club"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric label="People" value={people.length} />
          <AdminMetric label="Players" value={players.length} />
          <AdminMetric label="Teams" value={teams.length} />
          <AdminMetric label={adminMode === "platform" ? "Clubs" : "Managers"} value={adminMode === "platform" ? clubs : managers.length} />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
            <Badge variant="muted">{invitesPending} pending</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <AdminMetric label="Sent" value={invitesSent} tone="cyan" />
            <AdminMetric label="Accepted" value={invitesAccepted} tone="green" />
            <AdminMetric label="Pending" value={invitesPending} tone="muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Login Activity</CardTitle>
            <Badge variant="muted">7 days</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <AdminMetric label="Logged in this week" value={loggedInThisWeek} tone="green" />
            <AdminMetric label="Active logins" value={activeLogins} tone="cyan" />
            <AdminMetric label="Never logged in" value={neverLoggedIn} tone="muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email Readiness</CardTitle>
            <Badge variant={playersWithoutEmail ? "muted" : "green"}>{peopleWithEmail}/{people.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <AdminMetric label="Players with email" value={playersWithEmail} tone="green" />
            <AdminMetric label="Players without email" value={playersWithoutEmail} tone={playersWithoutEmail ? "muted" : "green"} />
            <AdminMetric label="Managers without email" value={managersWithoutEmail} tone={managersWithoutEmail ? "muted" : "green"} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Competitions</CardTitle>
            <Badge variant="muted">{competitions.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <AdminMetric label="Open" value={openCompetitions} tone="green" />
            <AdminMetric label="Drawn / live" value={liveCompetitions} tone="cyan" />
            <AdminMetric label="Complete" value={completeCompetitions} tone="muted" />
          </CardContent>
        </Card>
        {adminMode === "platform" ? (
          <Card>
            <CardHeader>
              <CardTitle>2026/27 Tools</CardTitle>
              <Badge variant="muted">Platform</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button className="w-full justify-center" onClick={() => setGenerateOpen(true)}>
                <Trophy className="h-4 w-4" />
                Generate results
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => setResetOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Clear test results
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Invite Requests</CardTitle>
              <Badge variant="muted">{requests.length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2">
              {requests.length ? requests.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded-xl bg-[#f7f5fa] p-3">
                  <p className="font-extrabold">{request.requested_person_name}</p>
                  <p className="text-xs font-bold text-[#6c5a73]">{request.email}</p>
                  <Badge variant={request.status === "Pending" ? "cyan" : "muted"}>{request.status}</Badge>
                </div>
              )) : (
                <div className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">No pending requests</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {adminMode === "platform" && requests.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite Requests</CardTitle>
            <Badge variant="muted">{requests.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {requests.slice(0, 8).map((request) => (
              <div key={request.id} className="rounded-xl bg-[#f7f5fa] p-3">
                <p className="font-extrabold">{request.requested_person_name}</p>
                <p className="text-xs font-bold text-[#6c5a73]">{request.email}</p>
                <Badge variant={request.status === "Pending" ? "cyan" : "muted"}>{request.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
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

function MatchesAdminPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [matches, setMatches] = useState<AdminMatchRow[]>([]);
  const [seasons, setSeasons] = useState<AdminMatchSeason[]>([]);
  const [leagues, setLeagues] = useState<AdminMatchLeague[]>([]);
  const [season, setSeason] = useState("2026/27");
  const [league, setLeague] = useState("all");
  const [status, setStatus] = useState("Scheduled");
  const [fixtureType, setFixtureType] = useState("League");
  const [month, setMonth] = useState(currentAdminMonth());
  const [loading, setLoading] = useState(false);
  const [savingFixtureId, setSavingFixtureId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AdminMatchDraft>>({});
  const [expandedFixtureId, setExpandedFixtureId] = useState("");

  useEffect(() => {
    loadMatches();
  }, [season, league, status, fixtureType, month]);

  async function loadMatches() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ season, league, status, type: fixtureType, month: month || "all" });
      const response = await fetch(`/api/admin/matches?${params.toString()}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load matches.");
      const nextMatches = (data.matches ?? []) as AdminMatchRow[];
      setMatches(nextMatches);
      setSeasons((data.seasons ?? []) as AdminMatchSeason[]);
      setLeagues((data.leagues ?? []) as AdminMatchLeague[]);
      setDrafts(Object.fromEntries(nextMatches.map((match) => [match.fixture_id, matchDraft(match)])));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(fixtureId: string, patch: Partial<AdminMatchDraft>) {
    setDrafts((current) => ({
      ...current,
      [fixtureId]: {
        ...current[fixtureId],
        ...patch
      }
    }));
  }

  async function saveMatch(match: AdminMatchRow) {
    const draft = drafts[match.fixture_id];
    if (!draft) return;
    setSavingFixtureId(match.fixture_id);
    try {
      const response = await fetch("/api/admin/matches", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixtureId: match.fixture_id,
          fixtureDate: draft.fixtureDate,
          homeTeamId: draft.homeTeamId,
          awayTeamId: draft.awayTeamId,
          homeTeamScore: draft.homeTeamScore,
          awayTeamScore: draft.awayTeamScore,
          status: draft.status
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update match.");
      onMessage("Match updated.");
      await loadMatches();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update match.");
    } finally {
      setSavingFixtureId("");
    }
  }

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" }
  ];
  const typeOptions = [
    { value: "League", label: "League" },
    { value: "Friendly", label: "Friendly" },
    { value: "all", label: "All match types" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matches</CardTitle>
        <Badge variant="cyan">{matches.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-2xl bg-[#f7f5fa] p-3 md:grid-cols-5">
          <AdminSelect
            label="Season"
            value={season}
            onChange={setSeason}
            options={(seasons.length ? seasons : [{ id: "2026/27", name: "2026/27" }]).map((item) => ({ value: item.name, label: item.name }))}
          />
          <AdminSelect
            label="League"
            value={league}
            onChange={setLeague}
            options={[{ value: "all", label: "All leagues" }, ...leagues.map((item) => ({ value: item.name, label: item.name }))]}
          />
          <AdminSelect label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <AdminSelect label="Type" value={fixtureType} onChange={setFixtureType} options={typeOptions} />
          <AdminInput label="Month" value={month} onChange={setMonth} type="month" />
        </div>

        {loading ? <p className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold text-[#6c5a73]">Loading matches...</p> : null}

        <div className="grid gap-2">
          {matches.map((match) => {
            const draft = drafts[match.fixture_id] ?? matchDraft(match);
            const completeStatus = match.status === "Completed" ? "green" : match.status === "Cancelled" ? "muted" : "cyan";
            const showLineupStatuses = isTodayAdminDate(match.fixture_date);
            const draftChanged = adminMatchDraftChanged(match, draft);
            const expanded = expandedFixtureId === match.fixture_id;

            return (
              <div
                key={match.fixture_id}
                className="grid gap-2 rounded-xl border border-[#eeeaf2] bg-white p-2.5 shadow-sm xl:grid-cols-[160px_minmax(360px,1fr)_minmax(360px,.9fr)_86px] xl:items-center"
                onClick={() => setExpandedFixtureId((current) => current === match.fixture_id ? "" : match.fixture_id)}
              >
                <div className="min-w-0 cursor-pointer xl:self-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={completeStatus as "green" | "muted" | "cyan"}>{match.status}</Badge>
                    <Badge variant="muted">{match.league_name}</Badge>
                    <Badge variant="muted">{match.fixture_type}</Badge>
                    <Badge variant={expanded ? "green" : "muted"}>{expanded ? "Teams open" : "Click for teams"}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] font-bold leading-snug text-[#6c5a73]">
                    {formatAdminDate(match.fixture_date)}
                    {match.game_count ? <span className="block">{match.completed_game_count}/{match.game_count} frames scored</span> : null}
                    {match.lineup_count ? <span className="block">{match.lineup_count} lineup{match.lineup_count === 1 ? "" : "s"}</span> : null}
                  </p>
                </div>

                <div className="grid cursor-pointer gap-1.5">
                  <AdminMatchTeamScoreRow
                    align="left"
                    score={draft.homeTeamScore}
                    scoreLabel={`${match.home_team_name} score`}
                    showStatus={showLineupStatuses}
                    status={match.home_lineup_status}
                    teamName={match.home_team_name}
                    onScoreChange={(value) => updateDraft(match.fixture_id, { homeTeamScore: value })}
                  />
                  <AdminMatchTeamScoreRow
                    align="left"
                    score={draft.awayTeamScore}
                    scoreLabel={`${match.away_team_name} score`}
                    showStatus={showLineupStatuses}
                    status={match.away_lineup_status}
                    teamName={match.away_team_name}
                    onScoreChange={(value) => updateDraft(match.fixture_id, { awayTeamScore: value })}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(200px,1fr)_132px]" onClick={(event) => event.stopPropagation()}>
                  <CompactAdminInput
                    label="Fixture date / postponed until"
                    value={draft.fixtureDate}
                    onChange={(value) => updateDraft(match.fixture_id, { fixtureDate: value })}
                    type="date"
                  />
                  <CompactAdminSelect
                    label="Status"
                    value={draft.status}
                    onChange={(value) => updateDraft(match.fixture_id, { status: value })}
                    options={statusOptions.filter((option) => option.value !== "all")}
                  />
                </div>

                <Button onClick={(event) => {
                  event.stopPropagation();
                  saveMatch(match);
                }} disabled={!draftChanged || savingFixtureId === match.fixture_id} size="sm">
                  {savingFixtureId === match.fixture_id ? "Saving..." : "Save"}
                </Button>
                {expanded ? (
                  <div className="grid gap-2 xl:col-span-4 xl:grid-cols-2" onClick={(event) => event.stopPropagation()}>
                    <AdminLineupEditor
                      target={{
                        fixtureId: match.fixture_id,
                        teamId: match.home_team_id,
                        teamName: match.home_team_name,
                        leagueName: match.league_name
                      }}
                      onMessage={onMessage}
                      onSaved={loadMatches}
                    />
                    <AdminLineupEditor
                      target={{
                        fixtureId: match.fixture_id,
                        teamId: match.away_team_id,
                        teamName: match.away_team_name,
                        leagueName: match.league_name
                      }}
                      onMessage={onMessage}
                      onSaved={loadMatches}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!loading && !matches.length ? (
          <p className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold text-[#6c5a73]">No matches found for those filters.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AdminLineupEditor({
  target,
  onMessage,
  onSaved
}: {
  target: NonNullable<AdminLineupEditorTarget>;
  onMessage: (message: string) => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [players, setPlayers] = useState<AdminLineupPlayer[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<AdminLineupPlayer[]>([]);
  const [slots, setSlots] = useState<AdminLineupSlot[]>([]);
  const [lineupStatus, setLineupStatus] = useState<"Draft" | "Published">("Draft");

  useEffect(() => {
    let active = true;
    async function loadLineup() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ teamId: target.teamId, fixtureId: target.fixtureId });
        const response = await fetch(`/api/manager/lineup?${params.toString()}`, { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load lineup.");
        if (!active) return;
        const payload = data as AdminLineupPayload;
        setPlayers(payload.players ?? []);
        setGuestPlayers(payload.guestPlayers ?? []);
        setSlots(payload.lineup?.slots ?? []);
        setLineupStatus(payload.lineup?.status ?? "Draft");
      } catch (error) {
        if (active) onMessage(error instanceof Error ? error.message : "Could not load lineup.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLineup();
    return () => {
      active = false;
    };
  }, [onMessage, target.fixtureId, target.teamId]);

  const requiredPlayerSlots = slots.reduce((total, slot) => total + (slot.gameType === "Doubles" ? 2 : 1), 0);
  const selectedPlayerSlots = slots.reduce((total, slot) => (
    total
    + (adminLineupSlotHasPlayer(slot, "player1") ? 1 : 0)
    + (slot.gameType === "Doubles" && adminLineupSlotHasPlayer(slot, "player2") ? 1 : 0)
  ), 0);
  const selectedIds = new Set(slots.flatMap((slot) => [slot.player1Id, slot.player2Id].filter(Boolean)));

  function updateSlot(slotNumber: number, prefix: "player1" | "player2", patch: Partial<AdminLineupSlot>) {
    setSlots((current) => current.map((slot) => slot.slotNumber === slotNumber ? { ...slot, ...patch } : slot));
  }

  function selectPlayer(slot: AdminLineupSlot, prefix: "player1" | "player2", value: string) {
    const idKey = `${prefix}Id` as "player1Id" | "player2Id";
    const guestNameKey = `${prefix}GuestName` as "player1GuestName" | "player2GuestName";
    const guestKey = `${prefix}IsGuest` as "player1IsGuest" | "player2IsGuest";
    if (!value) {
      updateSlot(slot.slotNumber, prefix, { [idKey]: "", [guestNameKey]: "", [guestKey]: false });
      return;
    }
    const [kind, playerId] = value.split(":");
    updateSlot(slot.slotNumber, prefix, {
      [idKey]: playerId,
      [guestNameKey]: "",
      [guestKey]: kind === "guest"
    });
  }

  function setTypedGuest(slot: AdminLineupSlot, prefix: "player1" | "player2", value: string) {
    const idKey = `${prefix}Id` as "player1Id" | "player2Id";
    const guestNameKey = `${prefix}GuestName` as "player1GuestName" | "player2GuestName";
    const guestKey = `${prefix}IsGuest` as "player1IsGuest" | "player2IsGuest";
    updateSlot(slot.slotNumber, prefix, {
      [idKey]: "",
      [guestNameKey]: value,
      [guestKey]: Boolean(value.trim())
    });
  }

  async function saveLineup(action: "save" | "publish") {
    setBusy(action);
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: target.teamId,
          fixtureId: target.fixtureId,
          action,
          slots,
          adminOverride: true
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save lineup.");
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setLineupStatus(data.lineup?.status ?? (action === "publish" ? "Published" : "Draft"));
      onMessage(action === "publish" ? `${target.teamName} lineup published.` : `${target.teamName} draft lineup saved.`);
      await onSaved();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save lineup.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-lg bg-[#f7f5fa] p-2 ring-1 ring-[#eeeaf2]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-extrabold text-[#10233f]" title={target.teamName}>{target.teamName}</h3>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant={lineupStatus === "Published" ? "green" : "cyan"}>{lineupStatus}</Badge>
          <Badge variant="muted">{selectedPlayerSlots}/{requiredPlayerSlots} picked</Badge>
        </div>
      </div>
      {loading ? (
        <p className="mt-2 rounded-lg bg-white p-2 text-xs font-bold text-[#6c5a73]">Loading team selection...</p>
      ) : (
        <div className="mt-2 grid gap-1.5">
          {slots.map((slot) => (
            <div key={slot.slotNumber} className="grid gap-2 rounded-lg bg-white p-2 ring-1 ring-[#eeeaf2] md:grid-cols-[82px_minmax(0,1fr)] md:items-start">
              <div className="flex items-center gap-1.5 md:grid md:gap-1">
                <p className="text-[10px] font-black uppercase text-[#6c5a73]">G{slot.slotNumber}</p>
                <Badge variant={slot.gameType === "Doubles" ? "cyan" : "muted"}>{slot.gameType === "Doubles" ? "Dbl" : "Sgl"}</Badge>
              </div>
              <div className={cn("grid gap-2", slot.gameType === "Doubles" ? "md:grid-cols-2" : "")}>
                <AdminLineupPlayerField
                  label={slot.gameType === "Doubles" ? "Player 1" : "Player"}
                  slot={slot}
                  prefix="player1"
                  players={players}
                  guestPlayers={guestPlayers}
                  selectedIds={selectedIds}
                  onSelect={(value) => selectPlayer(slot, "player1", value)}
                  onTypedGuest={(value) => setTypedGuest(slot, "player1", value)}
                />
                {slot.gameType === "Doubles" ? (
                  <AdminLineupPlayerField
                    label="Player 2"
                    slot={slot}
                    prefix="player2"
                    players={players}
                    guestPlayers={guestPlayers}
                    selectedIds={selectedIds}
                    onSelect={(value) => selectPlayer(slot, "player2", value)}
                    onTypedGuest={(value) => setTypedGuest(slot, "player2", value)}
                  />
                ) : null}
              </div>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => saveLineup("save")} disabled={Boolean(busy)}>
              {busy === "save" ? "Saving..." : "Save draft"}
            </Button>
            <Button type="button" size="sm" onClick={() => saveLineup("publish")} disabled={Boolean(busy) || selectedPlayerSlots < requiredPlayerSlots}>
              {busy === "publish" ? "Publishing..." : lineupStatus === "Published" ? "Override published lineup" : "Publish lineup"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLineupPlayerField({
  label,
  slot,
  prefix,
  players,
  guestPlayers,
  selectedIds,
  onSelect,
  onTypedGuest
}: {
  label: string;
  slot: AdminLineupSlot;
  prefix: "player1" | "player2";
  players: AdminLineupPlayer[];
  guestPlayers: AdminLineupPlayer[];
  selectedIds: Set<string>;
  onSelect: (value: string) => void;
  onTypedGuest: (value: string) => void;
}) {
  const idKey = `${prefix}Id` as "player1Id" | "player2Id";
  const guestNameKey = `${prefix}GuestName` as "player1GuestName" | "player2GuestName";
  const guestKey = `${prefix}IsGuest` as "player1IsGuest" | "player2IsGuest";
  const selectedId = slot[idKey] ?? "";
  const selectedValue = selectedId ? `${slot[guestKey] ? "guest" : "player"}:${selectedId}` : "";
  const typedGuest = slot[guestNameKey] ?? "";

  return (
    <div className="grid gap-1">
      <label className="grid gap-1">
        <span className="text-[10px] font-black uppercase text-[#6c5a73]">{label}</span>
        <select
          className="min-h-8 w-full min-w-0 rounded-lg border border-[#eeeaf2] bg-white px-2 text-xs font-bold text-[#10233f] outline-none focus-visible:outline-[#7bc7d6]"
          value={selectedValue}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Pick player</option>
          <optgroup label="Panel players">
            {players.map((player) => {
              const unavailable = selectedIds.has(player.id) && player.id !== selectedId;
              return (
                <option key={player.id} value={`player:${player.id}`} disabled={unavailable}>
                  {player.name}{unavailable ? " - picked" : ""}
                </option>
              );
            })}
          </optgroup>
          {guestPlayers.length ? (
            <optgroup label="Guest players">
              {guestPlayers.map((player) => {
                const unavailable = (selectedIds.has(player.id) && player.id !== selectedId) || Boolean(player.disabledReason);
                return (
                  <option key={player.id} value={`guest:${player.id}`} disabled={unavailable}>
                    {player.name}{player.teamName ? ` - ${player.teamName}` : ""}{player.disabledReason ? ` - ${player.disabledReason}` : unavailable ? " - picked" : ""}
                  </option>
                );
              })}
            </optgroup>
          ) : null}
        </select>
      </label>
      <label className="grid gap-0.5">
        <span className="text-[9px] font-black uppercase text-[#6c5a73]">Typed guest fallback</span>
        <input
          className="min-h-8 w-full min-w-0 rounded-lg border border-[#eeeaf2] bg-white px-2 text-xs font-bold text-[#10233f] outline-none focus-visible:outline-[#7bc7d6]"
          value={typedGuest}
          onChange={(event) => onTypedGuest(event.target.value)}
          placeholder="Only if not in system"
        />
      </label>
    </div>
  );
}

function adminLineupSlotHasPlayer(slot: AdminLineupSlot, prefix: "player1" | "player2") {
  const idKey = `${prefix}Id` as "player1Id" | "player2Id";
  const guestNameKey = `${prefix}GuestName` as "player1GuestName" | "player2GuestName";
  return Boolean(slot[idKey] || String(slot[guestNameKey] ?? "").trim());
}

function AdminMatchTeamScoreRow({
  align,
  score,
  scoreLabel,
  showStatus,
  status,
  teamName,
  onScoreChange
}: {
  align: "left" | "right";
  score: string;
  scoreLabel: string;
  showStatus: boolean;
  status: string | null;
  teamName: string;
  onScoreChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_58px] items-center gap-1.5">
      <AdminMatchTeamStatus align={align} showStatus={showStatus} status={status} teamName={teamName} />
      <CompactScoreInput ariaLabel={scoreLabel} value={score} onChange={onScoreChange} />
    </div>
  );
}

function AdminMatchTeamStatus({
  align,
  showStatus,
  status,
  teamName
}: {
  align: "left" | "right";
  showStatus: boolean;
  status: string | null;
  teamName: string;
}) {
  return (
    <div className={cn("rounded-lg bg-[#f7f5fa] px-2.5 py-1.5", align === "right" ? "sm:text-right" : "")}>
      <p className="truncate text-[13px] font-extrabold text-[#10233f]" title={teamName}>{teamName}</p>
      {showStatus ? (
        <span className={cn("mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]", adminLineupStatusClass(status))}>
          {adminLineupStatusLabel(status)}
        </span>
      ) : null}
    </div>
  );
}

function adminMatchDraftChanged(match: AdminMatchRow, draft: AdminMatchDraft) {
  const original = matchDraft(match);
  return original.fixtureDate !== draft.fixtureDate
    || original.homeTeamScore !== draft.homeTeamScore
    || original.awayTeamScore !== draft.awayTeamScore
    || original.status !== draft.status;
}

function adminLineupStatusLabel(status: string | null) {
  if (status === "Published") return "PUBLISHED";
  if (status === "Draft") return "DRAFT SAVED";
  return "TO BE PICKED";
}

function adminLineupStatusClass(status: string | null) {
  if (status === "Published") return "bg-[#00ff85] text-[#041a12]";
  if (status === "Draft") return "bg-[#04f5ff] text-[#10233f]";
  return "bg-[#eeeaf2] text-[#6c5a73]";
}

function isTodayAdminDate(value: string) {
  const fixtureDate = new Date(value);
  if (Number.isNaN(fixtureDate.getTime())) return false;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Dublin",
    year: "numeric"
  });
  return formatter.format(fixtureDate) === formatter.format(new Date());
}

function currentAdminMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Europe/Dublin",
    year: "numeric"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? String(new Date().getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(new Date().getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function matchDraft(match: AdminMatchRow) {
  return {
    fixtureDate: match.fixture_date ? new Date(match.fixture_date).toISOString().slice(0, 10) : "",
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    homeTeamScore: match.home_team_score == null ? "" : String(match.home_team_score),
    awayTeamScore: match.away_team_score == null ? "" : String(match.away_team_score),
    status: match.status
  };
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

function AdminMetric({ label, value, tone = "dark" }: { label: string; value: number; tone?: "dark" | "cyan" | "green" | "muted" }) {
  const toneClass = {
    dark: "bg-[#10233f] text-white",
    cyan: "bg-[#00e5ff] text-[#10233f]",
    green: "bg-[#00ff85] text-[#10233f]",
    muted: "bg-[#f7f5fa] text-[#25002b] ring-1 ring-[#eeeaf2]"
  }[tone];
  const labelClass = tone === "dark" ? "text-white/60" : "text-[#6c5a73]";

  return (
    <div className={cn("rounded-xl p-4", toneClass)}>
      <p className={cn("text-xs font-bold uppercase", labelClass)}>{label}</p>
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
  adminMode,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  people: PersonOption[];
  adminMode: AdminMode;
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
  const [editTarget, setEditTarget] = useState<PersonOption | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [inviteSelectionStatus, setInviteSelectionStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [bccGarry, setBccGarry] = useState(false);

  useEffect(() => {
    const nextTeams = teams.filter((team) => team.clubId === clubId);
    if (!nextTeams.some((team) => team.teamId === teamId)) {
      setTeamId(nextTeams[0]?.teamId ?? "");
    }
  }, [clubId, teamId, teams]);

  const filterTeams = useMemo(() => {
    const scopedTeams = clubFilter === "all" ? teams : teams.filter((team) => team.clubName === clubFilter);
    const seen = new Set<string>();
    return scopedTeams.filter((team) => {
      const key = `${team.clubName}::${team.teamName}::${team.leagueName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.clubName.localeCompare(b.clubName) || a.teamName.localeCompare(b.teamName) || a.leagueName.localeCompare(b.leagueName));
  }, [clubFilter, teams]);

  useEffect(() => {
    if (teamFilter === "all") return;
    if (!filterTeams.some((team) => team.teamName === teamFilter)) {
      setTeamFilter("all");
    }
  }, [filterTeams, teamFilter]);

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

  async function disableSelectedLogins() {
    const selectedPeople = people.filter((person) => selectedPersonIds.includes(person.personId));
    const loginPeople = selectedPeople.filter((person) => person.accountId && person.loginActive);
    if (!loginPeople.length) {
      onMessage("Select people with active logins to disable.");
      return;
    }

    if (demo) {
      onMessage(`${loginPeople.length} login${loginPeople.length === 1 ? "" : "s"} disabled.`);
      setSelectedPersonIds([]);
      return;
    }

    setBusyPersonId("bulk-disable");
    try {
      const results = await Promise.all(loginPeople.map(async (person) => {
        const response = await fetch("/api/admin/people", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ personId: person.personId, loginActive: false })
        });
        const data = await response.json().catch(() => ({}));
        return {
          ok: response.ok,
          error: data.error || `Could not disable ${person.name}.`
        };
      }));
      const disabled = results.filter((result) => result.ok).length;
      const failed = results.length - disabled;
      onMessage([
        disabled ? `${disabled} login${disabled === 1 ? "" : "s"} disabled` : "",
        failed ? `${failed} failed` : ""
      ].filter(Boolean).join(", ") || "No logins were disabled.");
      setSelectedPersonIds([]);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not disable selected logins.");
    } finally {
      setBusyPersonId("");
    }
  }

  async function updatePersonDetails(details: { personId: string; firstName: string; lastName: string; email: string; phone: string; handicap: string; roles: Array<{ role: TeamRole; teamId: string }>; leagueChair: boolean }) {
    if (demo) {
      onMessage("Person details updated.");
      setEditTarget(null);
      return;
    }

    setBusyPersonId(details.personId);
    try {
      const response = await fetch("/api/admin/people", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "details", ...details })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update person.");
      onMessage(`${details.firstName} ${details.lastName}`.trim() + " updated.");
      setEditTarget(null);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update person.");
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
        body: JSON.stringify({ invitationId: person.invitationId, bccGarry })
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

  async function inviteSelectedPeople() {
    const selectedPeople = people.filter((person) => selectedPersonIds.includes(person.personId));
    const eligiblePeople = selectedPeople.filter(canSelectForInviteEmail);
    const newInvitePeople = eligiblePeople.filter((person) => !person.invitedAt);
    const pendingInvitePeople = eligiblePeople.filter(isPendingInvite);
    if (!eligiblePeople.length) {
      onMessage("Select people who have an email address and either have not been invited or have a pending invite.");
      return;
    }

    if (demo) {
      onMessage(`Invite emails queued/resent for ${eligiblePeople.length} people.`);
      setSelectedPersonIds([]);
      return;
    }

    setInviteSelectionStatus({ tone: "info", text: `Sending ${eligiblePeople.length} invite email${eligiblePeople.length === 1 ? "" : "s"}...` });
    setBusyPersonId("bulk-invite");
    try {
      const results: Array<{ status?: string; error?: string }> = [];

      if (newInvitePeople.length) {
        const response = await fetch("/api/admin/invites", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ personIds: newInvitePeople.map((person) => person.personId), bccGarry })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not send invite emails.");
        if (Array.isArray(data.results)) results.push(...data.results);
      }

      for (const person of pendingInvitePeople) {
        try {
          const response = await fetch("/api/admin/invites", {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ invitationId: person.invitationId, bccGarry })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Could not resend invite.");
          results.push({ status: data.email_status ?? "Queued" });
        } catch (error) {
          results.push({ status: "Failed", error: error instanceof Error ? error.message : "Could not resend invite." });
        }
      }

      const sent = results.filter((item: { status?: string }) => item.status === "Sent" || item.status === "Queued").length;
      const skipped = results.filter((item: { status?: string }) => item.status === "Skipped").length;
      const failed = results.filter((item: { status?: string }) => item.status === "Failed").length;
      const message = [
        sent ? `${sent} invite${sent === 1 ? "" : "s"} sent/queued` : "",
        skipped ? `${skipped} skipped` : "",
        failed ? `${failed} failed` : ""
      ].filter(Boolean).join(", ") || "No invites were sent.";
      setInviteSelectionStatus({ tone: failed ? "error" : "success", text: message });
      onMessage(message);
      setSelectedPersonIds([]);
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send invite emails.";
      setInviteSelectionStatus({ tone: "error", text: message });
      onMessage(message);
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

    function matchesRole(person: PersonOption) {
      if (roleFilter === "all") return true;
      if (roleFilter === "admin") return Boolean(person.admin);
      if (roleFilter === "club-admin") return Boolean(person.clubAdmins?.length);
      if (roleFilter === "league-chair") return Boolean(person.clubHandicaps?.some((club) => club.role === "League Chair"));
      if (roleFilter === "club-member") return Boolean(person.clubHandicaps?.some((club) => club.role !== "League Chair"));
      return Boolean(person.teamRoles?.some((role) => role.role === roleFilter));
    }

    function matchesTeam(person: PersonOption) {
      if (teamFilter === "all") return true;
      return Boolean(person.teamRoles?.some((role) => role.team_name === teamFilter));
    }

    return people
      .filter((person) => {
        const clubsForPerson = personClubNames(person);
        const roleLabels = [
          ...(person.teamRoles ?? []).map((role) => `${role.role} ${role.team_name} ${role.league_name} ${role.club_name}`),
          ...(person.clubAdmins ?? []).map((club) => `Club Admin ${club.club_name}`),
          ...(person.clubHandicaps ?? []).map((club) => `${club.role ?? "Club Member"} ${club.club_name}`),
          person.admin ? "Administrator" : ""
        ];
        const searchHaystack = [
          person.name,
          person.email,
          person.phone,
          person.username,
          person.inviteStatus,
          ...roleLabels,
          ...clubsForPerson
        ].filter(Boolean).join(" ").toLowerCase();

        return (!search || searchHaystack.includes(search))
          && (clubFilter === "all" || clubsForPerson.includes(clubFilter))
          && matchesTeam(person)
          && matchesRole(person)
          && matchesStatus(person);
      })
      .sort((a, b) => {
        if (sortBy === "email") return (a.email || "").localeCompare(b.email || "");
        if (sortBy === "club") {
          const clubA = a.clubHandicaps?.[0]?.club_name ?? a.clubAdmins?.[0]?.club_name ?? "";
          const clubB = b.clubHandicaps?.[0]?.club_name ?? b.clubAdmins?.[0]?.club_name ?? "";
          return clubA.localeCompare(clubB) || a.name.localeCompare(b.name);
        }
        if (sortBy === "handicap") return personPrimaryHandicap(a) - personPrimaryHandicap(b) || a.name.localeCompare(b.name);
        if (sortBy === "invite") return (Date.parse(b.invitedAt ?? "") || 0) - (Date.parse(a.invitedAt ?? "") || 0);
        if (sortBy === "status") return (a.inviteStatus || "No invite").localeCompare(b.inviteStatus || "No invite") || a.name.localeCompare(b.name);
        if (sortBy === "login") return Number(Boolean(b.loginActive)) - Number(Boolean(a.loginActive)) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [clubFilter, people, roleFilter, searchTerm, sortBy, statusFilter, teamFilter]);

  function isPendingInvite(person: PersonOption) {
    return Boolean(person.invitationId && person.inviteStatus === "Pending");
  }

  function canSelectForInviteEmail(person: PersonOption) {
    return Boolean(person.email && (!person.invitedAt || isPendingInvite(person)));
  }

  const selectedEligibleCount = useMemo(() => {
    return people.filter((person) => selectedPersonIds.includes(person.personId) && canSelectForInviteEmail(person)).length;
  }, [people, selectedPersonIds]);
  const selectedLoginOnCount = useMemo(() => {
    return people.filter((person) => selectedPersonIds.includes(person.personId) && person.accountId && person.loginActive).length;
  }, [people, selectedPersonIds]);
  const allVisibleSelected = visiblePeople.length > 0 && visiblePeople.every((person) => selectedPersonIds.includes(person.personId));

  function toggleSelectedPerson(personId: string, selected: boolean) {
    setSelectedPersonIds((current) => {
      if (selected) return current.includes(personId) ? current : [...current, personId];
      return current.filter((id) => id !== personId);
    });
  }

  function toggleVisiblePeople(selected: boolean) {
    const visibleIds = visiblePeople.map((person) => person.personId);
    setSelectedPersonIds((current) => {
      if (!selected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>People</CardTitle>
          <Badge variant="muted">{visiblePeople.length} / {people.length}</Badge>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3">
          <div className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] md:grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(0,1fr))]">
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
              label="Team"
              value={teamFilter}
              onChange={setTeamFilter}
              options={[
                { value: "all", label: clubFilter === "all" ? "All teams" : `All ${clubFilter.replace(" Golf Club", "")} teams` },
                ...filterTeams.map((team) => ({
                  value: team.teamName,
                  label: clubFilter === "all" ? `${team.teamName} - ${team.clubName.replace(" Golf Club", "")}` : `${team.teamName} - ${team.leagueName}`
                }))
              ]}
            />
            <AdminSelect
              label="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "All roles" },
                { value: "Player", label: "Players" },
                { value: "Manager", label: "Managers" },
                { value: "club-member", label: "Club members" },
                { value: "club-admin", label: "Club admins" },
                { value: "league-chair", label: "League chairs" },
                { value: "admin", label: "Platform admins" }
              ]}
            />
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
                { value: "handicap", label: "Handicap" },
                { value: "login", label: "Login status" },
                { value: "invite", label: "Newest invite" },
                { value: "status", label: "Invite status" }
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
            <div>
              <p className="text-sm font-extrabold text-[#10233f]">Selected people</p>
              <p className="text-xs font-semibold text-[#6c5a73]">Tick people to send invites or disable active logins in bulk.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toggleVisiblePeople(!allVisibleSelected)}
                disabled={!visiblePeople.length}
              >
                {allVisibleSelected ? "Clear visible" : "Select visible"}
              </Button>
              <Button
                size="sm"
                onClick={inviteSelectedPeople}
                disabled={!selectedEligibleCount || busyPersonId === "bulk-invite"}
              >
                <Mail className="h-4 w-4" />
                {busyPersonId === "bulk-invite" ? "Sending..." : `Send/resend (${selectedEligibleCount})`}
              </Button>
              {adminMode === "platform" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={disableSelectedLogins}
                  disabled={!selectedLoginOnCount || busyPersonId === "bulk-disable"}
                  className="text-[#b42318]"
                >
                  {busyPersonId === "bulk-disable" ? "Disabling..." : `Disable selected (${selectedLoginOnCount})`}
                </Button>
              ) : null}
            </div>
            <label className="flex w-full items-center gap-2 text-xs font-bold text-[#6c5a73] sm:w-auto">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#10233f]"
                checked={bccGarry}
                onChange={(event) => setBccGarry(event.target.checked)}
              />
              BCC Garry
            </label>
          </div>
          {inviteSelectionStatus ? <InviteSendStatus tone={inviteSelectionStatus.tone} text={inviteSelectionStatus.text} /> : null}
          <div className="min-w-0 overflow-x-auto rounded-xl ring-1 ring-[#eeeaf2]">
            <div className="hidden min-w-[1120px] grid-cols-[30px_minmax(120px,1fr)_minmax(145px,1fr)_minmax(95px,.7fr)_60px_minmax(165px,1fr)_72px_78px_96px_180px] gap-2 bg-[#f7f5fa] px-3 py-2 text-[11px] font-black uppercase text-[#6c5a73] lg:grid">
              <span>
                <input
                  className="h-4 w-4 accent-[#10233f]"
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!visiblePeople.length}
                  onChange={(event) => toggleVisiblePeople(event.target.checked)}
                  aria-label="Select visible people"
                />
              </span>
              <span>Person</span>
              <span>Email</span>
              <span>Club</span>
              <span>Hcp</span>
              <span>Roles</span>
              <span>Login</span>
              <span>Invited</span>
              <span>Invite status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="max-h-[680px] min-w-[1120px] overflow-y-auto">
              {visiblePeople.map((person) => {
                const clubLabels = visiblePersonClubLabels(person);
                const handicapLabel = personHandicapLabel(person);
                const clubsForPerson = Array.from(new Set([
                  ...(person.clubHandicaps ?? []).map((item) => item.club_name),
                  ...(person.clubAdmins ?? []).map((item) => item.club_name)
                ].filter(Boolean)));
                const roleLabels = visiblePersonRoleLabels(person);
                return (
                  <div key={person.personId} className="grid min-w-0 gap-2 border-t border-[#eeeaf2] px-3 py-2 text-[13px] font-bold text-[#10233f] lg:grid-cols-[30px_minmax(120px,1fr)_minmax(145px,1fr)_minmax(95px,.7fr)_60px_minmax(165px,1fr)_72px_78px_96px_180px] lg:items-center lg:gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#6c5a73]">
                      <input
                        className="h-4 w-4 accent-[#10233f]"
                        type="checkbox"
                        checked={selectedPersonIds.includes(person.personId)}
                        onChange={(event) => toggleSelectedPerson(person.personId, event.target.checked)}
                        aria-label={`Select ${person.name}`}
                      />
                      <span className="lg:hidden">Select</span>
                    </label>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-extrabold">{person.name}</span>
                      {person.admin ? <Badge variant="green">Admin</Badge> : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 truncate text-[#6c5a73]">{person.email || "No email yet"}</p>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1" title={clubsForPerson.join(" / ")}>
                      {clubLabels.length ? clubLabels.slice(0, 2).map((label) => (
                        <span key={label} className="max-w-full truncate rounded-md bg-[#f7f5fa] px-1.5 py-0.5 text-[11px] font-black uppercase leading-tight text-[#6c5a73] ring-1 ring-[#eeeaf2]">
                          {label}
                        </span>
                      )) : (
                        <span className="text-xs font-bold text-[#6c5a73]">-</span>
                      )}
                      {clubLabels.length > 2 ? <Badge variant="cyan">+{clubLabels.length - 2}</Badge> : null}
                    </div>
                    <div className="flex min-w-0">
                      {handicapLabel ? (
                        <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-black leading-tight text-[#10233f] ring-1 ring-[#eeeaf2]">
                          {handicapLabel}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#6c5a73]">-</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1" title={roleLabels.join(" / ")}>
                      {roleLabels.length ? roleLabels.slice(0, 3).map((label) => (
                        <Badge key={label} variant="muted" className="max-w-full truncate">
                          {label}
                        </Badge>
                      )) : (
                        <span className="text-xs font-bold text-[#6c5a73]">-</span>
                      )}
                      {roleLabels.length > 3 ? <Badge variant="cyan">+{roleLabels.length - 3}</Badge> : null}
                    </div>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditTarget(person)}
                        disabled={busyPersonId === person.personId}
                        className="min-h-9 shrink-0 px-2 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
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
                      {adminMode === "platform" ? (
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
                      ) : null}
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
          {adminMode === "platform" ? (
            <AdminCheckbox label="Make administrator" checked={admin} onChange={setAdmin} description="Administrators can access the admin console once they have a login." />
          ) : null}
        </CardContent>
      </Card>
      <BulkInviteImportPanel teams={teams} demo={demo} onMessage={onMessage} onRefresh={onRefresh} />
      {editTarget ? (
        <EditPersonModal
          person={editTarget}
          teams={teams}
          canManageLogin={adminMode === "platform"}
          canManageLeagueChair={adminMode === "platform"}
          busy={busyPersonId === editTarget.personId}
          onCancel={() => setEditTarget(null)}
          onConfirm={updatePersonDetails}
          onSetLoginAccess={(loginActive) => setLoginAccess(editTarget, loginActive)}
        />
      ) : null}
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

function visiblePersonRoleLabels(person: PersonOption) {
  const teamLabels = (person.teamRoles ?? []).map((role) => `${role.role} - ${role.team_name}`);
  const clubAdminLabels = (person.clubAdmins ?? []).map((club) => `Club Admin - ${shortClubName(club.club_name)}`);
  const leagueChairLabels = (person.clubHandicaps ?? []).some((club) => club.role === "League Chair")
    ? ["Interclub League Chair"]
    : [];
  const clubMemberLabels = teamLabels.length || clubAdminLabels.length
    ? []
    : (person.clubHandicaps ?? [])
      .filter((club) => club.role !== "League Chair")
      .map((club) => `Club Member - ${shortClubName(club.club_name)}`);
  const platformLabels = person.admin ? ["Administrator"] : [];

  return Array.from(new Set([...platformLabels, ...teamLabels, ...clubAdminLabels, ...leagueChairLabels, ...clubMemberLabels]));
}

function visiblePersonClubLabels(person: PersonOption) {
  const labels = (person.clubHandicaps ?? []).map((club) => shortClubName(club.club_name));
  const adminOnlyLabels = (person.clubAdmins ?? [])
    .filter((club) => !(person.clubHandicaps ?? []).some((handicapClub) => handicapClub.club_id === club.club_id))
    .map((club) => `${shortClubName(club.club_name)} Admin`);

  return Array.from(new Set([...labels, ...adminOnlyLabels]));
}

function personHandicapLabel(person: PersonOption) {
  const rawHandicap = personPrimaryHandicapValue(person);
  return rawHandicap === null ? "" : formatHandicap(rawHandicap);
}

function personPrimaryHandicap(person: PersonOption) {
  const rawHandicap = personPrimaryHandicapValue(person);
  const numeric = Number(rawHandicap);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function personPrimaryHandicapValue(person: PersonOption) {
  return (person.clubHandicaps ?? []).find((club) => club.role !== "League Chair" && club.handicap !== null && club.handicap !== undefined)?.handicap ?? null;
}

function shortClubName(name: string) {
  return name.replace(/\s+Golf Club$/i, "").trim();
}

function EditPersonModal({
  person,
  teams,
  canManageLogin,
  canManageLeagueChair,
  busy,
  onCancel,
  onConfirm,
  onSetLoginAccess
}: {
  person: PersonOption;
  teams: TeamOption[];
  canManageLogin: boolean;
  canManageLeagueChair: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (details: { personId: string; firstName: string; lastName: string; email: string; phone: string; handicap: string; roles: Array<{ role: TeamRole; teamId: string }>; leagueChair: boolean }) => void;
  onSetLoginAccess: (loginActive: boolean) => void;
}) {
  const firstHandicap = person.clubHandicaps?.find((item) => item.handicap !== null && item.handicap !== undefined)?.handicap;
  const initialRoles = useMemo<EditRoleRow[]>(() => {
    const rows = (person.teamRoles ?? []).map((teamRole, index) => {
      const matchingTeam = teams.find((team) =>
        team.teamName === teamRole.team_name
        && team.leagueName === teamRole.league_name
        && team.clubName === teamRole.club_name
      );
      if (!matchingTeam || (teamRole.role !== "Player" && teamRole.role !== "Manager")) return null;
      return {
        id: `${matchingTeam.teamId}-${teamRole.role}-${index}`,
        role: teamRole.role as TeamRole,
        teamId: matchingTeam.teamId
      };
    }).filter((row): row is EditRoleRow => Boolean(row));

    return rows.length ? rows : [];
  }, [person.teamRoles, teams]);
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName);
  const [email, setEmail] = useState(person.email ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [handicap, setHandicap] = useState(firstHandicap === null || firstHandicap === undefined ? "" : String(firstHandicap));
  const [roleRows, setRoleRows] = useState<EditRoleRow[]>(initialRoles);
  const [leagueChair, setLeagueChair] = useState(() => (person.clubHandicaps ?? []).some((club) => club.role === "League Chair"));
  const canSave = Boolean(firstName.trim() && lastName.trim());
  const allowedClubs = useMemo(() => {
    const byName = new Map<string, { clubId: string; clubName: string }>();
    for (const teamRole of person.teamRoles ?? []) {
      const team = teams.find((option) => option.teamName === teamRole.team_name && option.leagueName === teamRole.league_name && option.clubName === teamRole.club_name);
      if (team) byName.set(team.clubName, { clubId: team.clubId, clubName: team.clubName });
    }
    for (const club of person.clubHandicaps ?? []) {
      byName.set(club.club_name, { clubId: club.club_id, clubName: club.club_name });
    }
    for (const club of person.clubAdmins ?? []) {
      byName.set(club.club_name, { clubId: club.club_id, clubName: club.club_name });
    }
    return Array.from(byName.values()).sort((a, b) => a.clubName.localeCompare(b.clubName));
  }, [person.clubAdmins, person.clubHandicaps, person.teamRoles, teams]);
  const allowedClubNames = useMemo(() => {
    return new Set(allowedClubs.map((club) => club.clubName));
  }, [allowedClubs]);
  const sortedTeams = useMemo(() => {
    return teams
      .filter((team) => allowedClubNames.has(team.clubName))
      .sort((a, b) => a.clubName.localeCompare(b.clubName) || a.teamName.localeCompare(b.teamName) || a.leagueName.localeCompare(b.leagueName));
  }, [allowedClubNames, teams]);

  function addRoleRow() {
    setRoleRows((rows) => [
      ...rows,
      { id: `role-${Date.now()}-${rows.length}`, role: "Player", teamId: sortedTeams[0]?.teamId ?? "" }
    ]);
  }

  function updateRoleRow(id: string, patch: Partial<EditRoleRow>) {
    setRoleRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function removeRoleRow(id: string) {
    setRoleRows((rows) => rows.filter((row) => row.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/55 p-4" role="dialog" aria-modal="true" aria-label="Edit person">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[18px] bg-white p-4 shadow-elevated ring-1 ring-[#eeeaf2]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Edit person</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#10233f]">{person.name}</h2>
            <p className="mt-1 text-sm font-bold text-[#6c5a73]">Update contact details, handicap and active team roles.</p>
          </div>
          {person.accountId ? (
            <Badge variant={person.loginActive ? "green" : "muted"}>{person.loginActive ? "Login on" : "Login off"}</Badge>
          ) : (
            <Badge variant="muted">No login</Badge>
          )}
        </div>
        {canManageLogin && person.accountId ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
            <div>
              <p className="text-xs font-black uppercase text-[#6c5a73]">Login access</p>
              <p className="text-sm font-bold text-[#10233f]">
                {person.loginActive ? "This person can currently log in." : "This person's login is currently disabled."}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSetLoginAccess(!person.loginActive)}
              disabled={busy}
              className={person.loginActive ? "text-[#b42318]" : ""}
            >
              {person.loginActive ? "Disable login" : "Enable login"}
            </Button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AdminInput label="First name" value={firstName} onChange={setFirstName} />
          <AdminInput label="Last name" value={lastName} onChange={setLastName} />
          <AdminInput label="Email" value={email} onChange={setEmail} type="email" placeholder="No email yet" />
          <AdminInput label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="Blank" />
          <AdminInput label="Club handicap" value={handicap} onChange={setHandicap} type="number" placeholder="Blank" />
        </div>
        <div className="mt-4 rounded-2xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[#6c5a73]">Team roles</p>
              <p className="text-xs font-semibold text-[#6c5a73]">Add or remove Player and Manager roles within {Array.from(allowedClubNames).map(shortClubName).join(" / ") || "this person's club"}.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={addRoleRow} disabled={!sortedTeams.length}>
              <PlusCircle className="h-4 w-4" />
              Add role
            </Button>
          </div>
          <div className="mt-3 grid gap-2">
            {roleRows.map((row, index) => (
              <div key={row.id} className="grid gap-2 rounded-xl bg-white p-2 ring-1 ring-[#eeeaf2] sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                <AdminSelect
                  label={`Role ${index + 1}`}
                  value={row.role}
                  onChange={(value) => updateRoleRow(row.id, { role: value as TeamRole })}
                  options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))}
                />
                <AdminSelect
                  label="Team"
                  value={row.teamId}
                  onChange={(value) => updateRoleRow(row.id, { teamId: value })}
                  options={sortedTeams.map((team) => ({ value: team.teamId, label: allowedClubNames.size > 1 ? `${team.teamName} - ${team.leagueName} - ${shortClubName(team.clubName)}` : `${team.teamName} - ${team.leagueName}` }))}
                />
                <Button variant="secondary" size="sm" onClick={() => removeRoleRow(row.id)} className="text-[#b42318]">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))}
            {!roleRows.length ? (
              <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#6c5a73] ring-1 ring-[#eeeaf2]">
                No active team roles. Add a role if this person should appear as a player or manager.
              </p>
            ) : null}
          </div>
        </div>
        {canManageLeagueChair ? (
          <div className="mt-4 rounded-2xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
            <p className="text-xs font-black uppercase text-[#6c5a73]">League access</p>
            <p className="mt-1 text-xs font-semibold text-[#6c5a73]">
              Interclub League Chair gives this person Contacts access without adding a selectable role in the app.
            </p>
            <AdminCheckbox
              label="Interclub League Chair"
              checked={leagueChair}
              onChange={setLeagueChair}
              description="Global interclub access. It is not tied to one club and will not appear in the role switcher."
            />
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({
              personId: person.personId,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              handicap: handicap.trim(),
              leagueChair,
              roles: roleRows
                .filter((row) => row.teamId && (row.role === "Player" || row.role === "Manager"))
                .map((row) => ({ role: row.role, teamId: row.teamId }))
            })}
            disabled={busy || !canSave}
          >
            <Pencil className="h-4 w-4" />
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
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
  const [bccGarry, setBccGarry] = useState(false);

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
          expiresAt,
          bccGarry
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create invite.");
      const emailStatus = data.email_status ? String(data.email_status).toLowerCase() : "queued";
      setEmailPreview({
        to: data.email_to ?? email,
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
                      {clubRoleHeading(row.role)}
                      <span className="block text-xs font-semibold text-[#6c5a73]">
                        {clubRoleDescription(row.role)}
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
            <AdminCheckbox label="BCC Garry" checked={bccGarry} onChange={setBccGarry} description="Quietly copy garlyons@gmail.com on this invite email." />
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
                The next invite will queue a branded activation email to the invited person's email address.
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
  const example = "name\temail\tphone\tclub\trole\tteam\tadministrator\nStephen Finlan\tstephen@example.com\t\tCastle Golf Club\tManager\tCastle A\tno\nCastle A Player\tplayer@example.com\t\tCastle Golf Club\tPlayer\tCastle A\tno";
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
    setSendStatus({
      tone: "info",
      text: `Importing ${readyRows.length} people/role row${readyRows.length === 1 ? "" : "s"}. No invite emails will be sent.`
    });
    let imported = 0;
    const failures: string[] = [];
    const completedEmails = new Set<string>();
    for (const row of readyRows) {
      try {
        const [firstName, ...lastNameParts] = row.name.trim().split(/\s+/);
        const response = await fetch("/api/admin/people", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
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
        if (!response.ok) throw new Error(data.error || "Could not import person.");
        imported += 1;
        completedEmails.add(row.email);
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
    const resultMessage = failures.length
      ? `Imported ${imported} row${imported === 1 ? "" : "s"}; ${failures.length} failed. ${failures[0]}`
      : `Imported ${imported} row${imported === 1 ? "" : "s"} and removed them from the import list. Select people on the People screen to send invites.`;
    setSendStatus({ tone: failures.length ? "error" : "success", text: resultMessage });
    onMessage(resultMessage);
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Import from spreadsheet</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Paste rows copied from Excel or Google Sheets. This imports people and roles only; invite emails are sent from the People list.</p>
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
          <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-2 bg-[#f7f5fa] px-3 py-2 text-xs font-black uppercase text-[#6c5a73]">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
          </div>
          <div className="max-h-56 overflow-auto">
            {parsedRows.length ? parsedRows.map((row, index) => (
              <div key={`${row.email}-${index}`} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-2 border-t border-[#eeeaf2] px-3 py-2 text-sm font-bold text-[#10233f]">
                <span className="min-w-0 truncate">{row.name || "-"}</span>
                <span className="min-w-0 truncate">{row.email || "-"}</span>
                <span className="min-w-0 truncate">{row.role}{row.team ? ` - ${row.team}` : ""}</span>
                <span className={row.error ? "text-[#ba1a1a]" : "text-[#1b8a72]"}>{row.error || "Ready"}</span>
              </div>
            )) : (
              <div className="px-3 py-4 text-sm font-semibold text-[#6c5a73]">No rows parsed yet.</div>
            )}
          </div>
        </div>
        <Button onClick={sendBulkInvites} disabled={sending || !readyRows.length}>
          <FileSpreadsheet className="h-4 w-4" />
          {sending ? "Importing people..." : "Import people without emailing"}
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
  };
  const clubs = uniqueClubs(teams);

  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const role = normalizeInviteRole(readCell(cells, indexes.role) || "Player");
    const clubName = readCell(cells, indexes.club);
    const teamName = readCell(cells, indexes.team);
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
  if (normalized === "league chair" || normalized === "chair" || normalized === "chairman") return "League Chair";
  return "Player";
}

function clubRoleHeading(role: InviteRole) {
  if (role === "Club Admin") return "Club administration access";
  if (role === "League Chair") return "Interclub league chair access";
  return "Club-wide member access";
}

function clubRoleDescription(role: InviteRole) {
  if (role === "Club Admin") return "Can manage club members, invites, competitions and bookings.";
  if (role === "League Chair") return "Can view league contacts across the interclub competition.";
  return "Can book club tables and receive messages.";
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
            ...invite.roles.map(formatInviteRoleLabel),
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

function AdvertsPanel({
  ads,
  demo,
  onMessage,
  onRefresh
}: {
  ads: AdminAdRow[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    audience: "Everyone" as SponsorAd["audience"],
    imagePath: "",
    linkUrl: "",
    affiliateCode: "",
    altText: "",
    sortOrder: "100",
    active: true
  });
  const [editing, setEditing] = useState<Record<string, AdminAdRow>>({});
  const [busyId, setBusyId] = useState("");

  async function createAdvert() {
    if (demo) {
      onMessage("Advert created.");
      return;
    }
    try {
      const response = await fetch("/api/admin/adverts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create advert.");
      setDraft({ name: "", audience: "Everyone", imagePath: "", linkUrl: "", affiliateCode: "", altText: "", sortOrder: "100", active: true });
      onMessage("Advert created.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not create advert.");
    }
  }

  async function saveAdvert(ad: AdminAdRow) {
    if (demo) {
      onMessage("Advert saved.");
      return;
    }
    setBusyId(ad.id);
    try {
      const response = await fetch("/api/admin/adverts", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: ad.id,
          name: ad.name,
          audience: ad.audience,
          imagePath: ad.imagePath,
          linkUrl: ad.linkUrl,
          affiliateCode: ad.affiliateCode ?? "",
          altText: ad.altText,
          sortOrder: ad.sortOrder,
          active: ad.active
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save advert.");
      setEditing((current) => {
        const next = { ...current };
        delete next[ad.id];
        return next;
      });
      onMessage("Advert saved.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save advert.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteAdvert(ad: AdminAdRow) {
    if (demo) {
      onMessage("Advert deleted.");
      return;
    }
    setBusyId(ad.id);
    try {
      const response = await fetch("/api/admin/adverts", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ad.id, action: "delete" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete advert.");
      onMessage("Advert deleted.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not delete advert.");
    } finally {
      setBusyId("");
    }
  }

  function updateEditing(id: string, patch: Partial<AdminAdRow>) {
    setEditing((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? ads.find((ad) => ad.id === id)!),
        ...patch
      }
    }));
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Adverts</CardTitle>
          <Badge variant="cyan">Sponsor banners</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <AdminInput label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
            <AdminSelect label="Audience" value={draft.audience} onChange={(value) => setDraft((current) => ({ ...current, audience: value as SponsorAd["audience"] }))} options={[{ value: "Everyone", label: "Everyone" }, { value: "League Chair", label: "League Chair(s)" }]} />
            <AdvertImageInput label="Advert image" value={draft.imagePath} onChange={(value) => setDraft((current) => ({ ...current, imagePath: value }))} onError={onMessage} />
            <AdminInput label="Link URL" value={draft.linkUrl} onChange={(value) => setDraft((current) => ({ ...current, linkUrl: value }))} placeholder="https://example.com/" />
            <AdminInput label="Amazon affiliate code" value={draft.affiliateCode} onChange={(value) => setDraft((current) => ({ ...current, affiliateCode: value }))} placeholder="yourtag-21" />
            <AdminInput label="Alt text" value={draft.altText} onChange={(value) => setDraft((current) => ({ ...current, altText: value }))} />
            <AdminInput label="Sort order" value={draft.sortOrder} onChange={(value) => setDraft((current) => ({ ...current, sortOrder: value }))} type="number" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AdminCheckbox label="Active" checked={draft.active} onChange={(checked) => setDraft((current) => ({ ...current, active: checked }))} />
            <Button onClick={createAdvert} disabled={!draft.name || !draft.imagePath || !draft.linkUrl}>
              <PlusCircle className="h-4 w-4" />
              Create advert
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current adverts</CardTitle>
          <Badge variant="muted">{ads.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {ads.map((sourceAd) => {
            const ad = editing[sourceAd.id] ?? sourceAd;
            return (
              <div key={ad.id} className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] xl:grid-cols-[220px_minmax(0,1fr)_220px] xl:items-start">
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="overflow-hidden rounded-lg bg-[#071426] ring-1 ring-[#eeeaf2]">
                  <img src={ad.imagePath} alt={ad.altText || ad.name} className="h-auto w-full" />
                </a>
                <div className="grid gap-2 md:grid-cols-2">
                  <AdminInput label="Name" value={ad.name} onChange={(value) => updateEditing(ad.id, { name: value })} />
                  <AdminSelect label="Audience" value={ad.audience} onChange={(value) => updateEditing(ad.id, { audience: value as SponsorAd["audience"] })} options={[{ value: "Everyone", label: "Everyone" }, { value: "League Chair", label: "League Chair(s)" }]} />
                  <AdminInput label="Link URL" value={ad.linkUrl} onChange={(value) => updateEditing(ad.id, { linkUrl: value })} />
                  <AdminInput label="Amazon affiliate code" value={ad.affiliateCode ?? ""} onChange={(value) => updateEditing(ad.id, { affiliateCode: value })} />
                  <AdvertImageInput label="Advert image" value={ad.imagePath} onChange={(value) => updateEditing(ad.id, { imagePath: value })} onError={onMessage} />
                  <AdminInput label="Alt text" value={ad.altText} onChange={(value) => updateEditing(ad.id, { altText: value })} />
                  <AdminInput label="Sort order" value={String(ad.sortOrder)} onChange={(value) => updateEditing(ad.id, { sortOrder: Number(value) || 100 })} type="number" />
                </div>
                <div className="grid gap-2">
                  <AdminCheckbox label="Active" checked={ad.active} onChange={(checked) => updateEditing(ad.id, { active: checked })} />
                  <Button onClick={() => saveAdvert(ad)} disabled={busyId === ad.id || !ad.name || !ad.imagePath || !ad.linkUrl}>
                    <Pencil className="h-4 w-4" />
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => deleteAdvert(ad)} disabled={busyId === ad.id} className="text-[#b42318]">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
          {!ads.length ? (
            <p className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold text-[#6c5a73] ring-1 ring-[#eeeaf2]">
              No adverts yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AdvertImageInput({
  label,
  value,
  onChange,
  onError
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Advert image must be an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      onError("Advert image must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.onerror = () => onError("Could not read advert image.");
    reader.readAsDataURL(file);
  }

  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <input
        className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 py-2 text-sm font-bold text-[#10233f] outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[#00e5f0] file:px-3 file:py-1.5 file:text-sm file:font-extrabold file:text-[#10233f] focus-visible:outline-[#7bc7d6]"
        type="file"
        accept="image/*"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {value ? (
        <div className="overflow-hidden rounded-lg bg-[#071426] ring-1 ring-[#eeeaf2]">
          <img src={value} alt="" className="h-auto w-full" />
        </div>
      ) : (
        <span className="text-xs font-semibold normal-case text-[#6c5a73]">Choose an image to store with this advert.</span>
      )}
    </label>
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

function formatInviteRoleLabel(role: InviteRow["roles"][number]) {
  if (role.role === "League Chair") return "Interclub League Chair";
  return `${role.role}${role.team_name ? ` - ${role.team_name}` : ""}`;
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

function LogsPanel({ refreshKey }: { refreshKey: number }) {
  const [activityLogs, setActivityLogs] = useState<ActivityRow[]>([]);
  const [personOptions, setPersonOptions] = useState<LogPersonOption[]>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [useLast24Hours, setUseLast24Hours] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
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
    if (useLast24Hours) {
      params.set("sinceHours", "24");
    } else {
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
    }
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
  }, [areaFilter, fromDate, page, pageSize, personFilter, refreshKey, toDate, useLast24Hours]);

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
              onChange={(event) => {
                setUseLast24Hours(false);
                setFromDate(event.target.value);
              }}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-[#6c5a73]">
            To
            <input
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f]"
              type="date"
              value={toDate}
              onChange={(event) => {
                setUseLast24Hours(false);
                setToDate(event.target.value);
              }}
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
            {useLast24Hours ? "Showing last 24 hours" : `Showing ${fromDate || "start"} to ${toDate || "today"}`}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setUseLast24Hours(true);
              setFromDate("");
              setToDate("");
              setPersonFilter("all");
              setAreaFilter("all");
            }}
          >
            Last 24 hours
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
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/admin-icon.png"
              alt="Interclub Snooker admin"
              className="h-14 w-14 shrink-0 rounded-2xl bg-black object-cover ring-1 ring-[#eeeaf2]"
            />
            <CardTitle>{title}</CardTitle>
          </div>
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

function CompactAdminInput({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[10px] font-bold uppercase leading-tight text-[#6c5a73]">{label}</span>
      <input className="min-h-8 w-full min-w-0 rounded-lg border border-[#eeeaf2] bg-white px-2.5 text-[13px] font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} />
    </label>
  );
}

function CompactScoreInput({ ariaLabel, value, onChange }: { ariaLabel: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0">
      <span className="sr-only">{ariaLabel}</span>
      <input
        aria-label={ariaLabel}
        className="min-h-8 w-full min-w-0 rounded-lg border border-[#eeeaf2] bg-white px-2 text-center text-[13px] font-extrabold outline-none focus-visible:outline-[#7bc7d6]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        type="number"
      />
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

function CompactAdminSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[10px] font-bold uppercase leading-tight text-[#6c5a73]">{label}</span>
      <select className="min-h-8 w-full min-w-0 rounded-lg border border-[#eeeaf2] bg-white px-2.5 text-[13px] font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
