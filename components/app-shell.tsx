"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Home,
  Mail,
  MessageCircle,
  PlusCircle,
  ShieldCheck,
  Trophy,
  UserCircle,
  Users,
  Zap
} from "lucide-react";
import { adminModules, clubTeamStructure, recentResults, standings, teamContexts, upcomingFixture } from "@/lib/demo-data";
import type { TeamContext } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Fixtures", icon: CalendarDays },
  { label: "Table", icon: Trophy },
  { label: "Players", icon: Users },
  { label: "Messages", icon: Mail }
];

const quickTabs = ["Fixtures", "Results", "Table", "Players", "Stats"];

export function AppShell() {
  const [selectedId, setSelectedId] = useState(teamContexts[0].id);
  const activeTeam = useMemo(
    () => teamContexts.find((team) => team.id === selectedId) ?? teamContexts[0],
    [selectedId]
  );

  return (
    <main className="min-h-screen app-bg pb-24 text-[#25002b]">
      <Header activeTeam={activeTeam} onTeamChange={setSelectedId} />
      <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_340px] lg:gap-5 lg:px-10">
        <DesktopRail activeTeam={activeTeam} />
        <div className="grid gap-4">
          <MatchdayHero activeTeam={activeTeam} />
          <QuickTabs />
          {activeTeam.role === "Manager" ? <ManagerHome /> : <PlayerHome activeTeam={activeTeam} />}
        </div>
        <aside className="grid gap-4 lg:content-start">
          <LeagueTable activeTeam={activeTeam} />
          <ClubTeamStructureCard />
          <AdminFoundation />
        </aside>
      </section>
      <BottomNav />
    </main>
  );
}

function Header({
  activeTeam,
  onTeamChange
}: {
  activeTeam: TeamContext;
  onTeamChange: (id: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#37003c] px-4 py-3 text-white shadow-elevated sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-base font-black text-[#37003c]">
            IS
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold uppercase tracking-wide text-white/75">
              Interclub Snooker
            </p>
            <h1 className="truncate text-lg font-black leading-tight">{activeTeam.season}</h1>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <ContextSwitcher activeTeam={activeTeam} onTeamChange={onTeamChange} />
          <button className="hidden h-11 w-11 place-items-center rounded-full bg-white/10 text-white sm:grid" aria-label="Open profile">
            <UserCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

function ContextSwitcher({
  activeTeam,
  onTeamChange
}: {
  activeTeam: TeamContext;
  onTeamChange: (id: string) => void;
}) {
  return (
    <label className="relative block w-full sm:w-auto">
      <span className="sr-only">Switch team context</span>
      <select
        value={activeTeam.id}
        onChange={(event) => onTeamChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-full border border-white/15 bg-white px-4 pr-9 text-sm font-extrabold text-[#25002b] shadow-card outline-none sm:min-w-[220px]"
      >
        {teamContexts.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} - {team.role}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-[#37003c]" />
    </label>
  );
}

function DesktopRail({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <aside className="hidden rounded-[18px] bg-[#37003c] p-4 text-white shadow-elevated lg:block">
      <p className="text-xs font-extrabold uppercase text-white/60">Competition</p>
      <h2 className="mt-1 text-2xl font-black">{activeTeam.league}</h2>
      <div className="mt-4 space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-sm font-extrabold text-white/80",
                index === 0 && "bg-white text-[#37003c]"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function MatchdayHero({ activeTeam }: { activeTeam: TeamContext }) {
  const manager = activeTeam.role === "Manager";
  const panelStyle = {
    background: `linear-gradient(135deg, ${activeTeam.primaryColor} 0%, #37003c 52%, #e90052 100%)`
  };

  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-live">
      <div className="relative p-4 sm:p-6" style={panelStyle}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="flex items-start gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-card ring-1 ring-white/40 sm:h-20 sm:w-20">
              <img src={activeTeam.logoPath} alt={`${activeTeam.club} logo`} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">{activeTeam.role}</Badge>
              <Badge variant="muted">{activeTeam.league}</Badge>
              <Badge variant={activeTeam.leaguePosition === 1 ? "gold" : "green"}>
                Position {activeTeam.leaguePosition}
              </Badge>
            </div>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-white/70">
              {manager ? "Manager home" : "Player home"}
            </p>
            <h2 className="mt-1 text-4xl font-black leading-none sm:text-5xl">{activeTeam.name}</h2>
            <p className="mt-2 text-sm font-semibold text-white/80">{activeTeam.club}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-[310px]">
            <HeroMetric label="Played" value="16" />
            <HeroMetric label="Won" value="10" />
            <HeroMetric label="Pts" value="56" />
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <Button className="w-full">
            <PlusCircle className="h-4 w-4" />
            {manager ? "Enter result" : "View stats"}
          </Button>
          <Button variant="secondary" className="w-full">
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>
        </div>
      </div>
    </section>
  );
}

function QuickTabs() {
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <div className="flex min-w-max gap-2">
        {quickTabs.map((tab, index) => (
          <button
            key={tab}
            className={cn(
              "min-h-11 rounded-full px-5 text-sm font-extrabold",
              index === 0
                ? "bg-[#37003c] text-white shadow-card"
                : "bg-[#eeeaf2] text-[#25002b]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerHome({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlayerStatCard />
      <SeasonCompleteCard action="View results" />
      <RecentResults />
      <TeamPositionStrip activeTeam={activeTeam} />
    </section>
  );
}

function ManagerHome() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <ManagerActionCard />
      <SeasonCompleteCard action="Review season" />
      <ScoreCard />
      <ManagerSeasonSnapshot />
    </section>
  );
}

function PlayerStatCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Castle Season</CardTitle>
        <Badge variant="green">W W W L L</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] bg-[#37003c] p-4 text-white">
          <p className="text-xs font-extrabold uppercase text-white/65">Points won</p>
          <p className="mt-1 text-6xl font-black leading-none">56</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Win rate" value="63%" dark />
            <MiniStat label="Played" value="16" dark />
            <MiniStat label="Pts against" value="56" dark />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonCompleteCard({ action }: { action: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Complete</CardTitle>
        <Badge variant="green">Qualified</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[18px] bg-[#f7f5fa] p-4">
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Castle</p>
            <p className="mt-1 text-lg font-black">A</p>
          </div>
          <span className="rounded-full bg-[#37003c] px-3 py-1 text-xs font-black text-white">4th</span>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">A League</p>
            <p className="mt-1 text-lg font-black">56 pts</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">{upcomingFixture.date}</p>
        <p className="text-sm font-semibold text-[#6c5a73]">{upcomingFixture.venue}</p>
        <Button className="mt-4 w-full">{action}</Button>
      </CardContent>
    </Card>
  );
}

function RecentResults() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Form</CardTitle>
        <Badge variant="cyan">Last 3</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentResults.map((fixture) => (
          <div key={fixture.id} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
            <div>
              <p className="font-black">{fixture.opponent}</p>
              <p className="text-xs font-semibold text-[#6c5a73]">{fixture.date} - {fixture.homeAway}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">{fixture.score}</p>
              <Badge variant={fixture.result === "Won" ? "green" : "red"}>{fixture.result}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamPositionStrip({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <Card className="md:self-start">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between rounded-[18px] bg-[var(--gradient-success)] p-4 text-[#25002b]">
          <div>
            <p className="text-xs font-extrabold uppercase">Team position</p>
            <p className="text-lg font-black">{activeTeam.name}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black leading-none">{activeTeam.leaguePosition}</p>
            <p className="text-xs font-extrabold uppercase">Place</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerActionCard() {
  return (
    <Card className="border-[#e90052]/20">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <Badge variant="red">
          <Zap className="mr-1 h-3 w-3" />
          Live
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button className="w-full">
          <ClipboardCheck className="h-4 w-4" />
          Review results
        </Button>
        <Button variant="dark" className="w-full">
          <Mail className="h-4 w-4" />
          Message squad
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoreCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Score</CardTitle>
        <Badge variant="muted">Completed</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] bg-[#37003c] p-4 text-white">
          <ScoreRow team="Castle A" score="4" winner />
          <ScoreRow team="Elm Park A" score="3" />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ team, score, winner = false }: { team: string; score: string; winner?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between border-b border-white/10 last:border-0">
      <span className={cn("text-sm font-extrabold", winner ? "text-white" : "text-white/70")}>{team}</span>
      <span className={cn("text-4xl font-black", winner ? "text-[#00ff85]" : "text-white")}>{score}</span>
    </div>
  );
}

function ManagerSeasonSnapshot() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manager Snapshot</CardTitle>
        <Badge variant="muted">Regular season</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Won" value="10" />
          <MiniStat label="Lost" value="6" />
          <MiniStat label="Points for" value="56" />
          <MiniStat label="Points against" value="56" />
        </div>
        <div className="mt-3 rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Playoff line</p>
          <p className="mt-1 font-black">Castle finished 4th, inside the A League semi-final places.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeagueTable({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>League Table</CardTitle>
        <div className="flex gap-2">
          <Badge variant="gold">Final</Badge>
          <Badge variant="green">Semi</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-[#6c5a73]">
              <tr>
                <th className="py-2 pr-2">Pos</th>
                <th className="px-2">Team</th>
                <th className="px-2 text-right">P</th>
                <th className="hidden px-2 text-right sm:table-cell">W</th>
                <th className="hidden px-2 text-right sm:table-cell">L</th>
                <th className="px-2 text-right">Diff</th>
                <th className="px-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const active = row.team === activeTeam.name;
                const diff = row.pointsFor - row.pointsAgainst;

                return (
                  <tr
                    key={row.team}
                    tabIndex={0}
                    className={cn(
                      "border-t outline-none",
                      active && "bg-[#eeeaf2]"
                    )}
                  >
                    <td className="border-t border-[#eeeaf2] py-3 pr-2">
                      <span
                        className={cn(
                          "inline-grid h-8 w-8 place-items-center rounded-full text-xs font-black",
                          row.position === 1
                            ? "bg-[#ffb000] text-[#25002b]"
                            : row.position <= 3
                              ? "bg-[#00ff85] text-[#25002b]"
                              : "bg-[#eeeaf2] text-[#25002b]"
                        )}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-2 font-black">{row.team}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right font-bold">{row.played}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-2 text-right font-bold sm:table-cell">{row.won}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-2 text-right font-bold sm:table-cell">{row.lost}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right font-bold">{diff > 0 ? `+${diff}` : diff}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right text-base font-black">{row.leaguePoints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminFoundation() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin</CardTitle>
        <Badge variant="muted">
          <ShieldCheck className="mr-1 h-3 w-3" />
          Supabase
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {adminModules.map((module) => (
          <div key={module.label} className="rounded-xl bg-[#f7f5fa] p-3">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{module.label}</p>
            <p className="mt-1 text-xl font-black">{module.value}</p>
            <p className="text-xs font-semibold text-[#6c5a73]">{module.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ClubTeamStructureCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Teams</CardTitle>
        <Badge variant="cyan">2026/27</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {clubTeamStructure.map((club) => (
          <div key={club.club} className="rounded-xl bg-[#f7f5fa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-[#eeeaf2]">
                  <img src={club.logoPath} alt={`${club.club} logo`} className="max-h-full max-w-full object-contain" />
                </span>
                <p className="font-black leading-tight">{club.club}</p>
              </div>
              <Badge variant="muted">{club.teams.length}</Badge>
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: club.primaryColor }} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {club.teams.map((team) => (
                <span key={team} className="rounded-full bg-white px-2 py-1 text-xs font-extrabold text-[#37003c] ring-1 ring-[#eeeaf2]">
                  {team}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/14 p-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xs font-extrabold uppercase text-white/65">{label}</p>
      <p className="mt-1 text-3xl font-black leading-none text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-xl p-3", dark ? "bg-white/10" : "bg-[#f7f5fa]")}>
      <p className={cn("text-xs font-extrabold uppercase", dark ? "text-white/60" : "text-[#6c5a73]")}>{label}</p>
      <p className={cn("mt-1 text-xl font-black", dark ? "text-white" : "text-[#25002b]")}>{value}</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eeeaf2] bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-elevated lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-extrabold text-[#6c5a73]",
                index === 0 && "bg-[var(--gradient-primary)] text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
