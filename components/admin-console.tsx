"use client";

import { useEffect, useState } from "react";
import { Activity, KeyRound, ListChecks, LogIn, PlusCircle, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubTeamStructure } from "@/lib/demo-data";

type AdminTab = "invites" | "permissions" | "logs";
type Role = "Player" | "Manager" | "Assistant Manager";
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

const roles: Role[] = ["Player", "Manager", "Assistant Manager"];
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
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(false);
  const [message, setMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>(demoTeams);
  const [people, setPeople] = useState<PersonOption[]>(demoPeople);
  const [logs, setLogs] = useState<ActivityRow[]>(demoLogs);
  const [requests, setRequests] = useState<InviteRequestRow[]>([]);

  useEffect(() => {
    refreshAdminData();
  }, []);

  async function refreshAdminData() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      setAuthenticated(Boolean(data.authenticated));
      setOperator(Boolean(data.operator));

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

  if (!operator) {
    return <AdminShell title="No operator access" subtitle="Your account is signed in, but it has not been marked for league operations in app_operator." />;
  }

  return (
    <AdminLayout tab={tab} setTab={setTab} message={message}>
      <AdminTabPanel tab={tab} teams={teams} people={people} logs={logs} requests={requests} onMessage={setMessage} onRefresh={refreshAdminData} />
    </AdminLayout>
  );
}

function AdminLayout({
  tab,
  setTab,
  message,
  children
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <header className="bg-[#10233f] px-4 py-5 text-white shadow-elevated sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase text-white/65">League operations</p>
            <h1 className="text-2xl font-black leading-tight">Admin console</h1>
          </div>
          <Badge variant="cyan">Private</Badge>
        </div>
      </header>
      <section className="mx-auto grid w-full max-w-[1180px] min-w-0 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
        <aside className="min-w-0 rounded-[18px] bg-white p-2 shadow-card">
          {[
            { id: "invites" as const, label: "Invites", icon: KeyRound },
            { id: "permissions" as const, label: "Permissions", icon: Users },
            { id: "logs" as const, label: "Logs", icon: Activity }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-sm font-black ${tab === item.id ? "bg-[#10233f] text-white" : "text-[#25002b]"}`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </aside>
        <div className="grid min-w-0 gap-4">
          {message ? <div className="rounded-2xl bg-[#00ff85] px-4 py-3 text-sm font-black text-[#25002b]">{message}</div> : null}
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
  demo?: boolean;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  if (props.tab === "permissions") return <PermissionsPanel {...props} />;
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
  const [role, setRole] = useState<Role>("Player");

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
          <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as Role)} options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))} />
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
              <p className="font-black">{request.requested_person_name}</p>
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
  const [role, setRole] = useState<Role>("Player");

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
          <Badge variant="cyan">Operators</Badge>
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
            Admin access lets a logged-in player open the admin console, create invites, set permissions and view logs.
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
          <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as Role)} options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))} />
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
                <p className="font-black">{log.activity_type}</p>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    setMessage("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      onSignedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  return (
    <AdminShell title="Admin sign in" subtitle="Use an operator-marked account.">
      <div className="grid gap-3">
        <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
        <AdminInput label="Password" value={password} onChange={setPassword} type="password" />
        {message ? <p className="text-sm font-bold text-[#1b8a72]">{message}</p> : null}
        <Button onClick={signIn}>
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </div>
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
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <input className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </label>
  );
}

function AdminSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <select className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#7bc7d6]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
