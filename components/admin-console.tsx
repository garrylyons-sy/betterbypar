"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Eye, KeyRound, LayoutPanelTop, PlusCircle, ShieldCheck, Smartphone, Users } from "lucide-react";
import { AuthSignInForm } from "@/components/auth-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appearanceMenuOptions, appearancePanelOptions, defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import { clubTeamStructure } from "@/lib/demo-data";
import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, Role as AppRole } from "@/lib/types";

type AdminTab = "invites" | "permissions" | "appearance" | "logs";
type TeamRole = "Player" | "Manager" | "Assistant Manager";
type TeamOption = {
  teamId: string;
  teamName: string;
  clubName: string;
  leagueName: string;
};
type PersonOption = {
  personId: string;
  name: string;
  email: string;
  admin?: boolean;
};
type ActivityRow = {
  id: string;
  activity_type: string;
  page_label: string | null;
  page_path: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  person?: { first_name: string; last_name: string; email: string | null } | null;
};
type InviteRequestRow = {
  id: string;
  requested_person_name: string;
  email: string;
  status: string;
  message: string | null;
  created_at: string;
};
type AdminUser = {
  email: string;
  name: string;
};

const roles: TeamRole[] = ["Player", "Manager", "Assistant Manager"];
const rolesWithClubMember: AppRole[] = ["Player", "Manager", "Assistant Manager", "Club Member"];
const demoTeams: TeamOption[] = clubTeamStructure.flatMap((club) =>
  club.teams.map((team) => ({
    teamId: team,
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

export function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("invites");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [administrator, setAdministrator] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>(demoTeams);
  const [people, setPeople] = useState<PersonOption[]>(demoPeople);
  const [logs, setLogs] = useState<ActivityRow[]>(demoLogs);
  const [requests, setRequests] = useState<InviteRequestRow[]>([]);
  const [appearance, setAppearance] = useState<AppearanceConfig>(defaultAppearanceConfig);

  useEffect(() => {
    refreshAdminData();
  }, []);

  async function refreshAdminData() {
    setLoading(true);
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
        setTeams((data.teams ?? []).map((team: { team_id: string; team_name: string; club_name: string; league_name: string }) => ({
          teamId: team.team_id,
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
            admin: Boolean(person.admin)
          });
        }
        setPeople(Array.from(seen.values()));
        setLogs(data.logs ?? []);
        setRequests(data.requests ?? []);
        setAppearance(normalizeAppearanceConfig(data.appearance ?? defaultAppearanceConfig));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin data unavailable.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <AdminShell title="Loading admin" subtitle="Checking your session." />;
  }

  if (!authenticated) {
    return <AdminLogin onSignedIn={refreshAdminData} />;
  }

  if (!administrator) {
    return <AdminShell title="No administrator access" subtitle="Your account is signed in, but it has not been granted administrator access." />;
  }

  return (
    <AdminLayout tab={tab} setTab={setTab} message={message} adminUser={adminUser}>
      <AdminTabPanel tab={tab} teams={teams} people={people} logs={logs} requests={requests} appearance={appearance} onAppearanceChange={setAppearance} onMessage={setMessage} onRefresh={refreshAdminData} />
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
  children
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  message: string;
  adminUser: AdminUser | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <header className="bg-[#10233f] px-4 py-5 text-white shadow-elevated sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-white/65">League operations</p>
            <h1 className="text-2xl font-extrabold leading-tight">Admin console</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="cyan">Administrator</Badge>
            {adminUser ? <p className="max-w-[220px] truncate text-sm font-bold text-white/80">{adminUser.name}</p> : null}
          </div>
        </div>
      </header>
      <section className="mx-auto grid w-full max-w-[1180px] min-w-0 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
        <aside className="min-w-0 rounded-[18px] bg-white p-2 shadow-card">
          {[
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
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-4 text-sm font-bold ${tab === item.id ? "bg-[#10233f] text-white" : "text-[#25002b]"}`}
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
  appearance: AppearanceConfig;
  demo?: boolean;
  onAppearanceChange: (appearance: AppearanceConfig) => void;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  if (props.tab === "permissions") return <PermissionsPanel {...props} />;
  if (props.tab === "appearance") return <AppearancePanel {...props} />;
  if (props.tab === "logs") return <LogsPanel logs={props.logs} />;
  return <InvitesPanel {...props} />;
}

function InvitesPanel({
  teams,
  requests,
  demo,
  onMessage,
  onRefresh
}: {
  teams: TeamOption[];
  requests: InviteRequestRow[];
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [role, setRole] = useState<TeamRole>("Player");

  const [expiresAt, setExpiresAt] = useState("");

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
        body: JSON.stringify({ email, name, teamId, role, expiresAt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create invite.");
      onMessage(data.activation_url ? `Invite created: ${data.activation_url}` : data.invitation_code ? `Invite created: ${data.invitation_code}` : "Invite created.");
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not create invite.");
    }
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Create invite</CardTitle>
          <Badge variant="green">Player or manager</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <AdminInput label="Full name" value={name} onChange={setName} />
          <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
          <AdminSelect label="Team" value={teamId} onChange={setTeamId} options={teams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.clubName}` }))} />
          <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as TeamRole)} options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))} />
          <AdminInput label="Expires" value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
          <Button onClick={createInvite} disabled={!name || !email || !teamId}>
            <PlusCircle className="h-4 w-4" />
            Create invite
          </Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <Badge variant="muted">{requests.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(requests.length ? requests : [{ id: "demo-request", requested_person_name: "No pending requests", email: "Player requests will appear here", status: "Pending", message: null, created_at: new Date().toISOString() }]).map((request) => (
            <div key={request.id} className="rounded-xl bg-[#f7f5fa] p-3">
              <p className="font-extrabold">{request.requested_person_name}</p>
              <p className="text-xs font-bold text-[#6c5a73]">{request.email}</p>
              <Badge variant={request.status === "Pending" ? "cyan" : "muted"}>{request.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
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
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [role, setRole] = useState<TeamRole>("Player");

  useEffect(() => {
    if (people.some((person) => person.personId === adminPersonId)) return;
    setAdminPersonId(people.find((person) => person.email.toLowerCase() === "garlyons@gmail.com")?.personId ?? people[0]?.personId ?? "");
  }, [adminPersonId, people]);

  useEffect(() => {
    if (people.some((person) => person.personId === personId)) return;
    setPersonId(people[0]?.personId ?? "");
  }, [people, personId]);

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
  const availableMenus = appearanceMenuOptions.filter((option) => option.roles.includes(role));

  function updateRole(next: { panels?: AppearancePanelId[]; menuItems?: AppearanceMenuId[] }) {
    onAppearanceChange(normalizeAppearanceConfig({
      ...appearance,
      [role]: {
        role,
        panels: next.panels ?? roleConfig.panels,
        menuItems: next.menuItems ?? roleConfig.menuItems
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

  function toggleMenu(menu: AppearanceMenuId) {
    updateRole({
      menuItems: roleConfig.menuItems.includes(menu)
        ? roleConfig.menuItems.filter((item) => item !== menu)
        : [...roleConfig.menuItems, menu]
    });
  }

  function movePanel(panel: AppearancePanelId, direction: -1 | 1) {
    updateRole({ panels: moveItem(roleConfig.panels, panel, direction) });
  }

  function moveMenu(menu: AppearanceMenuId, direction: -1 | 1) {
    updateRole({ menuItems: moveItem(roleConfig.menuItems, menu, direction) });
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
            <Badge variant="cyan">Home and menu</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as AppRole)} options={rolesWithClubMember.map((item) => ({ value: item, label: item }))} />
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              Choose which panels appear on the role home screen, and which menu options appear in the main app. Order is top-to-bottom here and left-to-right in mobile navigation.
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
        <AppearanceChecklist
          title="Menu options"
          items={availableMenus}
          selected={roleConfig.menuItems}
          onToggle={(id) => toggleMenu(id as AppearanceMenuId)}
          onMove={(id, direction) => moveMenu(id as AppearanceMenuId, direction)}
        />

        <Button onClick={saveAppearance}>
          <ShieldCheck className="h-4 w-4" />
          Save appearance
        </Button>
      </div>

      <div className="hidden xl:block">
        <AppearancePhonePreview role={role} panels={roleConfig.panels} menuItems={roleConfig.menuItems} />
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

function AppearancePhonePreview({ role, panels, menuItems }: { role: AppRole; panels: AppearancePanelId[]; menuItems: AppearanceMenuId[] }) {
  const visibleMenu = menuItems.length > 5 ? [...menuItems.slice(0, 4), "More"] : menuItems.slice(0, 5);

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
            <div className="absolute bottom-5 left-1/2 grid w-[280px] -translate-x-1/2 grid-cols-5 gap-1 rounded-2xl bg-white p-2 shadow-elevated">
              {visibleMenu.map((item) => (
                <div key={item} className="truncate rounded-lg bg-[#f7f5fa] px-1 py-2 text-center text-[10px] font-bold text-[#10233f]">
                  {item === "Interclub Leagues" ? "Leagues" : item}
                </div>
              ))}
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

function LogsPanel({ logs }: { logs: ActivityRow[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>User logs</CardTitle>
        <Badge variant="muted">{logs.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl bg-[#f7f5fa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold">{log.activity_type}</p>
                <p className="text-xs font-bold text-[#6c5a73]">
                  {log.person ? `${log.person.first_name} ${log.person.last_name}` : "Unknown user"}
                </p>
              </div>
              <span className="text-right text-xs font-bold text-[#6c5a73]">{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-[#10233f]">{log.page_label ?? log.page_path ?? "Session"}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#6c5a73]">{JSON.stringify(log.metadata)}</p>
          </div>
        ))}
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

function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
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
        </CardContent>
      </Card>
    </main>
  );
}

function AdminInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-bold uppercase text-[#6c5a73]">{label}</span>
      <input className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </label>
  );
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
