"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Home,
  LogOut,
  Mail,
  Menu as MenuIcon,
  MessageCircle,
  PlusCircle,
  Trophy,
  UserCircle,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { appearanceMenuOptions, defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import { clubTeamStructure, playerGameResults as demoPlayerGameResults, recentResults, standings, teamContexts, upcomingFixture } from "@/lib/demo-data";
import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, MatchResult, PlayerGameResult, Role, RoleAppearance, Standing, TeamContext } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AppPage = "Home" | "Fixtures" | "Results" | "Table" | "Bookings" | "Players" | "Stats" | "Messages" | "Menu" | "Interclub Leagues";
const roleOptions: Role[] = ["Player", "Manager", "Assistant Manager", "Club Member"];
const RECENT_FORM_LIMIT = 3;
const SIMULATION_CONTROLS_ENABLED = false;
const leagueOrder: TeamContext["league"][] = ["A League", "B League", "C League"];
const pagesWithLeagueAside: AppPage[] = ["Home", "Fixtures", "Results", "Players", "Stats"];

const menuIconMap: Record<AppearanceMenuId | "Menu", typeof Home> = {
  Home,
  Fixtures: CalendarDays,
  Results: ClipboardCheck,
  Table: Trophy,
  Bookings: CalendarPlus,
  Players: Users,
  Stats: BarChart3,
  Messages: Mail,
  "Interclub Leagues": Trophy,
  Menu: MenuIcon
};

function menuEntry(id: AppearanceMenuId) {
  const option = appearanceMenuOptions.find((item) => item.id === id);
  return {
    label: option?.label ?? id,
    page: id as AppPage,
    icon: menuIconMap[id],
    description: option?.description ?? id
  };
}

export function AppShell({
  contexts = teamContexts,
  standingsData = standings,
  playerGameResults = demoPlayerGameResults,
  matchResults,
  activeMatchCount = 0,
  appearance,
  userLabel,
  onSignOut,
  onPageVisit,
  onDataRefresh
}: {
  contexts?: TeamContext[];
  standingsData?: Standing[];
  playerGameResults?: PlayerGameResult[];
  matchResults?: MatchResult[];
  activeMatchCount?: number;
  appearance?: AppearanceConfig;
  userLabel?: string;
  onSignOut?: () => void;
  onPageVisit?: (pageLabel: string, activeTeam: TeamContext) => void;
  onDataRefresh?: () => void;
}) {
  const seasons = useMemo(() => Array.from(new Set(contexts.map((context) => context.season))).filter(Boolean), [contexts]);
  const preferredContextId = useMemo(() => {
    if (typeof window === "undefined") return contexts[0]?.id ?? teamContexts[0].id;
    const params = new URLSearchParams(window.location.search);
    const requestedTeam = params.get("team")?.trim().toLowerCase();
    const requestedRole = params.get("role")?.trim().toLowerCase();
    const requestedSeason = params.get("season")?.trim().toLowerCase();
    if (!requestedTeam && !requestedRole && !requestedSeason) return contexts[0]?.id ?? teamContexts[0].id;
    return contexts.find((team) => {
      const teamMatches = requestedTeam ? team.name.toLowerCase() === requestedTeam : true;
      const roleMatches = requestedRole ? team.role.toLowerCase() === requestedRole : true;
      const seasonMatches = requestedSeason ? team.season.toLowerCase() === requestedSeason : true;
      return teamMatches && roleMatches && seasonMatches;
    })?.id ?? contexts[0]?.id ?? teamContexts[0].id;
  }, [contexts]);
  const preferredContext = useMemo(
    () => contexts.find((team) => team.id === preferredContextId) ?? contexts[0] ?? teamContexts[0],
    [contexts, preferredContextId]
  );
  const [selectedId, setSelectedId] = useState(preferredContextId);
  const [selectedSeason, setSelectedSeason] = useState(preferredContext.season);
  const [activePage, setActivePage] = useState<AppPage>("Home");
  const [simulatedRole, setSimulatedRole] = useState<Role>(contexts[0]?.role ?? teamContexts[0].role);
  const [simulatedClub, setSimulatedClub] = useState(contexts[0]?.club ?? teamContexts[0].club);
  const seasonContexts = useMemo(
    () => contexts.filter((context) => context.season === selectedSeason),
    [contexts, selectedSeason]
  );

  function changeSeason(nextSeason: string) {
    const current = contexts.find((team) => team.id === selectedId);
    const nextContext = contexts.find((team) =>
      team.season === nextSeason &&
      current &&
      team.name === current.name &&
      team.role === current.role &&
      team.club === current.club
    ) ?? contexts.find((team) => team.season === nextSeason) ?? contexts[0];

    setSelectedSeason(nextSeason);
    if (nextContext) setSelectedId(nextContext.id);
  }

  useEffect(() => {
    if (!seasons.includes(selectedSeason)) {
      setSelectedSeason(preferredContext.season);
      return;
    }
    if (!seasonContexts.some((team) => team.id === selectedId)) {
      setSelectedId(seasonContexts[0]?.id ?? preferredContextId);
    }
  }, [preferredContext.season, preferredContextId, seasonContexts, seasons, selectedId, selectedSeason]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if ((params.has("team") || params.has("role") || params.has("season")) && selectedId !== preferredContextId) {
      setSelectedSeason(preferredContext.season);
      setSelectedId(preferredContextId);
    }
  }, [preferredContext.season, preferredContextId, selectedId]);

  const realActiveTeam = useMemo(
    () => seasonContexts.find((team) => team.id === selectedId) ?? seasonContexts[0] ?? contexts[0] ?? teamContexts[0],
    [contexts, seasonContexts, selectedId]
  );
  useEffect(() => {
    setSimulatedRole(realActiveTeam.role);
    setSimulatedClub(realActiveTeam.club);
  }, [realActiveTeam.id, realActiveTeam.role, realActiveTeam.club]);

  const activeTeam = SIMULATION_CONTROLS_ENABLED
    ? buildSimulatedContext(realActiveTeam, simulatedRole, simulatedClub, standingsData)
    : realActiveTeam;
  const appearanceConfig = useMemo(() => normalizeAppearanceConfig(appearance ?? defaultAppearanceConfig), [appearance]);
  const activeAppearance = appearanceConfig[activeTeam.role] ?? defaultAppearanceConfig[activeTeam.role];
  const activeStandings = useMemo(() => {
    const filtered = standingsData.filter((row) => row.league === activeTeam.league && row.season === activeTeam.season);
    return filtered.length ? filtered : standingsData === standings ? standings : [];
  }, [activeTeam.league, activeTeam.season, standingsData]);
  const activeMatchResults = useMemo(
    () => (matchResults ?? []).filter((result) => result.league === activeTeam.league && result.season === activeTeam.season),
    [activeTeam.league, activeTeam.season, matchResults]
  );
  const activePlayerGameResults = useMemo(
    () => playerGameResults.filter((result) => {
      const seasonMatches = result.season === activeTeam.season;
      const leagueMatches = result.league === activeTeam.league;
      const teamMatches = result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name;
      return seasonMatches && leagueMatches && teamMatches;
    }),
    [activeTeam.league, activeTeam.name, activeTeam.season, playerGameResults]
  );
  const allMatchResults = matchResults ?? [];
  const clubMemberView = activeTeam.role === "Club Member";
  const showLeaguePanels = !clubMemberView && pagesWithLeagueAside.includes(activePage);

  useEffect(() => {
    onPageVisit?.(activePage, activeTeam);
  }, [activePage, activeTeam, onPageVisit]);

  return (
    <main className="min-h-screen app-bg pb-24 text-[#10233f]">
      <Header
        activeTeam={activeTeam}
        contexts={seasonContexts.length ? seasonContexts : contexts}
        selectedId={selectedId}
        onContextChange={setSelectedId}
        seasons={seasons}
        selectedSeason={selectedSeason}
        onSeasonChange={changeSeason}
        simulatedRole={simulatedRole}
        simulatedClub={simulatedClub}
        onRoleChange={setSimulatedRole}
        onClubChange={setSimulatedClub}
        onSignOut={onSignOut}
        userLabel={userLabel}
      />
      <section className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:items-start lg:gap-6 lg:px-8 xl:px-10",
        showLeaguePanels ? "lg:grid-cols-[220px_minmax(0,1fr)_380px] xl:grid-cols-[230px_minmax(0,1fr)_400px]" : "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]"
      )}>
        <DesktopRail activeTeam={activeTeam} activePage={activePage} onNavigate={setActivePage} menuItems={activeAppearance.menuItems} />
        <div className="grid gap-4">
          {clubMemberView && activePage !== "Interclub Leagues" ? <ClubMemberHero activeTeam={activeTeam} /> : <MatchdayHero activeTeam={activeTeam} leagueTeamCount={activeStandings.length} interclubView={activePage === "Interclub Leagues"} activeMatchCount={activeMatchCount} />}
          <PageContent
            activePage={activePage}
            activeTeam={activeTeam}
            standingsData={activeStandings}
            allStandingsData={standingsData}
            playerGameResults={activePlayerGameResults}
            matchResults={activeMatchResults}
            allMatchResults={allMatchResults}
            appearance={activeAppearance}
            onNavigate={setActivePage}
            onSignOut={onSignOut}
            userLabel={userLabel}
            onDataRefresh={onDataRefresh}
          />
        </div>
        {showLeaguePanels ? (
          <aside className="grid gap-4 lg:content-start">
            {activePage !== "Table" ? <LeagueTable activeTeam={activeTeam} standingsData={activeStandings} matchResults={activeMatchResults} /> : null}
            <ClubTeamStructureCard />
          </aside>
        ) : null}
      </section>
      <BottomNav activePage={activePage} activeTeam={activeTeam} onNavigate={setActivePage} menuItems={activeAppearance.menuItems} />
    </main>
  );
}

function buildSimulatedContext(baseTeam: TeamContext, role: Role, clubName: string, tableRows: Standing[]): TeamContext {
  const club = clubTeamStructure.find((entry) => entry.club === clubName) ?? clubTeamStructure[0];
  const baseSuffix = baseTeam.name.match(/\b([ABC])$/)?.[1] ?? "A";
  const suffix = role === "Manager" || role === "Assistant Manager" ? "A" : baseSuffix;
  const preferredTeam = club.teams.find((team) => team.endsWith(` ${suffix}`)) ?? club.teams[0] ?? club.club;
  const standing = tableRows.find((row) => row.team === preferredTeam && row.league === baseTeam.league && row.season === baseTeam.season)
    ?? tableRows.find((row) => row.team === preferredTeam);
  const clubMember = role === "Club Member";

  return {
    ...baseTeam,
    id: `${baseTeam.id}-${role}-${club.club}`,
    name: clubMember ? club.club : preferredTeam,
    club: club.club,
    logoPath: club.logoPath,
    primaryColor: club.primaryColor,
    accentColor: club.accentColor,
    role,
    leaguePosition: standing?.position ?? 0,
    leagueMatchesPlayed: standing?.played ?? 0,
    matchesWon: standing?.won ?? 0,
    matchesLost: standing?.lost ?? 0,
    pointsFor: standing?.pointsFor ?? 0,
    pointsAgainst: standing?.pointsAgainst ?? 0,
    leaguePoints: standing?.leaguePoints ?? 0
  };
}

function PageContent({
  activePage,
  activeTeam,
  standingsData,
  allStandingsData,
  playerGameResults,
  matchResults,
  allMatchResults,
  appearance,
  onNavigate,
  onSignOut,
  userLabel,
  onDataRefresh
}: {
  activePage: AppPage;
  activeTeam: TeamContext;
  standingsData: Standing[];
  allStandingsData: Standing[];
  playerGameResults: PlayerGameResult[];
  matchResults: MatchResult[];
  allMatchResults: MatchResult[];
  appearance: RoleAppearance;
  onNavigate: (page: AppPage) => void;
  onSignOut?: () => void;
  userLabel?: string;
  onDataRefresh?: () => void;
}) {
  const leagueTeamCount = standingsData.length;

  if (activePage === "Bookings") return <TableBookings activeTeam={activeTeam} />;
  if (activePage === "Fixtures") return <FixturesPage activeTeam={activeTeam} matchResults={matchResults} leagueTeamCount={leagueTeamCount} />;
  if (activePage === "Results") return <ResultsPage activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} />;
  if (activePage === "Table") return <LeagueTable activeTeam={activeTeam} standingsData={standingsData} matchResults={matchResults} />;
  if (activePage === "Players") return <PlayersPage activeTeam={activeTeam} playerGameResults={playerGameResults} />;
  if (activePage === "Stats") return <StatsPage activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} leagueTeamCount={leagueTeamCount} />;
  if (activePage === "Messages") return <MessagesPage activeTeam={activeTeam} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activePage === "Menu") return <MoreMenu activeTeam={activeTeam} menuItems={appearance.menuItems} onNavigate={onNavigate} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activePage === "Interclub Leagues") return <InterclubLeaguesPage activeTeam={activeTeam} standingsData={allStandingsData} matchResults={allMatchResults} onNavigate={onNavigate} />;
  if (activeTeam.role === "Manager") return <ManagerHome activeTeam={activeTeam} matchResults={matchResults} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} panels={appearance.panels} onDataRefresh={onDataRefresh} />;
  if (activeTeam.role === "Assistant Manager") return <AssistantManagerHome activeTeam={activeTeam} matchResults={matchResults} leagueTeamCount={leagueTeamCount} panels={appearance.panels} />;
  if (activeTeam.role === "Club Member") return <ClubMemberHome activeTeam={activeTeam} onNavigate={onNavigate} panels={appearance.panels} />;
  return <PlayerHome activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} panels={appearance.panels} />;
}

function Header({
  activeTeam,
  contexts,
  selectedId,
  onContextChange,
  seasons,
  selectedSeason,
  onSeasonChange,
  simulatedRole,
  simulatedClub,
  userLabel,
  onRoleChange,
  onClubChange,
  onSignOut
}: {
  activeTeam: TeamContext;
  contexts: TeamContext[];
  selectedId: string;
  onContextChange: (id: string) => void;
  seasons: string[];
  selectedSeason: string;
  onSeasonChange: (season: string) => void;
  simulatedRole: Role;
  simulatedClub: string;
  userLabel?: string;
  onRoleChange: (role: Role) => void;
  onClubChange: (club: string) => void;
  onSignOut?: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#10233f] px-4 py-3 text-white shadow-elevated sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.16)] ring-1 ring-white/25">
            <img src="/favicon.ico" alt="Interclub Snooker" className="h-full w-full rounded-lg object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-wide text-white/75">
              Interclub Snooker
            </p>
            <h1 className="truncate text-lg font-extrabold leading-tight">{activeTeam.season}</h1>
            {userLabel ? (
              <p className="truncate text-xs font-bold text-white/70 sm:hidden">
                {userLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[360px] sm:grid-cols-[130px_minmax(220px,1fr)]">
          <SeasonSwitcher seasons={seasons} selectedSeason={selectedSeason} onChange={onSeasonChange} />
          <ContextSwitcher
            contexts={contexts}
            selectedId={selectedId}
            activeTeam={activeTeam}
            onChange={onContextChange}
          />
          {SIMULATION_CONTROLS_ENABLED ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:col-span-2">
              <RoleSimulator value={simulatedRole} onChange={onRoleChange} />
              <ClubSimulator value={simulatedClub} onChange={onClubChange} />
            </div>
          ) : null}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {userLabel ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <UserCircle className="h-5 w-5 shrink-0" />
                <span className="max-w-[180px] truncate text-sm font-bold">{userLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl bg-white p-2 text-[#10233f] shadow-elevated ring-1 ring-[#eeeaf2]" role="menu">
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold uppercase text-[#6c5a73]">Signed in as</p>
                    <p className="truncate text-sm font-extrabold">{userLabel}</p>
                  </div>
                  {onSignOut ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        onSignOut();
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-[#10233f] transition-colors hover:bg-[#f7f5fa] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function contextLabel(context: TeamContext) {
  if (context.role === "Club Member") return `${context.club.replace(" Golf Club", "")} - Member`;
  return `${context.name} - ${context.role}`;
}

function contextDescription(context: TeamContext) {
  if (context.role === "Club Member") return "Club access";
  return `${context.league} - ${context.club.replace(" Golf Club", "")}`;
}

function SeasonSwitcher({ seasons, selectedSeason, onChange }: { seasons: string[]; selectedSeason: string; onChange: (season: string) => void }) {
  if (seasons.length <= 1) {
    return (
      <div className="min-h-11 rounded-xl bg-white/95 px-4 py-2 text-[#10233f] shadow-card">
        <p className="truncate text-[11px] font-bold uppercase text-[#6c5a73]">Season</p>
        <p className="truncate text-sm font-extrabold">{selectedSeason}</p>
      </div>
    );
  }

  return (
    <label className="relative block w-full">
      <span className="sr-only">Switch season</span>
      <select
        value={selectedSeason}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-xl border border-white/15 bg-white/95 px-4 pr-10 text-sm font-bold text-[#10233f] shadow-card outline-none"
      >
        {seasons.map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-[#10233f]" />
    </label>
  );
}

function ContextSwitcher({
  contexts,
  selectedId,
  activeTeam,
  onChange
}: {
  contexts: TeamContext[];
  selectedId: string;
  activeTeam: TeamContext;
  onChange: (id: string) => void;
}) {
  if (contexts.length <= 1) {
    return (
      <div className="min-h-11 rounded-xl bg-white/95 px-4 py-2 text-[#10233f] shadow-card">
        <p className="truncate text-sm font-extrabold">{contextLabel(activeTeam)}</p>
        <p className="truncate text-[11px] font-bold text-[#6c5a73]">{contextDescription(activeTeam)}</p>
      </div>
    );
  }

  return (
    <label className="relative block w-full">
      <span className="sr-only">Switch team role</span>
      <select
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-xl border border-white/15 bg-white/95 px-4 pr-10 text-sm font-bold text-[#10233f] shadow-card outline-none"
      >
        {contexts.map((context) => (
          <option key={context.id} value={context.id}>
            {contextLabel(context)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-[#10233f]" />
    </label>
  );
}

function RoleSimulator({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <label className="relative block w-full">
      <span className="sr-only">Simulate role</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Role)}
        className="h-11 w-full appearance-none rounded-xl border border-white/15 bg-white/95 px-4 pr-9 text-sm font-bold text-[#10233f] shadow-card outline-none"
      >
        {roleOptions.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-[#10233f]" />
    </label>
  );
}

function ClubSimulator({ value, onChange }: { value: string; onChange: (club: string) => void }) {
  return (
    <label className="relative block w-full">
      <span className="sr-only">Simulate club</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-white/15 bg-white/95 px-4 pr-9 text-sm font-bold text-[#10233f] shadow-card outline-none"
      >
        {clubTeamStructure.map((club) => (
          <option key={club.club} value={club.club}>
            {club.club}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-[#10233f]" />
    </label>
  );
}

function DesktopRail({ activeTeam, activePage, onNavigate, menuItems }: { activeTeam: TeamContext; activePage: AppPage; onNavigate: (page: AppPage) => void; menuItems: AppearanceMenuId[] }) {
  const items = menuItems.map(menuEntry);

  return (
    <aside className="hidden self-start rounded-[18px] p-4 text-white shadow-card lg:sticky lg:top-24 lg:block" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
      <p className="text-xs font-bold uppercase text-white/60">{activeTeam.role === "Club Member" ? "Club" : "Competition"}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{activeTeam.role === "Club Member" ? activeTeam.club.replace(" Golf Club", "") : activeTeam.league}</h2>
      <div className="mt-5 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-white/80 transition-colors hover:bg-white/10",
                activePage === item.page && "bg-white text-[#10233f]"
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

function MatchdayHero({ activeTeam, leagueTeamCount, interclubView = false, activeMatchCount = 0 }: { activeTeam: TeamContext; leagueTeamCount: number; interclubView?: boolean; activeMatchCount?: number }) {
  const manager = activeTeam.role === "Manager" || activeTeam.role === "Assistant Manager";
  const clubMember = activeTeam.role === "Club Member";
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const played = activeTeam.leagueMatchesPlayed ?? 0;
  const won = activeTeam.matchesWon ?? 0;
  const points = activeTeam.leaguePoints ?? activeTeam.pointsFor ?? 0;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);
  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-card">
      <div className="relative p-4 sm:p-5 xl:p-6" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        {activeMatchCount > 0 ? (
          <div className="absolute right-3 top-3 z-10 rounded-md bg-[#00ff85] px-2 py-1 text-[11px] font-bold text-[#10233f] ring-1 ring-white/30">
            Matches in play{activeMatchCount > 1 ? ` (${activeMatchCount})` : ""}
          </div>
        ) : null}
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] xl:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <ClubLogoTile club={activeTeam.club} logoPath={activeTeam.logoPath} size="hero" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan">{activeTeam.role}</Badge>
                <Badge variant="muted">{activeTeam.league}</Badge>
                <Badge variant={hasLeagueTable ? qualificationBadgeVariant(qualification) : "muted"}>
                  {hasLeagueTable ? `Position ${activeTeam.leaguePosition}` : "Table pending"}
                </Badge>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/70">
                {clubMember && interclubView ? "Interclub leagues" : clubMember ? "Club member home" : manager ? "Manager home" : "Player home"}
              </p>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl xl:text-5xl">{activeTeam.name}</h2>
              <p className="mt-2 text-sm font-semibold text-white/80">{activeTeam.club}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeroMetric label="Played" value={hasLeagueTable ? String(played) : "-"} />
            <HeroMetric label="Won" value={hasLeagueTable ? String(won) : "-"} />
            <HeroMetric label="Pts" value={hasLeagueTable ? String(points) : "-"} />
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 xl:max-w-[620px]">
          <Button className="w-full">
            <PlusCircle className="h-4 w-4" />
            {clubMember ? "Book table" : activeTeam.role === "Assistant Manager" ? "Support team" : manager ? "Enter result" : "View stats"}
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

function ClubMemberHero({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-card">
      <div className="relative p-4 sm:p-5 xl:p-6" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        <div className="relative flex min-w-0 items-start gap-3">
          <ClubLogoTile club={activeTeam.club} logoPath={activeTeam.logoPath} size="hero" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">Club Member</Badge>
              <Badge variant="muted">Tables</Badge>
              <Badge variant="muted">Messages</Badge>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/70">Club home</p>
            <h2 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl xl:text-5xl">{activeTeam.club}</h2>
            <p className="mt-2 text-sm font-semibold text-white/80">Book tables, read club notices and manage your account.</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 xl:max-w-[620px]">
          <Button className="w-full">
            <CalendarPlus className="h-4 w-4" />
            Book table
          </Button>
          <Button variant="secondary" className="w-full">
            <MessageCircle className="h-4 w-4" />
            Messages
          </Button>
        </div>
      </div>
    </section>
  );
}

function ClubLogoTile({ club, logoPath, size }: { club: string; logoPath: string; size: "hero" | "compact" }) {
  const dunLaoghaire = club === "Dun Laoghaire Golf Club";

  if (size === "compact") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#eeeaf2]",
          dunLaoghaire ? "h-12 w-10 p-1" : "h-9 w-9 p-1.5"
        )}
      >
        <img src={logoPath} alt={`${club} logo`} className="max-h-full max-w-full object-contain" />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.18)] ring-1 ring-white/20 sm:h-20",
        dunLaoghaire ? "w-16 p-1.5 sm:h-24 sm:w-20" : "w-16 p-2 sm:w-20"
      )}
    >
      <img src={logoPath} alt={`${club} logo`} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

type BookingSlot = {
  id: string;
  tableId: string;
  personId: string;
  bookedBy: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  canCancel: boolean;
  createdAt: string;
};

type BookingTable = {
  tableId: string;
  tableName: string;
  tableDescription: string;
};

type BookingPayload = {
  clubName: string;
  bookingDate: string;
  slotHours: number[];
  tables: BookingTable[];
  bookings: BookingSlot[];
};

function isoDateFromOffset(date: string, offsetDays: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offsetDays);
  return localIsoDate(next);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBookingDate(date: string) {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(`${date}T12:00:00`));
}

function formatFixtureDate(date: string) {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(date));
}

function ordinal(value: number) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const last = value % 10;
  if (last === 1) return `${value}st`;
  if (last === 2) return `${value}nd`;
  if (last === 3) return `${value}rd`;
  return `${value}th`;
}

type QualificationStatus = "final" | "semi" | "none";

function qualificationStatus(position: number, teamCount: number): QualificationStatus {
  if (!position || !teamCount) return "none";
  if (teamCount >= 7) return position <= 4 ? "semi" : "none";
  if (teamCount >= 5) {
    if (position === 1) return "final";
    return position <= 3 ? "semi" : "none";
  }
  return "none";
}

function qualificationBadgeVariant(status: QualificationStatus) {
  if (status === "final") return "gold";
  if (status === "semi") return "green";
  return "muted";
}

function qualificationLabel(status: QualificationStatus) {
  if (status === "final") return "Final";
  if (status === "semi") return "Semi";
  return "Outside playoffs";
}

function clubPanelStyle(color: string, accentColor = "#10233F"): CSSProperties {
  return {
    background:
      `radial-gradient(circle at 18% 18%, ${color}aa, transparent 12rem), ` +
      `linear-gradient(135deg, ${color} 0%, ${accentColor} 62%, #071426 100%)`
  };
}

function clubAccentStyle(color: string, accentColor = "#10233F"): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color} 0%, ${accentColor} 100%)`,
    color: "white"
  };
}

function clubSoftAccentStyle(color: string): CSSProperties {
  return {
    backgroundColor: `${color}14`,
    borderColor: `${color}33`
  };
}

function clubForTeam(teamName: string) {
  return clubTeamStructure.find((club) => club.teams.includes(teamName));
}

function teamColors(teamName: string) {
  const club = clubForTeam(teamName);
  return {
    primaryColor: club?.primaryColor ?? "#10233f",
    accentColor: club?.accentColor ?? "#071426"
  };
}

function scoreTone(score: number, opponentScore: number) {
  if (score > opponentScore) return "text-[#007a3d] bg-[#00ff8526] ring-[#00a85a33]";
  if (score < opponentScore) return "text-[#b00035] bg-[#e9005214] ring-[#e9005233]";
  return "text-[#10233f] bg-[#eeeaf2] ring-[#d8d0df]";
}

function tableForm(row: Standing, matchResults: MatchResult[] = []) {
  const playedResults = matchResults
    .filter((result) => result.homeTeamName === row.team || result.awayTeamName === row.team)
    .sort((a, b) => b.fixtureDate.localeCompare(a.fixtureDate))
    .slice(0, RECENT_FORM_LIMIT)
    .map((result) => {
      const home = result.homeTeamName === row.team;
      const teamScore = home ? result.homeTeamScore : result.awayTeamScore;
      const opponentScore = home ? result.awayTeamScore : result.homeTeamScore;
      return teamScore >= opponentScore ? "W" : "L";
    });

  if (playedResults.length) return playedResults.join("");

  const values: string[] = [];
  for (let index = 0; index < row.won && values.length < RECENT_FORM_LIMIT; index += 1) values.push("W");
  for (let index = 0; index < row.lost && values.length < RECENT_FORM_LIMIT; index += 1) values.push("L");
  return values.length ? values.join("") : "-";
}

function TableBookings({ activeTeam }: { activeTeam: TeamContext }) {
  const [bookingDate, setBookingDate] = useState(localIsoDate());
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busySlot, setBusySlot] = useState("");
  const currentLocalDate = localIsoDate();

  if (activeTeam.club !== "Castle Golf Club") {
    return (
      <section className="grid gap-4">
        <Card className="overflow-hidden">
          <CardContent className="pt-4">
            <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
              <p className="text-xs font-extrabold uppercase text-white/65">Table bookings</p>
              <h2 className="mt-1 text-3xl font-black leading-none">{activeTeam.club}</h2>
              <p className="mt-2 text-sm font-semibold text-white/75">
                Club-specific table booking is ready for Castle first. This club can be switched on when its tables are added.
              </p>
            </div>
          </CardContent>
        </Card>
        <MessagesPage activeTeam={activeTeam} compact />
      </section>
    );
  }

  const loadBookings = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/table-bookings?date=${bookingDate}`, { credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bookings unavailable.");
      setPayload(data);
    } catch (error) {
      setPayload(null);
      setMessage(error instanceof Error ? error.message : "Bookings unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, [bookingDate]);

  const bookingBySlot = useMemo(() => {
    const map = new Map<string, BookingSlot>();
    payload?.bookings.forEach((booking) => {
      map.set(`${booking.tableId}-${booking.startTime}`, booking);
    });
    return map;
  }, [payload]);

  const bookSlot = async (tableId: string, startHour: number) => {
    const key = `${tableId}-${startHour}`;
    setBusySlot(key);
    setMessage("");
    try {
      const response = await fetch("/api/table-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tableId, bookingDate, startHour })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking failed.");
      await loadBookings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Booking failed.");
    } finally {
      setBusySlot("");
    }
  };

  const cancelBooking = async (booking: BookingSlot) => {
    setBusySlot(booking.id);
    setMessage("");
    try {
      const response = await fetch(`/api/table-bookings/${booking.id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cancellation failed.");
      await loadBookings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation failed.");
    } finally {
      setBusySlot("");
    }
  };

  return (
    <section className="grid gap-4">
      <Card className="overflow-hidden">
        <CardContent className="pt-4">
          <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-white/65">Table bookings</p>
                <h2 className="mt-1 text-3xl font-black leading-none">{activeTeam.club}</h2>
                <p className="mt-2 text-sm font-semibold text-white/75">Book hourly slots from 11:00 to 23:00.</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <CalendarPlus className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0" onClick={() => setBookingDate(isoDateFromOffset(bookingDate, -1))} aria-label="Previous day">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Booking date</span>
              <span className="grid min-h-14 place-items-center rounded-xl bg-white px-4 text-center text-base font-extrabold text-[#25002b]">
                  {new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${bookingDate}T12:00:00`))}
                </span>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0" onClick={() => setBookingDate(isoDateFromOffset(bookingDate, 1))} aria-label="Next day">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            {bookingDate !== currentLocalDate ? (
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setBookingDate(currentLocalDate)}>
                Today
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-[18px] bg-white p-4 text-sm font-extrabold shadow-card" style={{ color: activeTeam.primaryColor }}>
          {message}
        </div>
      ) : null}

      {loading ? (
        <BookingsSkeleton />
      ) : payload ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {payload.tables.map((table) => (
            <Card key={table.tableId} className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{table.tableName}</CardTitle>
                  <p className="mt-1 text-xs font-bold uppercase text-[#6c5a73]">{table.tableDescription}</p>
                </div>
                <Badge variant="cyan">{formatBookingDate(payload.bookingDate)}</Badge>
              </CardHeader>
              <CardContent className="grid gap-2">
                {payload.slotHours.map((hour) => {
                  const startTime = `${String(hour).padStart(2, "0")}:00`;
                  const booking = bookingBySlot.get(`${table.tableId}-${startTime}`);
                  const busy = busySlot === `${table.tableId}-${hour}` || busySlot === booking?.id;

                  return (
                    <div
                      key={`${table.tableId}-${hour}`}
                      className={cn(
                        "grid min-h-[72px] grid-cols-[72px_1fr] items-center gap-3 rounded-xl p-3 ring-1",
                        booking ? "bg-[#f7f5fa] ring-[#eeeaf2]" : "bg-white ring-[#eeeaf2]"
                      )}
                    >
                      <div className="text-center">
                        <p className="text-xl font-extrabold leading-none">{startTime}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase text-[#6c5a73]">{String(hour + 1).padStart(2, "0")}:00</p>
                      </div>
                      {booking ? (
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Badge variant={booking.canCancel ? "green" : "muted"}>{booking.canCancel ? "Your booking" : "Booked"}</Badge>
                            <p className="mt-1 truncate text-sm font-bold">{booking.bookedBy}</p>
                          </div>
                          {booking.canCancel ? (
                            <Button variant="ghost" size="icon" onClick={() => cancelBooking(booking)} disabled={busy} aria-label={`Cancel ${table.tableName} at ${startTime}`}>
                              <XCircle className="h-5 w-5" style={{ color: activeTeam.primaryColor }} />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Button variant="dark" className="justify-self-end" onClick={() => bookSlot(table.tableId, hour)} disabled={busy}>
                          <Clock3 className="h-4 w-4" />
                          Book
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-[#6c5a73]">Castle table bookings will appear here for signed-in Castle members.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function BookingsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[1, 2].map((table) => (
        <Card key={table}>
          <CardHeader>
            <div className="h-6 w-28 animate-pulse rounded-full bg-[#eeeaf2]" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-[#eeeaf2]" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {[1, 2, 3, 4].map((slot) => (
              <div key={slot} className="h-[72px] animate-pulse rounded-xl bg-[#f7f5fa]" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlayerHome({ activeTeam, playerGameResults, matchResults, onNavigate, leagueTeamCount, panels }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[]; matchResults: MatchResult[]; onNavigate: (page: AppPage) => void; leagueTeamCount: number; panels: AppearancePanelId[] }) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} />;
    if (panel === "myStats") return <PlayerStatCard key={panel} activeTeam={activeTeam} playerGameResults={playerGameResults} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "personalRecentForm") return <PersonalRecentFormCard key={panel} playerGameResults={playerGameResults} />;
    if (panel === "individualGames") return <PlayerGameResultsCard key={panel} results={playerGameResults} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:gap-5">
      {panels.map(renderPanel)}
    </section>
  );
}

function ClubMemberHome({ activeTeam, onNavigate, panels }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; panels: AppearancePanelId[] }) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "clubAccess") {
      return (
        <Card key={panel}>
          <CardHeader>
            <CardTitle>Club Access</CardTitle>
            <Badge variant="cyan">Member</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MiniStat label="Club" value={activeTeam.club.replace(" Golf Club", "")} />
            <MiniStat label="Access" value="Tables" />
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              Club members can receive club messages and book tables at their club.
            </p>
          </CardContent>
        </Card>
      );
    }
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    if (panel === "interclubLeagues") {
      return (
        <Card key={panel}>
          <CardHeader>
            <CardTitle>Interclub Leagues</CardTitle>
            <Badge variant="muted">Optional</Badge>
          </CardHeader>
          <CardContent>
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              Fixtures, tables, players and stats are available separately when you want to follow the leagues.
            </p>
            <Button className="mt-3 w-full" onClick={() => onNavigate("Interclub Leagues")} style={{ backgroundColor: activeTeam.primaryColor }}>
              <Trophy className="h-4 w-4" />
              View leagues
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (panel === "messages") return <MessagesPage key={panel} activeTeam={activeTeam} compact />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {panels.map(renderPanel)}
    </section>
  );
}

function MemberActionsCard({ activeTeam, onNavigate }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Actions</CardTitle>
        <Badge variant="muted">{activeTeam.club.replace(" Golf Club", "")}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button className="w-full" onClick={() => onNavigate("Bookings")} style={{ backgroundColor: activeTeam.primaryColor }}>
          <CalendarPlus className="h-4 w-4" />
          Book table
        </Button>
        <button
          type="button"
          className="grid min-h-[68px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
            <Trophy className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-black">Enter competitions</span>
            <span className="block text-xs font-semibold text-[#6c5a73]">Coming soon</span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}

function InterclubLeaguesPage({
  activeTeam,
  standingsData,
  matchResults,
  onNavigate
}: {
  activeTeam: TeamContext;
  standingsData: Standing[];
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
}) {
  const orderedLeagues = activeTeam.role === "Club Member"
    ? leagueOrder
    : [activeTeam.league, ...leagueOrder.filter((league) => league !== activeTeam.league)];

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Interclub Leagues</CardTitle>
          <Badge variant="muted">{activeTeam.role === "Club Member" ? "A to C" : `${activeTeam.league} first`}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {[
            { label: "Fixtures", page: "Fixtures" as AppPage, icon: CalendarDays },
            { label: "Results", page: "Results" as AppPage, icon: ClipboardCheck },
            { label: "League table", page: "Table" as AppPage, icon: Trophy },
            { label: "Players", page: "Players" as AppPage, icon: Users },
            { label: "Statistics", page: "Stats" as AppPage, icon: BarChart3 }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className="grid min-h-[76px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-black">{item.label}</span>
                  <span className="block text-xs font-semibold text-[#6c5a73]">Open focused {item.label.toLowerCase()}</span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>
      {orderedLeagues.map((league) => {
        const leagueStandings = standingsData.filter((row) => row.league === league && row.season === activeTeam.season);
        const leagueResults = matchResults.filter((result) => result.league === league && result.season === activeTeam.season);
        const contextForLeague = {
          ...activeTeam,
          league,
          name: activeTeam.role === "Club Member" ? activeTeam.club : activeTeam.name,
          leaguePosition: leagueStandings.find((row) => row.team === activeTeam.name)?.position ?? 0
        };

        return (
          <section key={league} className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <LeagueTable activeTeam={contextForLeague} standingsData={leagueStandings} matchResults={leagueResults} />
            <SeasonResultsCard activeTeam={contextForLeague} results={leagueResults} defaultScope="league" />
          </section>
        );
      })}
    </section>
  );
}

function FixturesPage({ activeTeam, matchResults, leagueTeamCount }: { activeTeam: TeamContext; matchResults: MatchResult[]; leagueTeamCount: number }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <SeasonCompleteCard activeTeam={activeTeam} action="View match" leagueTeamCount={leagueTeamCount} />
      <TeamRecentFormCard activeTeam={activeTeam} matchResults={matchResults} />
    </section>
  );
}

function ResultsPage({ activeTeam, playerGameResults, matchResults }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[]; matchResults: MatchResult[] }) {
  const playerView = activeTeam.role === "Player";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <LatestTeamResultCard activeTeam={activeTeam} matchResults={matchResults} />
      <SeasonResultsCard activeTeam={activeTeam} results={matchResults} />
      {playerView ? <PlayerGameResultsCard results={playerGameResults} /> : null}
    </section>
  );
}

function PlayersPage({ activeTeam, playerGameResults }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[] }) {
  const playerView = activeTeam.role === "Player";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {playerView ? <PlayerGameResultsCard results={playerGameResults} /> : <SquadManagementCard activeTeam={activeTeam} />}
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <Badge variant="muted">{activeTeam.name}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          {["Garry Lyons", "Eric Goodwin", "Mark Byrne", "Karl Ward"].map((name) => (
            <div key={name} className="rounded-xl bg-[#f7f5fa] p-3 font-black">{name}</div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function StatsPage({ activeTeam, playerGameResults, matchResults, leagueTeamCount }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[]; matchResults: MatchResult[]; leagueTeamCount: number }) {
  if (activeTeam.role === "Manager" || activeTeam.role === "Assistant Manager") {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <TeamStatsCard activeTeam={activeTeam} onNavigate={() => {}} leagueTeamCount={leagueTeamCount} />
        <ManagerSeasonSnapshot activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />
        <TeamRecentFormCard activeTeam={activeTeam} matchResults={matchResults} />
        <SquadManagementCard activeTeam={activeTeam} />
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlayerStatCard activeTeam={activeTeam} playerGameResults={playerGameResults} />
      <TeamPositionStrip activeTeam={activeTeam} />
      <PlayerGameResultsCard results={playerGameResults} />
    </section>
  );
}

function MessagesPage({ activeTeam, compact = false, onSignOut, userLabel }: { activeTeam: TeamContext; compact?: boolean; onSignOut?: () => void; userLabel?: string }) {
  const clubMember = activeTeam.role === "Club Member";

  return (
    <Card className={compact ? "" : "md:max-w-xl"}>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <Badge variant="muted">{activeTeam.club}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Club notice</p>
          <p className="mt-1 font-black">Table booking messages will appear here.</p>
        </div>
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{clubMember ? "Interclub notice" : "Team notice"}</p>
          <p className="mt-1 font-black">{clubMember ? "League updates will appear in Interclub Leagues." : "Manager and club messages are coming next."}</p>
        </div>
        {onSignOut ? (
          <div className="rounded-xl bg-[#f7f5fa] p-3">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Account</p>
            <p className="mt-1 truncate text-sm font-bold text-[#6c5a73]">{userLabel ?? "Signed in"}</p>
            <Button variant="dark" className="mt-3 w-full" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MoreMenu({
  activeTeam,
  menuItems,
  onNavigate,
  onSignOut,
  userLabel
}: {
  activeTeam: TeamContext;
  menuItems: AppearanceMenuId[];
  onNavigate: (page: AppPage) => void;
  onSignOut?: () => void;
  userLabel?: string;
}) {
  const configured = menuItems.map(menuEntry);
  const overflowItems = configured.length > 5 ? configured.slice(4) : configured;
  const items = overflowItems.filter((item) => item.page !== "Home");

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {onSignOut ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <Badge variant="muted">{userLabel ?? "Signed in"}</Badge>
          </CardHeader>
          <CardContent>
            <Button variant="dark" className="w-full" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>More</CardTitle>
          <Badge variant="muted">{activeTeam.name}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className="grid min-h-[76px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-black">{item.label}</span>
                  <span className="block text-xs font-semibold text-[#6c5a73]">{item.description}</span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function ManagerHome({ activeTeam, matchResults, onNavigate, leagueTeamCount, panels, onDataRefresh }: { activeTeam: TeamContext; matchResults: MatchResult[]; onNavigate: (page: AppPage) => void; leagueTeamCount: number; panels: AppearancePanelId[]; onDataRefresh?: () => void }) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "matchPlanning") return <MatchPlanningCard key={panel} activeTeam={activeTeam} onDataRefresh={onDataRefresh} />;
    if (panel === "managerActions") return <ManagerActionCard key={panel} activeTeam={activeTeam} />;
    if (panel === "seasonComplete") return <SeasonCompleteCard key={panel} activeTeam={activeTeam} action="Review season" leagueTeamCount={leagueTeamCount} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "squadManagement") return <SquadManagementCard key={panel} activeTeam={activeTeam} />;
    if (panel === "managerSnapshot") return <ManagerSeasonSnapshot key={panel} activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} />;
    if (panel === "messages") return <MessagesPage key={panel} activeTeam={activeTeam} compact />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {panels.map(renderPanel)}
    </section>
  );
}

function MatchPlanningCard({ activeTeam, onDataRefresh }: { activeTeam: TeamContext; onDataRefresh?: () => void }) {
  return <ManagerLineupCard activeTeam={activeTeam} onDataRefresh={onDataRefresh} />;
}

function AssistantManagerHome({ activeTeam, matchResults, leagueTeamCount, panels }: { activeTeam: TeamContext; matchResults: MatchResult[]; leagueTeamCount: number; panels: AppearancePanelId[] }) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "assistantHub") {
      return (
        <Card key={panel}>
          <CardHeader>
            <CardTitle>Assistant Hub</CardTitle>
            <Badge variant="cyan">Team support</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button className="w-full">
              <Users className="h-4 w-4" />
              Check squad
            </Button>
            <Button variant="dark" className="w-full">
              <Mail className="h-4 w-4" />
              Message team
            </Button>
            <Button variant="secondary" className="w-full">
              <CalendarPlus className="h-4 w-4" />
              Book table
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (panel === "seasonComplete") return <SeasonCompleteCard key={panel} activeTeam={activeTeam} action="View fixtures" leagueTeamCount={leagueTeamCount} />;
    if (panel === "managerSnapshot") return <ManagerSeasonSnapshot key={panel} activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />;
    if (panel === "messages") return <MessagesPage key={panel} activeTeam={activeTeam} compact />;
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={() => {}} leagueTeamCount={leagueTeamCount} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={() => {}} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {panels.map(renderPanel)}
    </section>
  );
}

function TeamStatsCard({ activeTeam, onNavigate, leagueTeamCount }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; leagueTeamCount: number }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);

  return (
    <Card className="overflow-hidden md:col-span-2 xl:col-span-1">
      <CardHeader>
        <CardTitle>Team Stats</CardTitle>
        <Badge variant={hasLeagueTable ? qualificationBadgeVariant(qualification) : "muted"}>
          {hasLeagueTable ? ordinal(activeTeam.leaguePosition) : "Pending"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <p className="text-xs font-extrabold uppercase text-white/65">{activeTeam.league}</p>
          <p className="mt-1 text-3xl font-black leading-tight">{activeTeam.name}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Played" value={String(activeTeam.leagueMatchesPlayed || "-")} dark />
            <MiniStat label="Won" value={String(activeTeam.matchesWon ?? "-")} dark />
            <MiniStat label="Points" value={String(activeTeam.leaguePoints ?? activeTeam.pointsFor ?? "-")} dark />
          </div>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => onNavigate("Table")}>
            <Trophy className="h-4 w-4" />
            View table
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerStatCard({ activeTeam = teamContexts[0], playerGameResults = demoPlayerGameResults }: { activeTeam?: TeamContext; playerGameResults?: PlayerGameResult[] }) {
  const wins = playerGameResults.filter((result) => result.result === "Won").length;
  const losses = playerGameResults.filter((result) => result.result === "Lost").length;
  const played = playerGameResults.length;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const recentForm = playerGameResults.slice(0, RECENT_FORM_LIMIT).map((fixture) => fixture.result === "Won" ? "W" : "L").join(" ");

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>My Stats</CardTitle>
        <Badge variant="green">{recentForm || "-"}</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <p className="text-xs font-extrabold uppercase text-white/65">Personal win rate</p>
          <p className="mt-1 text-6xl font-black leading-none">{played ? `${winRate}%` : "-"}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Played" value={String(played || "-")} dark />
            <MiniStat label="Won" value={String(wins || "-")} dark />
            <MiniStat label="Lost" value={String(losses || "-")} dark />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonCompleteCard({ activeTeam = teamContexts[0], action, leagueTeamCount = standings.length, onAction }: { activeTeam?: TeamContext; action: string; leagueTeamCount?: number; onAction?: () => void }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);
  const qualified = qualification !== "none";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Complete</CardTitle>
        <Badge variant={hasLeagueTable ? qualificationBadgeVariant(qualification) : "muted"}>{hasLeagueTable && qualified ? qualificationLabel(qualification) : "Final table"}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[18px] border p-4" style={clubSoftAccentStyle(activeTeam.primaryColor)}>
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{activeTeam.club.replace(" Golf Club", "")}</p>
            <p className="mt-1 text-lg font-black">{activeTeam.name.replace(activeTeam.club.replace(" Golf Club", ""), "").trim() || activeTeam.name}</p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: activeTeam.primaryColor }}>{hasLeagueTable ? ordinal(activeTeam.leaguePosition) : "-"}</span>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{activeTeam.league}</p>
            <p className="mt-1 text-lg font-black leading-tight">{activeTeam.leaguePoints ?? activeTeam.pointsFor ?? "-"} pts</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">{upcomingFixture.date}</p>
        <p className="text-sm font-semibold text-[#6c5a73]">
          {hasLeagueTable
            ? `${activeTeam.name} finished ${ordinal(activeTeam.leaguePosition)} in ${activeTeam.league}`
            : `${activeTeam.name} has no league table yet`}
        </p>
        <Button className="mt-4 w-full" style={{ backgroundColor: activeTeam.primaryColor }} onClick={onAction}>{action}</Button>
      </CardContent>
    </Card>
  );
}

function SeasonResultsCard({ activeTeam, results, defaultScope = "club" }: { activeTeam: TeamContext; results: MatchResult[]; defaultScope?: "club" | "league" }) {
  const [scope, setScope] = useState<"club" | "league">(defaultScope);
  const clubResults = useMemo(
    () => results.filter((result) => result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name),
    [activeTeam.name, results]
  );
  const scopedResults = scope === "club" ? clubResults : results;
  const sortedResults = useMemo(
    () => [...scopedResults].sort((a, b) => b.fixtureDate.localeCompare(a.fixtureDate) || a.homeTeamName.localeCompare(b.homeTeamName)),
    [scopedResults]
  );
  const weekGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; date: string; weekNumber: number; results: MatchResult[] }>();

    sortedResults.forEach((result) => {
      const key = result.weekId ?? `${result.league}-${result.season}-${result.fixtureDate.slice(0, 10)}`;
      const weekNumber = result.weekNumber ?? 0;
      const existing = groups.get(key);
      if (existing) {
        existing.results.push(result);
        if (result.fixtureDate < existing.date) existing.date = result.fixtureDate;
        return;
      }

      groups.set(key, {
        key,
        label: result.weekLabel ?? (weekNumber ? `Week ${weekNumber}` : formatFixtureDate(result.fixtureDate)),
        date: result.fixtureDate,
        weekNumber,
        results: [result]
      });
    });

    return Array.from(groups.values()).sort((a, b) => b.weekNumber - a.weekNumber || b.date.localeCompare(a.date));
  }, [sortedResults]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{scope === "club" ? `${activeTeam.name} Results` : "League Results"}</CardTitle>
        <Badge variant="cyan">{sortedResults.length ? `${sortedResults.length} matches` : activeTeam.season}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f5fa] p-1">
          {[
            { label: "My club", value: "club" as const, count: clubResults.length },
            { label: "All league", value: "league" as const, count: results.length }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScope(item.value)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-bold transition-colors",
                scope === item.value ? "bg-[#10233f] text-white shadow-card" : "text-[#10233f]"
              )}
            >
              {item.label} <span className={cn("font-semibold", scope === item.value ? "text-white/70" : "text-[#6c5a73]")}>({item.count})</span>
            </button>
          ))}
        </div>
        {scope === "league" ? (
          <div className="space-y-3">
            {weekGroups.map((group) => (
              <section key={group.key} className="rounded-xl p-2 ring-1 ring-[#eeeaf2]" style={clubSoftAccentStyle(activeTeam.primaryColor)}>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-sm font-extrabold text-[#10233f]">{group.label}</p>
                    <p className="text-xs font-semibold text-[#6c5a73]">{formatFixtureDate(group.date)}</p>
                  </div>
                  <Badge variant="muted">{group.results.length} matches</Badge>
                </div>
                <div className="space-y-2">
                  {group.results.map((result) => (
                    <ResultRow key={result.id} result={result} activeTeam={activeTeam} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : sortedResults.map((result) => (
          <ResultRow key={result.id} result={result} activeTeam={activeTeam} />
        ))}
        {sortedResults.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            No completed results are available for {scope === "club" ? activeTeam.name : `${activeTeam.season} ${activeTeam.league}`} yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultRow({ result, activeTeam }: { result: MatchResult; activeTeam: TeamContext }) {
  const homeWon = result.homeTeamScore > result.awayTeamScore;
  const awayWon = result.awayTeamScore > result.homeTeamScore;
  const activeTeamPlayed = result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name;
  const homeColors = teamColors(result.homeTeamName);
  const awayColors = teamColors(result.awayTeamName);

  return (
    <div
      key={result.id}
      className={cn(
        "overflow-hidden rounded-lg bg-white shadow-[0_8px_22px_rgba(16,35,63,0.06)] ring-1 ring-[#eeeaf2]",
        activeTeamPlayed && "ring-2 ring-offset-1 ring-offset-white"
      )}
      style={activeTeamPlayed ? { boxShadow: `0 0 0 2px ${activeTeam.primaryColor}22` } : undefined}
    >
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${homeColors.primaryColor}, ${awayColors.primaryColor})` }} />
      <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 p-3">
        <div className="min-w-0">
          <p className="break-words font-extrabold leading-tight" style={{ color: homeColors.primaryColor }}>{result.homeTeamName}</p>
          <p className="mt-1 text-xs font-semibold text-[#6c5a73]">{formatFixtureDate(result.fixtureDate)}</p>
        </div>
        <div className="grid grid-cols-[auto_auto_auto] items-center gap-1 rounded-lg bg-[#f7f5fa] px-2 py-1 ring-1 ring-[#eeeaf2]">
          <span className={cn("grid h-8 min-w-8 place-items-center rounded-md px-2 text-lg font-extrabold ring-1", scoreTone(result.homeTeamScore, result.awayTeamScore))}>
            {result.homeTeamScore}
          </span>
          <span className="text-xs font-bold text-[#6c5a73]">v</span>
          <span className={cn("grid h-8 min-w-8 place-items-center rounded-md px-2 text-lg font-extrabold ring-1", scoreTone(result.awayTeamScore, result.homeTeamScore))}>
            {result.awayTeamScore}
          </span>
        </div>
        <div className="min-w-0 text-right">
          <p className="break-words font-extrabold leading-tight" style={{ color: awayColors.primaryColor }}>{result.awayTeamName}</p>
          <p className="mt-1 text-xs font-semibold text-[#6c5a73]">{homeWon ? "Home win" : awayWon ? "Away win" : "Draw"}</p>
        </div>
      </div>
    </div>
  );
}

function teamResultFor(activeTeam: TeamContext, result: MatchResult) {
  const home = result.homeTeamName === activeTeam.name;
  const away = result.awayTeamName === activeTeam.name;
  if (!home && !away) return null;

  const teamScore = home ? result.homeTeamScore : result.awayTeamScore;
  const opponentScore = home ? result.awayTeamScore : result.homeTeamScore;
  const opponentName = home ? result.awayTeamName : result.homeTeamName;

  return {
    opponentName,
    teamScore,
    opponentScore,
    venueLabel: home ? "Home" : "Away",
    result: teamScore > opponentScore ? "Won" : teamScore < opponentScore ? "Lost" : "Draw"
  };
}

function TeamRecentFormCard({ activeTeam, matchResults }: { activeTeam: TeamContext; matchResults: MatchResult[] }) {
  const visibleRecentResults = matchResults
    .filter((result) => result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name)
    .sort((a, b) => b.fixtureDate.localeCompare(a.fixtureDate))
    .slice(0, RECENT_FORM_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Team Form</CardTitle>
        <Badge variant="cyan">Last {RECENT_FORM_LIMIT}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleRecentResults.map((fixture) => {
          const teamResult = teamResultFor(activeTeam, fixture);
          if (!teamResult) return null;

          return (
            <div key={fixture.id} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
              <div>
                <p className="font-black">{teamResult.opponentName}</p>
                <p className="text-xs font-semibold text-[#6c5a73]">{formatFixtureDate(fixture.fixtureDate)} - {teamResult.venueLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">{teamResult.teamScore}-{teamResult.opponentScore}</p>
                <Badge variant={teamResult.result === "Won" ? "green" : teamResult.result === "Lost" ? "red" : "muted"}>{teamResult.result}</Badge>
              </div>
            </div>
          );
        })}
        {visibleRecentResults.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            No completed results are available for {activeTeam.name} yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PersonalRecentFormCard({ playerGameResults }: { playerGameResults: PlayerGameResult[] }) {
  const visibleGames = playerGameResults.slice(0, RECENT_FORM_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Personal Form</CardTitle>
        <Badge variant="cyan">Last {RECENT_FORM_LIMIT}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleGames.map((game) => (
          <div key={game.gameId} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
            <div className="min-w-0">
              <p className="truncate font-black">v {game.opponentName}</p>
              <p className="truncate text-xs font-semibold text-[#6c5a73]">{game.sourceWeek} - Game {game.gameNumber}</p>
            </div>
            <Badge variant={game.result === "Won" ? "green" : "red"}>{game.result}</Badge>
          </div>
        ))}
        {visibleGames.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Your personal match history will appear here once your account is linked.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlayerGameResultsCard({ results }: { results: PlayerGameResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const wins = results.filter((result) => result.result === "Won").length;
  const losses = results.filter((result) => result.result === "Lost").length;
  const winRate = results.length ? Math.round((wins / results.length) * 100) : 0;
  const visibleResults = showAll ? results : results.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Individual Games</CardTitle>
        <Badge variant="cyan">{results.length ? `${winRate}% win rate` : "No games yet"}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleResults.map((game) => (
          <div key={game.gameId} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
            <div className="min-w-0">
              <p className="truncate font-black">v {game.opponentName}</p>
              <p className="truncate text-xs font-semibold text-[#6c5a73]">
                {game.sourceWeek} - Game {game.gameNumber} - {game.homeTeamName} {game.matchScore} {game.awayTeamName}
              </p>
            </div>
            <Badge variant={game.result === "Won" ? "green" : "red"}>{game.result}</Badge>
          </div>
        ))}
        {results.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Imported player game results will appear here once this account is linked to player history.
          </p>
        ) : null}
        {results.length ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <MiniStat label="Played" value={String(results.length)} />
            <MiniStat label="Won" value={String(wins)} />
            <MiniStat label="Lost" value={String(losses)} />
          </div>
        ) : null}
        {results.length > 6 ? (
          <Button variant="secondary" className="w-full" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show fewer games" : `Show all ${results.length} games`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TeamPositionStrip({ activeTeam }: { activeTeam: TeamContext }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;

  return (
    <Card className="md:self-start">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between rounded-[18px] p-4 text-white" style={clubAccentStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <div>
            <p className="text-xs font-extrabold uppercase">{hasLeagueTable ? "Team position" : "Table pending"}</p>
            <p className="text-lg font-black">{activeTeam.name}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black leading-none">{hasLeagueTable ? activeTeam.leaguePosition : "-"}</p>
            <p className="text-xs font-extrabold uppercase">{hasLeagueTable ? "Place" : "No matches yet"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerActionCard({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <section className="grid gap-4">
      <Card style={clubSoftAccentStyle(activeTeam.primaryColor)}>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <Badge variant="red">
            <Zap className="mr-1 h-3 w-3" />
            Live
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button className="w-full" style={{ backgroundColor: activeTeam.primaryColor }}>
            <ClipboardCheck className="h-4 w-4" />
            Review results
          </Button>
          <Button variant="dark" className="w-full">
            <Mail className="h-4 w-4" />
            Message squad
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

type ManagerLineupSlot = {
  slotNumber: number;
  gameType: "Singles" | "Doubles";
  label: string;
  player1Id: string;
  player1Name?: string;
  player2Id: string;
  player2Name?: string;
};

type ManagerLineupGame = {
  id: string;
  game_number: number;
  game_type: "Singles" | "Doubles";
  points_awarded: number;
  winner_team_id: string | null;
  home_player_1_name: string;
  home_player_2_name: string | null;
  away_player_1_name: string;
  away_player_2_name: string | null;
};

type ManagerLineupPayload = {
  fixture: {
    id: string;
    fixtureDate: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    league: string;
    season: string;
    status: string;
  } | null;
  players: Array<{ id: string; name: string }>;
  lineup: { id?: string; status: "Draft" | "Published"; publishedAt?: string | null; slots: ManagerLineupSlot[] } | null;
  opponentStatus: { teamName: string; status: "Draft" | "Published"; publishedAt?: string | null } | null;
  opponentLineup: { teamName: string; status: "Draft" | "Published"; slots: ManagerLineupSlot[] } | null;
  canManage?: boolean;
  weekFixtures: Array<{
    id: string;
    fixtureDate: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    status: "Scheduled" | "Completed";
    matchId: string | null;
    homeTeamScore: number | null;
    awayTeamScore: number | null;
    homeLineupStatus: "Draft" | "Published" | null;
    awayLineupStatus: "Draft" | "Published" | null;
    games: ManagerLineupGame[];
  }>;
  games: ManagerLineupGame[];
};

type LineupPickerTarget = {
  slotNumber: number;
  key: "player1Id" | "player2Id";
  label: string;
} | null;

const defaultLineupSlots: ManagerLineupSlot[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1", player1Id: "", player2Id: "" },
  { slotNumber: 2, gameType: "Singles", label: "Singles 2", player1Id: "", player2Id: "" },
  { slotNumber: 3, gameType: "Doubles", label: "Doubles", player1Id: "", player2Id: "" },
  { slotNumber: 4, gameType: "Singles", label: "Singles 4", player1Id: "", player2Id: "" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5", player1Id: "", player2Id: "" },
  { slotNumber: 6, gameType: "Singles", label: "Singles 6", player1Id: "", player2Id: "" }
];

function ManagerLineupCard({ activeTeam, onDataRefresh }: { activeTeam: TeamContext; onDataRefresh?: () => void }) {
  const [payload, setPayload] = useState<ManagerLineupPayload | null>(null);
  const [slots, setSlots] = useState<ManagerLineupSlot[]>(defaultLineupSlots);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingGameIds, setPendingGameIds] = useState<Set<string>>(new Set());
  const [pickerTarget, setPickerTarget] = useState<LineupPickerTarget>(null);
  const [openedFixtureId, setOpenedFixtureId] = useState("");
  const dirtyDraftRef = useRef(false);
  const fixtureIdRef = useRef("");
  const matchSnapshotRef = useRef("");

  useEffect(() => {
    if (!activeTeam.teamId) return;
    let cancelled = false;
    let firstLoad = true;
    dirtyDraftRef.current = false;
    fixtureIdRef.current = "";
    matchSnapshotRef.current = "";

    async function loadLineup() {
      if (!activeTeam.teamId) return;
      if (firstLoad) setMessage("");
      try {
        const response = await fetch(`/api/manager/lineup?teamId=${encodeURIComponent(activeTeam.teamId)}`, { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Lineup unavailable.");
        setPayload(data);
        const fixtureId = data.fixture?.id ?? "";
        const fixtureChanged = fixtureId !== fixtureIdRef.current;
        const lineupStatus = data.lineup?.status ?? "Draft";
        if (fixtureChanged) {
          fixtureIdRef.current = fixtureId;
          dirtyDraftRef.current = false;
          setOpenedFixtureId("");
        }
        if (firstLoad || fixtureChanged || lineupStatus === "Published" || !dirtyDraftRef.current) {
          setSlots(data.lineup?.slots?.length ? data.lineup.slots : defaultLineupSlots);
        }
        const matchSnapshot = managerLineupSnapshot(data);
        if (!firstLoad && matchSnapshotRef.current && matchSnapshotRef.current !== matchSnapshot) {
          onDataRefresh?.();
        }
        matchSnapshotRef.current = matchSnapshot;
      } catch (error) {
        if (!cancelled && firstLoad) setMessage(error instanceof Error ? error.message : "Lineup unavailable.");
      } finally {
        firstLoad = false;
      }
    }

    loadLineup();
    const poll = window.setInterval(loadLineup, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [activeTeam.teamId]);

  function updateSlot(slotNumber: number, key: "player1Id" | "player2Id", value: string) {
    dirtyDraftRef.current = true;
    setSlots((current) => current.map((slot) => slot.slotNumber === slotNumber ? { ...slot, [key]: value } : slot));
  }

  function selectedPlayerIdsExcept(slotNumber?: number, key?: "player1Id" | "player2Id") {
    return new Set(
      slots.flatMap((slot) => {
        const ids = [];
        if (!(slot.slotNumber === slotNumber && key === "player1Id") && slot.player1Id) ids.push(slot.player1Id);
        if (!(slot.slotNumber === slotNumber && key === "player2Id") && slot.player2Id) ids.push(slot.player2Id);
        return ids;
      })
    );
  }

  async function submitLineup(action: "save" | "publish") {
    if (!activeTeam.teamId || !payload?.fixture) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          fixtureId: payload.fixture.id,
          action,
          slots
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save lineup.");
      dirtyDraftRef.current = false;
      setPayload(data);
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setMessage(action === "publish" ? "Lineup published. It will be shared once the match card is ready." : "Draft lineup saved privately.");
      onDataRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save lineup.");
    } finally {
      setBusy(false);
    }
  }

  const playerOptions = payload?.players ?? [];
  const ownStatus = payload?.lineup?.status ?? "Draft";
  const opponentName = payload?.fixture
    ? payload.fixture.homeTeamId === activeTeam.teamId ? payload.fixture.awayTeamName : payload.fixture.homeTeamName
    : "";
  const ownPublished = ownStatus === "Published";
  const opponentHasPublished = payload?.opponentStatus?.status === "Published";
  const canSeeOpponentLineup = ownStatus === "Published" && opponentHasPublished;
  const matchReady = Boolean(payload?.games.length);
  const selectedCount = selectedPlayerIdsExcept().size;
  const fixtureOpen = Boolean(payload?.fixture && openedFixtureId === payload.fixture.id);
  const weekFixtures = payload?.weekFixtures?.length ? payload.weekFixtures : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Matches</CardTitle>
        <Badge variant={matchReady ? "green" : ownStatus === "Published" ? "cyan" : payload?.lineup?.id ? "muted" : "muted"}>
          {matchReady ? "Score ready" : ownStatus === "Published" ? "Published" : payload?.lineup?.id ? "Picked" : "Plan"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!payload?.fixture ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            No scheduled fixture is available for {activeTeam.name}. When the next fixture is scheduled, lineup selection will appear here.
          </p>
        ) : (
          <>
            <div className="rounded-xl bg-[#f7f5fa] p-2">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">This week</p>
                  <p className="text-sm font-bold text-[#10233f]">{formatFixtureDate(payload.fixture.fixtureDate)}</p>
                </div>
                <Badge variant="muted">{weekFixtures.length || 1} matches</Badge>
              </div>
              <div className="grid gap-2">
                {(weekFixtures.length ? weekFixtures : [{
                  id: payload.fixture.id,
                  fixtureDate: payload.fixture.fixtureDate,
                  homeTeamId: payload.fixture.homeTeamId,
                  awayTeamId: payload.fixture.awayTeamId,
                  homeTeamName: payload.fixture.homeTeamName,
                  awayTeamName: payload.fixture.awayTeamName,
                  status: payload.fixture.status as "Scheduled" | "Completed",
                  matchId: null,
                  homeTeamScore: null,
                  awayTeamScore: null,
                  homeLineupStatus: payload.fixture.homeTeamId === activeTeam.teamId ? ownStatus : payload.opponentStatus?.status ?? null,
                  awayLineupStatus: payload.fixture.awayTeamId === activeTeam.teamId ? ownStatus : payload.opponentStatus?.status ?? null,
                  games: []
                }]).map((fixture) => {
                  const isOwnFixture = fixture.homeTeamId === activeTeam.teamId || fixture.awayTeamId === activeTeam.teamId;
                  const bothPublished = fixture.homeLineupStatus === "Published" && fixture.awayLineupStatus === "Published";
                  const hasScore = fixture.homeTeamScore !== null && fixture.awayTeamScore !== null;
                  const matchStarted = Boolean(fixture.matchId);
                  const active = fixture.id === openedFixtureId;
                  const canManageFixture = Boolean(payload.canManage && isOwnFixture);
                  const actionLabel = active
                    ? "Close"
                    : canManageFixture
                      ? bothPublished ? "Enter scores" : "Pick team"
                      : "";

                  return (
                    <div
                      key={fixture.id}
                      className={cn(
                        "overflow-hidden rounded-lg bg-white ring-1 ring-[#eeeaf2]",
                        active && "ring-2"
                      )}
                      style={active ? { boxShadow: `0 0 0 2px ${activeTeam.primaryColor}22` } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenedFixtureId((current) => current === fixture.id ? "" : fixture.id)}
                        aria-expanded={active}
                        className={cn(
                          "grid w-full gap-2 p-3 text-left transition-colors hover:bg-[#f7f5fa]"
                        )}
                      >
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <FixtureTeamLabel teamName={fixture.homeTeamName} lineupStatus={matchStarted ? undefined : fixture.homeLineupStatus} />
                          <div className="text-center">
                            {hasScore ? (
                              <span className="grid min-w-16 grid-cols-[auto_auto_auto] items-center gap-1 rounded-lg bg-[#10233f] px-2 py-1 text-white">
                                <span className="font-black">{fixture.homeTeamScore}</span>
                                <span className="text-xs font-bold text-white/60">-</span>
                                <span className="font-black">{fixture.awayTeamScore}</span>
                              </span>
                            ) : (
                              <span className="text-xs font-black uppercase text-[#6c5a73]">v</span>
                            )}
                          </div>
                          <FixtureTeamLabel teamName={fixture.awayTeamName} align="right" lineupStatus={matchStarted ? undefined : fixture.awayLineupStatus} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {actionLabel ? (
                            <span className={cn(
                              "inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-extrabold uppercase tracking-wide",
                              canManageFixture && !bothPublished
                                ? "bg-[#1b8a72] text-white"
                                : "bg-[#10233f] text-white"
                            )}>
                              {actionLabel}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#6c5a73]">
                              {matchStarted ? "Lineups and frames available" : "Lineups appear when published"}
                            </span>
                          )}
                          <ChevronDown className={cn("h-4 w-4 text-[#6c5a73] transition-transform", active && "rotate-180")} />
                        </div>
                      </button>
                      {active ? (
                        <div className="grid gap-3 border-t border-[#eeeaf2] bg-white p-3">
                          {isOwnFixture && payload.opponentStatus ? (
                            <div className="rounded-xl bg-[#f7f5fa] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Opponent lineup</p>
                                  <p className="text-sm font-bold text-[#10233f]">
                                    {payload.opponentStatus.teamName} {opponentHasPublished ? "has published" : "is still drafting"}
                                  </p>
                                </div>
                                <Badge variant={opponentHasPublished ? "green" : "muted"}>{payload.opponentStatus.status}</Badge>
                              </div>
                              {opponentHasPublished && !canSeeOpponentLineup ? (
                                <p className="mt-2 text-xs font-semibold text-[#6c5a73]">
                                  Their player names unlock once you publish your lineup.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {isOwnFixture && matchReady ? <GeneratedMatchCard payload={payload} onRecord={recordGameWinner} pendingGameIds={pendingGameIds} /> : null}
                          {!isOwnFixture ? <ReadOnlyFixtureDetails fixture={fixture} /> : null}
                          {isOwnFixture && !ownPublished && payload.canManage ? (
                            <>
                              <div className="grid gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5fa] p-3">
                                  <div>
                                    <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Team sheet</p>
                                    <p className="text-sm font-bold text-[#10233f]">
                                      Tap each slot to pick a player for the fixed match order.
                                    </p>
                                  </div>
                                  <Badge variant="muted">{selectedCount}/7 picked</Badge>
                                </div>
                                {slots.map((slot) => (
                                  <LineupSlotRow
                                    key={slot.slotNumber}
                                    slot={slot}
                                    players={playerOptions}
                                    onPick={(key, label) => setPickerTarget({ slotNumber: slot.slotNumber, key, label })}
                                    onClear={(key) => updateSlot(slot.slotNumber, key, "")}
                                  />
                                ))}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Button variant="secondary" onClick={() => submitLineup("save")} disabled={busy}>
                                  Save draft
                                </Button>
                                <Button onClick={() => submitLineup("publish")} disabled={busy}>
                                  Publish lineup
                                </Button>
                              </div>
                            </>
                          ) : isOwnFixture && ownPublished ? (
                            <div className="rounded-xl bg-[#f7f5fa] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Your lineup</p>
                                  <p className="text-sm font-bold text-[#10233f]">
                                    Published and locked{matchReady ? ". Match card is ready." : ". Waiting for the opponent."}
                                  </p>
                                </div>
                                <Badge variant="green">Locked</Badge>
                              </div>
                            </div>
                          ) : null}
                          {isOwnFixture && ownPublished ? <PublishedLineupSummary title={`${activeTeam.name} published lineup`} slots={payload.lineup?.slots ?? slots} /> : null}
                          {isOwnFixture && payload.opponentLineup ? <PublishedLineupSummary title={`${payload.opponentLineup.teamName} lineup`} slots={payload.opponentLineup.slots} /> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {message ? <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">{message}</p> : null}
            {fixtureOpen && pickerTarget ? (
              <PlayerPickerSheet
                target={pickerTarget}
                players={playerOptions}
                value={slots.find((slot) => slot.slotNumber === pickerTarget.slotNumber)?.[pickerTarget.key] ?? ""}
                unavailablePlayerIds={selectedPlayerIdsExcept(pickerTarget.slotNumber, pickerTarget.key)}
                onSelect={(playerId) => {
                  updateSlot(pickerTarget.slotNumber, pickerTarget.key, playerId);
                  setPickerTarget(null);
                }}
                onClose={() => setPickerTarget(null)}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );

  async function recordGameWinner(gameId: string, winnerTeamId: string) {
    if (!activeTeam.teamId || !payload?.fixture) return;
    if (pendingGameIds.has(gameId)) return;
    const previousPayload = payload;
    setPendingGameIds((current) => new Set(current).add(gameId));
    setPayload(applyOptimisticGameWinner(payload, gameId, winnerTeamId));
    setMessage("");
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          fixtureId: payload.fixture.id,
          action: "recordResult",
          gameId,
          winnerTeamId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update result.");
      setPayload(data);
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setMessage("Game result updated.");
      onDataRefresh?.();
    } catch (error) {
      setPayload(previousPayload);
      setMessage(error instanceof Error ? error.message : "Could not update result.");
    } finally {
      setPendingGameIds((current) => {
        const next = new Set(current);
        next.delete(gameId);
        return next;
      });
    }
  }
}

function FixtureTeamLabel({ teamName, align = "left", lineupStatus }: { teamName: string; align?: "left" | "right"; lineupStatus?: "Draft" | "Published" | null }) {
  const colors = teamColors(teamName);

  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", align === "right" && "justify-end")}>
        <p className="break-words text-sm font-black leading-tight" style={{ color: colors.primaryColor }}>
          {teamName}
        </p>
        {lineupStatus !== undefined ? (
          <Badge variant={lineupStatusVariant(lineupStatus)}>{lineupStatusLabel(lineupStatus)}</Badge>
        ) : null}
      </div>
    </div>
  );
}

function lineupStatusLabel(status: "Draft" | "Published" | null) {
  if (status === "Published") return "Published";
  if (status === "Draft") return "Picked";
  return "Not picked";
}

function lineupStatusVariant(status: "Draft" | "Published" | null): "green" | "cyan" | "muted" {
  if (status === "Published") return "green";
  if (status === "Draft") return "cyan";
  return "muted";
}

function managerLineupSnapshot(payload: Partial<ManagerLineupPayload>) {
  return JSON.stringify({
    fixture: payload.fixture ? {
      id: payload.fixture.id,
      status: payload.fixture.status
    } : null,
    lineup: payload.lineup?.status ?? null,
    opponent: payload.opponentStatus?.status ?? null,
    games: (payload.games ?? []).map((game) => [game.id, game.winner_team_id]),
    weekFixtures: (payload.weekFixtures ?? []).map((fixture) => [
      fixture.id,
      fixture.status,
      fixture.matchId,
      fixture.homeTeamScore,
      fixture.awayTeamScore,
      fixture.homeLineupStatus,
      fixture.awayLineupStatus
    ])
  });
}

function applyOptimisticGameWinner(payload: ManagerLineupPayload, gameId: string, winnerTeamId: string): ManagerLineupPayload {
  const fixture = payload.fixture;
  if (!fixture) return payload;

  const games = payload.games.map((game) => (
    game.id === gameId ? { ...game, winner_team_id: winnerTeamId } : game
  ));
  const homeTeamScore = games.reduce((total, game) => total + (game.winner_team_id === fixture.homeTeamId ? game.points_awarded : 0), 0);
  const awayTeamScore = games.reduce((total, game) => total + (game.winner_team_id === fixture.awayTeamId ? game.points_awarded : 0), 0);
  const completed = games.length === 6 && games.every((game) => game.winner_team_id);

  return {
    ...payload,
    fixture: {
      ...fixture,
      status: completed ? "Completed" : fixture.status
    },
    games,
    weekFixtures: payload.weekFixtures.map((weekFixture) => (
      weekFixture.id === fixture.id
        ? {
            ...weekFixture,
            status: completed ? "Completed" : weekFixture.status,
            homeTeamScore,
            awayTeamScore,
            games: weekFixture.games.map((game) => (
              game.id === gameId ? { ...game, winner_team_id: winnerTeamId } : game
            ))
          }
        : weekFixture
    ))
  };
}

function LineupSlotRow({
  slot,
  players,
  onPick,
  onClear
}: {
  slot: ManagerLineupSlot;
  players: Array<{ id: string; name: string }>;
  onPick: (key: "player1Id" | "player2Id", label: string) => void;
  onClear: (key: "player1Id" | "player2Id") => void;
}) {
  const playerName = (playerId: string) => players.find((player) => player.id === playerId)?.name ?? "";

  return (
    <div className="grid gap-3 rounded-xl border border-[#eeeaf2] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase text-[#6c5a73]">Game {slot.slotNumber}</p>
          <p className="font-black text-[#10233f]">{slot.label}</p>
        </div>
        <Badge variant={slot.gameType === "Doubles" ? "cyan" : "muted"}>{slot.gameType === "Doubles" ? "2 pts" : "1 pt"}</Badge>
      </div>
      <div className={cn("grid gap-2", slot.gameType === "Doubles" ? "sm:grid-cols-2" : "")}>
        <PlayerSlotButton
          label={slot.gameType === "Doubles" ? "Player 1" : "Player"}
          value={playerName(slot.player1Id)}
          onPick={() => onPick("player1Id", `${slot.label} ${slot.gameType === "Doubles" ? "Player 1" : "Player"}`)}
          onClear={() => onClear("player1Id")}
        />
        {slot.gameType === "Doubles" ? (
          <PlayerSlotButton
            label="Player 2"
            value={playerName(slot.player2Id)}
            onPick={() => onPick("player2Id", `${slot.label} Player 2`)}
            onClear={() => onClear("player2Id")}
          />
        ) : null}
      </div>
    </div>
  );
}

function PlayerSlotButton({ label, value, onPick, onClear }: { label: string; value: string; onPick: () => void; onClear: () => void }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-bold uppercase text-[#6c5a73]">{label}</p>
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[#d8d3df] bg-[#f7f5fa] p-2">
        <button
          type="button"
          className="min-h-10 min-w-0 flex-1 rounded-lg bg-white px-3 text-left text-sm font-bold text-[#10233f] shadow-sm transition-colors hover:bg-[#eef7f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
          onClick={onPick}
        >
          {value || "Pick player"}
        </button>
        {value ? (
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#6c5a73] transition-colors hover:bg-[#eeeaf2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
            onClick={onClear}
            aria-label={`Clear ${value}`}
          >
            <XCircle className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PlayerPickerSheet({
  target,
  players,
  value,
  unavailablePlayerIds,
  onSelect,
  onClose
}: {
  target: NonNullable<LineupPickerTarget>;
  players: Array<{ id: string; name: string }>;
  value: string;
  unavailablePlayerIds: Set<string>;
  onSelect: (playerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#071426]/50 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Pick player for ${target.label}`}>
      <div className="mx-auto grid max-h-[82vh] w-full max-w-lg gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Pick player</p>
            <h3 className="text-lg font-black text-[#10233f]">{target.label}</h3>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg bg-[#f7f5fa] text-[#10233f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
            onClick={onClose}
            aria-label="Close player picker"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto pr-1">
          <div className="grid gap-2">
            {value ? (
              <button
                type="button"
                className="min-h-11 rounded-xl border border-[#eeeaf2] bg-[#f7f5fa] px-3 text-left text-sm font-bold text-[#10233f]"
                onClick={() => onSelect("")}
              >
                Clear this slot
              </button>
            ) : null}
            {players.map((player) => {
              const selected = player.id === value;
              const unavailable = !selected && unavailablePlayerIds.has(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]",
                    selected
                      ? "border-[#1b8a72] bg-[#e9f7f3] text-[#10233f]"
                      : unavailable
                        ? "border-[#eeeaf2] bg-[#f7f5fa] text-[#8a7d91] opacity-70"
                        : "border-[#eeeaf2] bg-white text-[#10233f] hover:bg-[#eef7f5]"
                  )}
                  onClick={() => {
                    if (!unavailable) onSelect(player.id);
                  }}
                  disabled={unavailable}
                >
                  <span>{player.name}</span>
                  <span className="text-xs font-extrabold uppercase text-[#6c5a73]">
                    {selected ? "Selected" : unavailable ? "Picked" : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishedLineupSummary({ title, slots }: { title: string; slots: ManagerLineupSlot[] }) {
  return (
    <div className="rounded-xl bg-[#f7f5fa] p-3">
      <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{title}</p>
      <div className="mt-2 grid gap-1">
        {slots.map((slot) => (
          <p key={slot.slotNumber} className="text-sm font-bold text-[#10233f]">
            {slot.label}: {slot.player1Name || "TBC"}{slot.player2Name ? ` / ${slot.player2Name}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyFixtureDetails({ fixture }: { fixture: ManagerLineupPayload["weekFixtures"][number] }) {
  if (!fixture.games.length) {
    return (
      <div className="rounded-xl bg-[#f7f5fa] p-3">
        <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Match details</p>
        <p className="mt-1 text-sm font-bold text-[#10233f]">
          Lineups and frame details will appear here once both teams have published.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#10233f] p-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase text-white/60">Frame details</p>
        <Badge variant={fixture.status === "Completed" ? "green" : "cyan"}>
          {fixture.status === "Completed" ? "Final" : "Live"}
        </Badge>
      </div>
      <div className="mt-2 grid gap-2">
        {fixture.games.map((game) => {
          const homeWon = game.winner_team_id === fixture.homeTeamId;
          const awayWon = game.winner_team_id === fixture.awayTeamId;
          return (
            <div key={game.id} className="grid gap-2 rounded-lg bg-white/10 p-2 text-sm font-bold">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Game {game.game_number}</span>
                <span className="text-xs text-white/60">{game.game_type} - {game.points_awarded} pts</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <p className={cn("rounded-lg px-2 py-1", homeWon ? "bg-[#00ff85] text-[#10233f]" : "bg-white/10")}>
                  {game.home_player_1_name}{game.home_player_2_name ? ` / ${game.home_player_2_name}` : ""}
                </p>
                <span className="text-center text-xs font-black uppercase text-white/60">v</span>
                <p className={cn("rounded-lg px-2 py-1 sm:text-right", awayWon ? "bg-[#00ff85] text-[#10233f]" : "bg-white/10")}>
                  {game.away_player_1_name}{game.away_player_2_name ? ` / ${game.away_player_2_name}` : ""}
                </p>
              </div>
              {!game.winner_team_id ? <p className="text-xs font-semibold text-white/60">Awaiting result</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeneratedMatchCard({ payload, onRecord, pendingGameIds }: { payload: ManagerLineupPayload; onRecord: (gameId: string, winnerTeamId: string) => void; pendingGameIds: Set<string> }) {
  const games = payload.games;
  const fixture = payload.fixture;
  if (!fixture) return null;

  return (
    <div className="rounded-xl bg-[#10233f] p-3 text-white">
      <p className="text-xs font-extrabold uppercase text-white/60">Match card generated</p>
      <div className="mt-2 grid gap-2">
        {games.map((game) => (
          <div key={game.id} className="grid gap-2 rounded-lg bg-white/10 p-2 text-sm font-bold">
            <div>
              Game {game.game_number}: {game.home_player_1_name}{game.home_player_2_name ? ` / ${game.home_player_2_name}` : ""} v {game.away_player_1_name}{game.away_player_2_name ? ` / ${game.away_player_2_name}` : ""} ({game.points_awarded} pts)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="sm" disabled={pendingGameIds.has(game.id)} variant={game.winner_team_id === fixture.homeTeamId ? "default" : "secondary"} onClick={() => onRecord(game.id, fixture.homeTeamId)}>
                {pendingGameIds.has(game.id) && game.winner_team_id === fixture.homeTeamId ? "Updating..." : `${fixture.homeTeamName} won`}
              </Button>
              <Button size="sm" disabled={pendingGameIds.has(game.id)} variant={game.winner_team_id === fixture.awayTeamId ? "default" : "secondary"} onClick={() => onRecord(game.id, fixture.awayTeamId)}>
                {pendingGameIds.has(game.id) && game.winner_team_id === fixture.awayTeamId ? "Updating..." : `${fixture.awayTeamName} won`}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadManagementCard({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Squad</CardTitle>
        <Badge variant="muted">{activeTeam.role}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Team context</p>
          <p className="mt-1 font-black">{activeTeam.name}</p>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">
            Player availability, squad form and selection tools will be scoped to this team.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="League" value={activeTeam.league} />
          <MiniStat label="Season" value={activeTeam.season} />
        </div>
      </CardContent>
    </Card>
  );
}

function LatestTeamResultCard({ activeTeam, matchResults }: { activeTeam: TeamContext; matchResults: MatchResult[] }) {
  const latestResult = [...matchResults]
    .filter((result) => result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name)
    .sort((a, b) => b.fixtureDate.localeCompare(a.fixtureDate))[0];

  if (!latestResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest Result</CardTitle>
          <Badge variant="muted">{activeTeam.name}</Badge>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            No completed result is available for {activeTeam.name} yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const teamResult = teamResultFor(activeTeam, latestResult);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Result</CardTitle>
        <Badge variant={teamResult?.result === "Won" ? "green" : teamResult?.result === "Lost" ? "red" : "muted"}>
          {teamResult?.result ?? "Final"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <ScoreRow team={latestResult.homeTeamName} score={String(latestResult.homeTeamScore)} winner={latestResult.homeTeamScore > latestResult.awayTeamScore} />
          <ScoreRow team={latestResult.awayTeamName} score={String(latestResult.awayTeamScore)} winner={latestResult.awayTeamScore > latestResult.homeTeamScore} />
          <div className="mt-3 rounded-xl bg-white/10 p-3">
            <p className="text-xs font-extrabold uppercase text-white/65">Played</p>
            <p className="mt-1 font-black">{formatFixtureDate(latestResult.fixtureDate)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCard({ activeTeam = teamContexts[0] }: { activeTeam?: TeamContext }) {
  const opponent = activeTeam.name === "Castle A" ? "Elm Park A" : "Castle A";
  const teamScore = activeTeam.name === "Castle A" ? "4" : activeTeam.leaguePosition <= 3 ? "5" : "3";
  const opponentScore = activeTeam.name === "Castle A" ? "3" : activeTeam.leaguePosition <= 3 ? "2" : "4";
  const winner = Number(teamScore) >= Number(opponentScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Score</CardTitle>
        <Badge variant="muted">Completed</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <ScoreRow team={activeTeam.name} score={teamScore} winner={winner} />
          <ScoreRow team={opponent} score={opponentScore} winner={!winner} />
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

function ManagerSeasonSnapshot({ activeTeam = teamContexts[0], leagueTeamCount = standings.length }: { activeTeam?: TeamContext; leagueTeamCount?: number }) {
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);
  const playoffText = qualification === "final"
    ? `inside the ${activeTeam.league} direct final place`
    : qualification === "semi"
      ? `inside the ${activeTeam.league} semi-final places`
      : `outside the ${activeTeam.league} playoff places`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manager Snapshot</CardTitle>
        <Badge variant="muted">Regular season</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Won" value={String(activeTeam.matchesWon ?? "-")} />
          <MiniStat label="Lost" value={String(activeTeam.matchesLost ?? "-")} />
          <MiniStat label="Points for" value={String(activeTeam.pointsFor ?? "-")} />
          <MiniStat label="Points against" value={String(activeTeam.pointsAgainst ?? "-")} />
        </div>
        <div className="mt-3 rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Playoff line</p>
          <p className="mt-1 font-black">
            {activeTeam.name} finished {activeTeam.leaguePosition ? ordinal(activeTeam.leaguePosition) : "-"}, {playoffText}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeagueTable({ activeTeam, standingsData, matchResults = [] }: { activeTeam: TeamContext; standingsData?: Standing[]; matchResults?: MatchResult[] }) {
  const tableRows = standingsData ?? standings;
  const teamCount = tableRows.length;
  const showDirectFinal = teamCount >= 5 && teamCount <= 6;
  const showSemiFinals = teamCount >= 5;

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-2">
        <CardTitle>League Table</CardTitle>
        <div className="flex gap-2">
          {showDirectFinal ? <Badge variant="gold">Final</Badge> : null}
          {showSemiFinals ? <Badge variant="green">Semi</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        {tableRows.length === 0 ? (
          <div className="rounded-2xl bg-[#f7f5fa] p-4">
            <p className="text-sm font-extrabold text-[#10233f]">No league table yet</p>
            <p className="mt-1 text-sm font-semibold text-[#6c5a73]">
              {activeTeam.season} has no results or standings data yet.
            </p>
          </div>
        ) : (
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[12px] sm:text-[13px] 2xl:text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-[#6c5a73]">
              <tr>
                <th className="w-11 py-2 pr-1">Pos</th>
                <th className="px-1.5">Team</th>
                <th className="w-8 px-1 text-right">P</th>
                <th className="hidden w-8 px-1 text-right sm:table-cell">W</th>
                <th className="hidden w-8 px-1 text-right sm:table-cell">L</th>
                <th className="hidden w-14 px-1 text-center 2xl:table-cell">Form</th>
                <th className="w-11 px-1 text-right">Diff</th>
                <th className="w-11 px-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const active = row.team === activeTeam.name;
                const diff = row.pointsFor - row.pointsAgainst;
                const club = clubForTeam(row.team);
                const primaryColor = club?.primaryColor ?? "#10233f";
                const accentColor = club?.accentColor ?? primaryColor;
                const form = tableForm(row, matchResults);
                const qualification = qualificationStatus(row.position, teamCount);

                return (
                  <tr
                    key={row.team}
                    tabIndex={0}
                    className={cn(
                      "border-t outline-none transition-colors",
                      active ? "bg-[#f7f5fa]" : "hover:bg-[#f7f5fa]"
                    )}
                  >
                    <td className="border-t border-[#eeeaf2] py-3 pr-1">
                      <span
                        className={cn(
                          "inline-grid h-8 w-8 place-items-center rounded-lg text-xs font-extrabold",
                          qualification === "final"
                            ? "bg-[#ffb000] text-[#25002b]"
                            : qualification === "semi"
                              ? "bg-[#00ff85] text-[#25002b]"
                              : "bg-[#eeeaf2] text-[#25002b]"
                        )}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
                        <div className="min-w-0">
                          <p className="break-words font-extrabold leading-tight" style={{ color: primaryColor }}>{row.team}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase text-[#6c5a73] 2xl:hidden">{form}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-1 text-right font-bold">{row.played}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-1 text-right font-bold sm:table-cell">{row.won}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-1 text-right font-bold sm:table-cell">{row.lost}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-1 text-center 2xl:table-cell">
                      <span className="inline-flex rounded-md px-1.5 py-1 text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                        {form}
                      </span>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-1 text-right font-bold">{diff > 0 ? `+${diff}` : diff}</td>
                    <td className="border-t border-[#eeeaf2] px-1 text-right text-sm font-extrabold 2xl:text-base">{row.leaguePoints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClubTeamStructureCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Teams</CardTitle>
        <Badge variant="cyan">Reference</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {clubTeamStructure.map((club) => (
          <div key={club.club} className="rounded-xl bg-[#f7f5fa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ClubLogoTile club={club.club} logoPath={club.logoPath} size="compact" />
                <p className="font-extrabold leading-tight">{club.club}</p>
              </div>
              <Badge variant="muted">{club.teams.length}</Badge>
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={clubAccentStyle(club.primaryColor, club.accentColor)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {club.teams.map((team) => (
                <span key={team} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#10233f] ring-1 ring-[#eeeaf2]">
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
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xs font-bold uppercase text-white/65">{label}</p>
      <p className="mt-1 text-3xl font-extrabold leading-none text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl p-3", dark ? "bg-white/10" : "bg-[#f7f5fa]")}>
      <p className={cn("text-xs font-bold uppercase", dark ? "text-white/60" : "text-[#6c5a73]")}>{label}</p>
      <p className={cn("mt-1 truncate text-xl font-extrabold", dark ? "text-white" : "text-[#10233f]")}>{value}</p>
    </div>
  );
}

function BottomNav({ activePage, activeTeam, onNavigate, menuItems }: { activePage: AppPage; activeTeam: TeamContext; onNavigate: (page: AppPage) => void; menuItems: AppearanceMenuId[] }) {
  const configured = menuItems.map(menuEntry);
  const primaryItems = configured.length > 5 ? configured.slice(0, 4) : configured.slice(0, 5);
  const overflowItems = configured.slice(primaryItems.length);
  const items = overflowItems.length
    ? [...primaryItems, { label: "More", page: "Menu" as AppPage, icon: MenuIcon, description: "More options" }]
    : primaryItems;
  const morePages: AppPage[] = ["Menu", ...overflowItems.map((item) => item.page)];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eeeaf2] bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-elevated lg:hidden">
      <div className={cn("mx-auto grid max-w-md gap-1", items.length === 4 ? "grid-cols-4" : "grid-cols-5")}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.page === "Menu" ? morePages.includes(activePage) : activePage === item.page;

          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-bold leading-tight text-[#6c5a73]",
                active && "bg-[#10233f] text-white shadow-card"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
