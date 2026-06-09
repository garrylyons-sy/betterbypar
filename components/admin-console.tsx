"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, KeyRound, ListChecks, LogIn, PlusCircle, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubTeamStructure } from "@/lib/demo-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [operator, setOperator] = useState(!isSupabaseConfigured);
  const [message, setMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>(demoTeams);
  const [people, setPeople] = useState<PersonOption[]>(demoPeople);
  const [logs, setLogs] = useState<ActivityRow[]>(demoLogs);
  const [requests, setRequests] = useState<InviteRequestRow[]>([]);

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
    if (!supabase || !session) return;

    supabase.rpc("is_app_operator").then(({ data }) => {
      setOperator(Boolean(data));
    });
  }, [session]);

  useEffect(() => {
    if (!supabase || !session || !operator) return;

    refreshAdminData();
  }, [session, operator]);

  async function refreshAdminData() {
    if (!supabase) return;

    const [teamResult, personResult, logResult, requestResult] = await Promise.all([
      supabase.rpc("player_invite_team_options"),
      supabase.from("membership_management_view").select("person_id, first_name, last_name, email").order("last_name"),
      supabase.from("user_activity_log").select("id, activity_type, page_label, page_path, created_at, metadata, person:person_id(first_name,last_name,email)").order("created_at", { ascending: false }).limit(50),
      supabase.from("invitation_request").select("id, requested_person_name, email, status, message, created_at").order("created_at", { ascending: false }).limit(25)
    ]);

    if (teamResult.data) {
      setTeams((teamResult.data as Array<{ team_id: string; team_name: string; club_name: string; league_name: string }>).map((team) => ({
        teamId: team.team_id,
        teamName: team.team_name,
        clubName: team.club_name,
        leagueName: team.league_name
      })));
    }

    if (personResult.data) {
      const seen = new Map<string, PersonOption>();
      for (const person of personResult.data as Array<{ person_id: string; first_name: string; last_name: string; email: string | null }>) {
        seen.set(person.person_id, {
          personId: person.person_id,
          name: `${person.first_name} ${person.last_name}`.trim(),
          email: person.email ?? ""
        });
      }
      setPeople(Array.from(seen.values()));
    }

    if (logResult.data) setLogs(logResult.data as unknown as ActivityRow[]);
    if (requestResult.data) setRequests(requestResult.data as InviteRequestRow[]);
  }

  if (!isSupabaseConfigured) {
    return <AdminLayout tab={tab} setTab={setTab} message="Demo mode: connect Supabase to manage real invites, permissions and logs.">
      <AdminTabPanel tab={tab} teams={teams} people={people} logs={logs} requests={requests} onMessage={setMessage} onRefresh={refreshAdminData} demo />
    </AdminLayout>;
  }

  if (loading) {
    return <AdminShell title="Loading admin" subtitle="Checking your session." />;
  }

  if (!session) {
    return <AdminLogin />;
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
      <header className="bg-[#37003c] px-4 py-5 text-white shadow-elevated sm:px-6 lg:px-10">
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
                className={`flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-sm font-black ${tab === item.id ? "bg-[#37003c] text-white" : "text-[#25002b]"}`}
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
    if (demo || !supabase) {
      onMessage("Demo invite created: CASTLE-DEMO-2026");
      return;
    }

    const { data, error } = await supabase.rpc("operator_create_invitation", {
      email_input: email,
      invited_person_name_input: name,
      expires_at_input: expiresAt ? new Date(expiresAt).toISOString() : null,
      memberships_input: [{ team_id: teamId, role }]
    });

    if (error) {
      onMessage(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;
    onMessage(row?.invitation_code ? `Invite created: ${row.invitation_code}` : "Invite created.");
    onRefresh();
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
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [role, setRole] = useState<Role>("Player");

  async function setPermission(active: boolean) {
    if (demo || !supabase) {
      onMessage(active ? "Demo permission added." : "Demo permission disabled.");
      return;
    }

    const { error } = await supabase.rpc("operator_set_team_membership", {
      person_id_input: personId,
      team_id_input: teamId,
      role_input: role,
      active_input: active
    });

    onMessage(error ? error.message : active ? "Permission saved." : "Permission disabled.");
    onRefresh();
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Set permissions</CardTitle>
        <Badge variant="cyan">Membership based</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <AdminSelect label="Person" value={personId} onChange={setPersonId} options={people.map((person) => ({ value: person.personId, label: `${person.name} ${person.email ? `- ${person.email}` : ""}` }))} />
        <AdminSelect label="Team" value={teamId} onChange={setTeamId} options={teams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.clubName}` }))} />
        <AdminSelect label="Role" value={role} onChange={(value) => setRole(value as Role)} options={roles.map((roleOption) => ({ value: roleOption, label: roleOption }))} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setPermission(true)}>
            <ShieldCheck className="h-4 w-4" />
            Save permission
          </Button>
          <Button variant="secondary" onClick={() => setPermission(false)}>
            Disable permission
          </Button>
        </div>
      </CardContent>
    </Card>
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
            <p className="mt-2 text-sm font-bold text-[#37003c]">{log.page_label ?? log.page_path ?? "Session"}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#6c5a73]">{JSON.stringify(log.metadata)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  return (
    <AdminShell title="Admin sign in" subtitle="Use an operator-marked account.">
      <div className="grid gap-3">
        <AdminInput label="Email" value={email} onChange={setEmail} type="email" />
        <AdminInput label="Password" value={password} onChange={setPassword} type="password" />
        {message ? <p className="text-sm font-bold text-[#e90052]">{message}</p> : null}
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
      <input className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#04f5ff]" value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </label>
  );
}

function AdminSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-extrabold uppercase text-[#6c5a73]">{label}</span>
      <select className="min-h-11 w-full min-w-0 rounded-2xl border border-[#eeeaf2] bg-white px-4 text-base font-bold outline-none focus-visible:outline-[#04f5ff]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
