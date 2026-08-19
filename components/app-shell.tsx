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

type AppPage = "Home" | "Fixtures" | "Match" | "Results" | "Table" | "Club" | "Bookings" | "Competitions" | "Players" | "Stats" | "Messages" | "Menu" | "Interclub Leagues";
type TeamSummaryUpdate = Partial<Pick<TeamContext, "leagueMatchesPlayed" | "matchesWon" | "matchesLost" | "pointsFor" | "pointsAgainst" | "leaguePoints">>;
const roleOptions: Role[] = ["Player", "Manager", "Assistant Manager", "Club Member", "Club Admin"];
const RECENT_FORM_LIMIT = 3;
const SIMULATION_CONTROLS_ENABLED = false;
const leagueOrder: TeamContext["league"][] = ["A League", "B League", "C League"];
const pagesWithLeagueAside: AppPage[] = ["Home", "Fixtures", "Results", "Players", "Stats"];

function isClubOnlyRole(role: Role) {
  return role === "Club Member" || role === "Club Admin";
}

const menuIconMap: Record<AppearanceMenuId | "Menu", typeof Home> = {
  Home,
  Fixtures: CalendarDays,
  Results: ClipboardCheck,
  Table: Trophy,
  Club: CalendarPlus,
  Bookings: CalendarPlus,
  Competitions: Trophy,
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
      const teamMatches = requestedTeam ? normalizeLookupKey(team.name) === normalizeLookupKey(requestedTeam) : true;
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
  const [activePage, setActivePage] = useState<AppPage>(() => {
    if (typeof window === "undefined") return "Home";
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    return requestedPage === "Competitions" ? "Competitions" : "Home";
  });
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [simulatedRole, setSimulatedRole] = useState<Role>(contexts[0]?.role ?? teamContexts[0].role);
  const [simulatedClub, setSimulatedClub] = useState(contexts[0]?.club ?? teamContexts[0].club);
  const [teamSummaryOverrides, setTeamSummaryOverrides] = useState<Record<string, TeamSummaryUpdate>>({});
  const [enteredCompetitionCount, setEnteredCompetitionCount] = useState(0);
  useEffect(() => {
    setTeamSummaryOverrides({});
  }, [contexts]);
  const visibleContexts = useMemo(
    () => contexts.filter((context) => context.season === selectedSeason || isClubOnlyRole(context.role)),
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
    if (!visibleContexts.some((team) => team.id === selectedId)) {
      setSelectedId(visibleContexts[0]?.id ?? preferredContextId);
    }
  }, [preferredContext.season, preferredContextId, visibleContexts, seasons, selectedId, selectedSeason]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if ((params.has("team") || params.has("role") || params.has("season")) && selectedId !== preferredContextId) {
      setSelectedSeason(preferredContext.season);
      setSelectedId(preferredContextId);
    }
  }, [preferredContext.season, preferredContextId, selectedId]);

  const realActiveTeam = useMemo(
    () => visibleContexts.find((team) => team.id === selectedId) ?? visibleContexts[0] ?? contexts[0] ?? teamContexts[0],
    [contexts, visibleContexts, selectedId]
  );
  useEffect(() => {
    setSimulatedRole(realActiveTeam.role);
    setSimulatedClub(realActiveTeam.club);
  }, [realActiveTeam.id, realActiveTeam.role, realActiveTeam.club]);

  const activeTeamBase = SIMULATION_CONTROLS_ENABLED
    ? buildSimulatedContext(realActiveTeam, simulatedRole, simulatedClub, standingsData)
    : realActiveTeam;
  const activeTeam = {
    ...activeTeamBase,
    ...(activeTeamBase.teamId ? teamSummaryOverrides[activeTeamBase.teamId] : undefined)
  };
  const updateTeamSummary = (teamId: string, summary: TeamSummaryUpdate) => {
    setTeamSummaryOverrides((current) => ({
      ...current,
      [teamId]: {
        ...current[teamId],
        ...summary
      }
    }));
  };
  const appearanceConfig = useMemo(() => normalizeAppearanceConfig(appearance ?? defaultAppearanceConfig), [appearance]);
  const activeAppearance = appearanceConfig[activeTeam.role] ?? defaultAppearanceConfig[activeTeam.role];
  useEffect(() => {
    let active = true;
    if (!isClubOnlyRole(activeTeam.role)) {
      setEnteredCompetitionCount(0);
      return () => {
        active = false;
      };
    }
    fetch("/api/competitions", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const entered = (data.competitions ?? []).filter((competition: CompetitionSummary) =>
          competition.isEntered && (competition.clubName === activeTeam.club || competition.canManage)
        );
        setEnteredCompetitionCount(entered.length);
      })
      .catch(() => {
        if (active) setEnteredCompetitionCount(0);
      });
    return () => {
      active = false;
    };
  }, [activeTeam.club, activeTeam.role]);
  const activeMenuItems = useMemo(() => {
    const configured = activeAppearance.menuItems;
    if (!isClubOnlyRole(activeTeam.role) || enteredCompetitionCount <= 0 || configured.includes("Competitions")) {
      return configured;
    }
    const bookingIndex = configured.indexOf("Bookings");
    const insertAt = bookingIndex >= 0 ? bookingIndex + 1 : Math.min(2, configured.length);
    return [...configured.slice(0, insertAt), "Competitions" as AppearanceMenuId, ...configured.slice(insertAt)];
  }, [activeAppearance.menuItems, activeTeam.role, enteredCompetitionCount]);
  const activeStandings = useMemo(() => {
    const filtered = standingsData.filter((row) => row.league === activeTeam.league && row.season === activeTeam.season);
    return filtered.length ? filtered : standingsData === standings ? standings : [];
  }, [activeTeam.league, activeTeam.season, standingsData]);
  const activeMatchResults = useMemo(
    () => (matchResults ?? []).filter((result) => result.league === activeTeam.league && result.season === activeTeam.season),
    [activeTeam.league, activeTeam.season, matchResults]
  );
  const activePlayerGameResults = useMemo(
    () => dedupePlayerGameResults(playerGameResults.filter((result) => {
      const seasonMatches = result.season === activeTeam.season;
      const leagueMatches = result.league === activeTeam.league;
      const teamMatches = result.homeTeamName === activeTeam.name || result.awayTeamName === activeTeam.name;
      return seasonMatches && leagueMatches && teamMatches;
    })),
    [activeTeam.league, activeTeam.name, activeTeam.season, playerGameResults]
  );
  const allMatchResults = matchResults ?? [];
  const clubOnlyView = isClubOnlyRole(activeTeam.role);
  const showLeaguePanels = !clubOnlyView && pagesWithLeagueAside.includes(activePage);
  const navigateToPage = (page: AppPage) => {
    if (page !== "Match") setSelectedFixtureId("");
    setActivePage(page);
  };
  const openFixturePage = (fixtureId: string) => {
    setSelectedFixtureId(fixtureId);
    setActivePage("Match");
  };

  useEffect(() => {
    onPageVisit?.(activePage, activeTeam);
  }, [activePage, activeTeam, onPageVisit]);

  return (
    <main className="min-h-screen overflow-x-hidden app-bg pb-24 text-[#10233f]">
      <Header
        activeTeam={activeTeam}
        contexts={visibleContexts.length ? visibleContexts : contexts}
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
        showSeasonSwitcher={!clubOnlyView}
      />
      <section className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:items-start lg:gap-6 lg:px-8 xl:px-10",
        showLeaguePanels ? "lg:grid-cols-[220px_minmax(0,1fr)_380px] xl:grid-cols-[230px_minmax(0,1fr)_400px]" : "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]"
      )}>
        <DesktopRail activeTeam={activeTeam} activePage={activePage} onNavigate={navigateToPage} menuItems={activeMenuItems} />
        <div className="grid gap-4">
          {clubOnlyView && activePage !== "Interclub Leagues" ? (
            <ClubMemberHero activeTeam={activeTeam} userLabel={userLabel} onNavigate={navigateToPage} />
          ) : (
            <MatchdayHero activeTeam={activeTeam} userLabel={userLabel} leagueTeamCount={activeStandings.length} interclubView={activePage === "Interclub Leagues"} activeMatchCount={activeMatchCount} onNavigate={navigateToPage} />
          )}
          <PageContent
            activePage={activePage}
            activeTeam={activeTeam}
            standingsData={activeStandings}
            allStandingsData={standingsData}
            playerGameResults={activePlayerGameResults}
            matchResults={activeMatchResults}
            allMatchResults={allMatchResults}
            appearance={{ ...activeAppearance, menuItems: activeMenuItems }}
            onNavigate={navigateToPage}
            onOpenFixture={openFixturePage}
            selectedFixtureId={selectedFixtureId}
            onSignOut={onSignOut}
            userLabel={userLabel}
            onDataRefresh={onDataRefresh}
            onTeamSummaryUpdate={updateTeamSummary}
          />
        </div>
        {showLeaguePanels ? (
          <aside className="grid gap-4 lg:content-start">
            {activePage !== "Table" ? <LeagueTable activeTeam={activeTeam} standingsData={activeStandings} matchResults={activeMatchResults} /> : null}
          </aside>
        ) : null}
      </section>
      <BottomNav activePage={activePage} activeTeam={activeTeam} onNavigate={navigateToPage} menuItems={activeMenuItems} />
    </main>
  );
}

function normalizeLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function buildSimulatedContext(baseTeam: TeamContext, role: Role, clubName: string, tableRows: Standing[]): TeamContext {
  const club = clubTeamStructure.find((entry) => entry.club === clubName) ?? clubTeamStructure[0];
  const baseSuffix = baseTeam.name.match(/\b([ABC])$/)?.[1] ?? "A";
  const suffix = role === "Manager" || role === "Assistant Manager" ? "A" : baseSuffix;
  const preferredTeam = club.teams.find((team) => team.endsWith(` ${suffix}`)) ?? club.teams[0] ?? club.club;
  const standing = tableRows.find((row) => row.team === preferredTeam && row.league === baseTeam.league && row.season === baseTeam.season)
    ?? tableRows.find((row) => row.team === preferredTeam);
  const clubMember = isClubOnlyRole(role);

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
  onOpenFixture,
  selectedFixtureId,
  onSignOut,
  userLabel,
  onDataRefresh,
  onTeamSummaryUpdate
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
  onOpenFixture: (fixtureId: string) => void;
  selectedFixtureId: string;
  onSignOut?: () => void;
  userLabel?: string;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const leagueTeamCount = standingsData.length;
  const memberRestrictedPages: AppPage[] = ["Fixtures", "Match", "Results", "Table", "Players", "Stats", "Interclub Leagues"];

  if (activeTeam.role === "Club Member" && memberRestrictedPages.includes(activePage)) {
    return <ClubMemberHome activeTeam={activeTeam} onNavigate={onNavigate} panels={appearance.panels} />;
  }

  if (activePage === "Club") return <ClubHubPage activeTeam={activeTeam} onNavigate={onNavigate} />;
  if (activePage === "Bookings") return <TableBookings activeTeam={activeTeam} />;
  if (activePage === "Competitions") return <CompetitionsPage activeTeam={activeTeam} />;
  if (activePage === "Fixtures") {
    return (
      <FixturesPage
        activeTeam={activeTeam}
        matchResults={matchResults}
        leagueTeamCount={leagueTeamCount}
        onOpenFixture={onOpenFixture}
        onDataRefresh={onDataRefresh}
        onTeamSummaryUpdate={onTeamSummaryUpdate}
      />
    );
  }
  if (activePage === "Match") {
    return (
      <MatchPage
        activeTeam={activeTeam}
        fixtureId={selectedFixtureId}
        onDataRefresh={onDataRefresh}
        onTeamSummaryUpdate={onTeamSummaryUpdate}
      />
    );
  }
  if (activePage === "Results") return <ResultsPage activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} />;
  if (activePage === "Table") return <LeagueTable activeTeam={activeTeam} standingsData={standingsData} matchResults={matchResults} />;
  if (activePage === "Players") return <PlayersPage activeTeam={activeTeam} playerGameResults={playerGameResults} />;
  if (activePage === "Stats") return <StatsPage activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} leagueTeamCount={leagueTeamCount} />;
  if (activePage === "Messages") return <MessagesPage activeTeam={activeTeam} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activePage === "Menu") return <MoreMenu activeTeam={activeTeam} menuItems={appearance.menuItems} onNavigate={onNavigate} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activePage === "Interclub Leagues") return <InterclubLeaguesPage activeTeam={activeTeam} standingsData={allStandingsData} matchResults={allMatchResults} onNavigate={onNavigate} />;
  if (activeTeam.role === "Manager") return <ManagerHome activeTeam={activeTeam} matchResults={matchResults} onNavigate={onNavigate} onOpenFixture={onOpenFixture} leagueTeamCount={leagueTeamCount} panels={appearance.panels} onDataRefresh={onDataRefresh} onTeamSummaryUpdate={onTeamSummaryUpdate} />;
  if (activeTeam.role === "Assistant Manager") return <AssistantManagerHome activeTeam={activeTeam} matchResults={matchResults} leagueTeamCount={leagueTeamCount} panels={appearance.panels} onNavigate={onNavigate} />;
  if (isClubOnlyRole(activeTeam.role)) return <ClubMemberHome activeTeam={activeTeam} onNavigate={onNavigate} panels={appearance.panels} />;
  return <PlayerHome activeTeam={activeTeam} standingsData={standingsData} playerGameResults={playerGameResults} matchResults={matchResults} onNavigate={onNavigate} onOpenFixture={onOpenFixture} leagueTeamCount={leagueTeamCount} panels={appearance.panels} />;
}

function dedupePlayerGameResults(results: PlayerGameResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.gameId)) return false;
    seen.add(result.gameId);
    return true;
  });
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
  onSignOut,
  showSeasonSwitcher = true
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
  showSeasonSwitcher?: boolean;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full overflow-hidden bg-[#10233f] px-4 py-3 text-white shadow-elevated sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1440px] gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.16)] ring-1 ring-white/25">
            <img src="/favicon.ico" alt="Interclub Snooker" className="h-full w-full rounded-lg object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-wide text-white/75">
              Interclub Snooker
            </p>
            <h1 className="truncate text-lg font-extrabold leading-tight">{isClubOnlyRole(activeTeam.role) ? activeTeam.club.replace(" Golf Club", "") : activeTeam.season}</h1>
            {userLabel ? (
              <p className="truncate text-xs font-bold text-white/70 sm:hidden">
                {userLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className={cn(
          "grid min-w-0 w-full gap-2",
          showSeasonSwitcher ? "sm:w-[390px] sm:grid-cols-[130px_minmax(0,1fr)]" : "sm:w-[270px]"
        )}>
          {showSeasonSwitcher ? <SeasonSwitcher seasons={seasons} selectedSeason={selectedSeason} onChange={onSeasonChange} /> : null}
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
        <div className="flex min-w-0 items-center gap-2 sm:w-auto">
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6] sm:hidden"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          ) : null}
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
  if (context.role === "Club Admin") return `${context.club.replace(" Golf Club", "")} - Club Admin`;
  return `${context.name} - ${context.role}`;
}

function contextDescription(context: TeamContext) {
  if (isClubOnlyRole(context.role)) return context.role === "Club Admin" ? "Club administration" : "Club access";
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
      <p className="text-xs font-bold uppercase text-white/60">{isClubOnlyRole(activeTeam.role) ? "Club" : "Competition"}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{isClubOnlyRole(activeTeam.role) ? activeTeam.club.replace(" Golf Club", "") : activeTeam.league}</h2>
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

function MatchdayHero({ activeTeam, userLabel, leagueTeamCount, interclubView = false, activeMatchCount = 0, onNavigate }: { activeTeam: TeamContext; userLabel?: string; leagueTeamCount: number; interclubView?: boolean; activeMatchCount?: number; onNavigate: (page: AppPage) => void }) {
  const manager = activeTeam.role === "Manager" || activeTeam.role === "Assistant Manager";
  const clubMember = isClubOnlyRole(activeTeam.role);
  const hasTeamActivity = teamHasActivity(activeTeam);
  const played = activeTeam.leagueMatchesPlayed ?? 0;
  const won = activeTeam.matchesWon ?? 0;
  const points = activeTeam.leaguePoints ?? activeTeam.pointsFor ?? 0;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);
  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-card">
      <div className="relative p-4 sm:p-5 xl:p-6" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        {activeMatchCount > 0 ? (
          <div
            className="absolute right-3 top-3 z-10 flex items-center gap-1"
            aria-label={`${activeMatchCount} ${activeMatchCount === 1 ? "match" : "matches"} in play`}
            title={`${activeMatchCount} ${activeMatchCount === 1 ? "match" : "matches"} in play`}
          >
            <span className="live-dot block h-3.5 w-3.5 rounded-full bg-[#00ff85] ring-2 ring-white/70" />
            {activeMatchCount > 1 ? (
              <span className="rounded-md bg-[#00ff85] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#10233f] ring-1 ring-white/40">
                {activeMatchCount}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] xl:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <ClubLogoTile club={activeTeam.club} logoPath={activeTeam.logoPath} size="hero" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan">{activeTeam.role}</Badge>
                <Badge variant="muted">{activeTeam.league}</Badge>
                <Badge variant={hasTeamActivity ? qualificationBadgeVariant(qualification) : "muted"}>
                  {hasTeamActivity ? `Position ${activeTeam.leaguePosition}` : "Table pending"}
                </Badge>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/70">
                {clubMember && interclubView ? "Interclub leagues" : activeTeam.role === "Club Admin" ? "Club admin home" : clubMember ? "Club member home" : manager ? "Manager home" : "Player home"}
              </p>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl xl:text-5xl">{activeTeam.name}</h2>
              <p className="mt-2 text-sm font-semibold text-white/80">{activeTeam.club}</p>
              {userLabel ? (
                <p className="mt-1 truncate text-xs font-bold text-white/65">
                  Signed in: {userLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
            <HeroMetric label="Played" value={hasTeamActivity ? String(played) : "-"} />
            <HeroMetric label="Matches Won" value={hasTeamActivity ? String(won) : "-"} />
            <HeroMetric label="Pts" value={hasTeamActivity ? String(points) : "-"} />
          </div>
        </div>
        <div className="relative mt-5 grid gap-2 min-[390px]:grid-cols-2 xl:max-w-[620px]">
          <Button className="w-full min-w-0" onClick={() => onNavigate(activeTeam.role === "Manager" ? "Fixtures" : activeTeam.role === "Club Admin" ? "Club" : activeTeam.role === "Club Member" ? "Bookings" : "Stats")}>
            <PlusCircle className="h-4 w-4" />
            {activeTeam.role === "Club Admin" ? "Admin tools" : clubMember ? "Book table" : activeTeam.role === "Assistant Manager" ? "Support team" : manager ? "Enter result" : "View stats"}
          </Button>
          <Button variant="secondary" className="w-full min-w-0" onClick={() => onNavigate("Club")}>
            <CalendarPlus className="h-4 w-4" />
            Club
          </Button>
        </div>
      </div>
    </section>
  );
}

function teamHasActivity(team: TeamContext) {
  return Boolean(
    (team.leagueMatchesPlayed ?? 0) > 0 ||
    (team.matchesWon ?? 0) > 0 ||
    (team.matchesLost ?? 0) > 0 ||
    (team.pointsFor ?? 0) > 0 ||
    (team.pointsAgainst ?? 0) > 0 ||
    (team.leaguePoints ?? 0) > 0
  );
}

function ClubMemberHero({ activeTeam, userLabel, onNavigate }: { activeTeam: TeamContext; userLabel?: string; onNavigate: (page: AppPage) => void }) {
  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-card">
      <div className="relative p-4 sm:p-5 xl:p-6" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        <div className="relative flex min-w-0 items-start gap-3">
          <ClubLogoTile club={activeTeam.club} logoPath={activeTeam.logoPath} size="hero" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">{activeTeam.role}</Badge>
              <Badge variant="muted">Tables</Badge>
              <Badge variant="muted">{activeTeam.role === "Club Admin" ? "Admin" : "Competitions"}</Badge>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/70">{activeTeam.role === "Club Admin" ? "Club admin home" : "Club home"}</p>
            <h2 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl xl:text-5xl">{activeTeam.club}</h2>
            <p className="mt-2 text-sm font-semibold text-white/80">
              {activeTeam.role === "Club Admin"
                ? "Manage members, invites, club competitions and table bookings."
                : "Book tables and enter club competitions."}
            </p>
            {userLabel ? (
              <p className="mt-1 truncate text-xs font-bold text-white/65">
                Signed in: {userLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 xl:max-w-[620px]">
          <Button className="w-full" onClick={() => activeTeam.role === "Club Admin" ? window.location.assign("/admin") : onNavigate("Bookings")}>
            <CalendarPlus className="h-4 w-4" />
            {activeTeam.role === "Club Admin" ? "Open admin" : "Book table"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => onNavigate("Competitions")}>
            <Trophy className="h-4 w-4" />
            Competitions
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

function formatSignedNumber(value: number) {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
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
  const previousDateDisabled = bookingDate <= currentLocalDate;

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

  useEffect(() => {
    if (bookingDate < currentLocalDate) setBookingDate(currentLocalDate);
  }, [bookingDate, currentLocalDate]);

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
              <Button
                variant="secondary"
                size="icon"
                className="h-14 w-14 shrink-0"
                onClick={() => {
                  if (!previousDateDisabled) setBookingDate(isoDateFromOffset(bookingDate, -1));
                }}
                disabled={previousDateDisabled}
                aria-label="Previous day"
              >
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
                  min={currentLocalDate}
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
                {payload.slotHours.length ? payload.slotHours.map((hour) => {
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
                }) : (
                  <div className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold text-[#6c5a73]">
                    No bookable slots remain for this date.
                  </div>
                )}
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

type CompetitionSummary = {
  id: string;
  clubId: string | null;
  clubName: string;
  name: string;
  competitionType: "Handicap" | "Scratch";
  entryClosesAt: string;
  rules: string;
  status: string;
  entrantCount: number;
  isEntered: boolean;
  canManage: boolean;
  roundSettingsConfirmed: boolean;
  nextMatch: {
    id: string;
    roundName: string;
    playByDate: string;
    opponentName: string;
    status: string;
  } | null;
};

type CompetitionDetail = CompetitionSummary & {
  rounds: Array<{ id: string; roundNumber: number; name: string; framesToPlay: number; playByDate: string }>;
  entries: Array<{ id: string; clubMembershipId: string; personId: string; playerName: string; handicap: number | null; status: string }>;
  matches: Array<{
    id: string;
    roundName: string;
    roundNumber: number;
    framesToPlay: number;
    playByDate: string;
    matchNumber: number;
    player1Name: string;
    player1Handicap: number | null;
    player2Name: string;
    player2Handicap: number | null;
    player1Score: number | null;
    player2Score: number | null;
    status: string;
    canReport: boolean;
    isPlaceholder?: boolean;
  }>;
};

type CompetitionMembership = {
  club_membership_id: string;
  club_id: string;
  club_name: string;
  handicap: string | null;
};

function shortRoundName(roundName?: string | null) {
  const normalized = (roundName ?? "").toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("quarter")) return "F";
  if (normalized.includes("semi")) return "SF";
  if (normalized.includes("quarter")) return "QF";
  const roundOf = normalized.match(/round of\s+(\d+)/);
  if (roundOf?.[1]) return `R${roundOf[1]}`;
  const roundNumber = normalized.match(/round\s+(\d+)/);
  if (roundNumber?.[1]) return `${roundNumber[1]}R`;
  return roundName?.slice(0, 3).toUpperCase() ?? "";
}

function competitionStatusText(competition: CompetitionSummary) {
  if (!competition.isEntered) return competition.status === "Open" ? "Open for entry" : competition.status;
  if (competition.nextMatch) {
    return `${competition.nextMatch.roundName}: ${competition.nextMatch.opponentName}`;
  }
  if (competition.status === "Open") return "Entered - awaiting draw";
  if (competition.status === "Complete") return "Competition complete";
  return "Entered - next tie to be confirmed";
}

function competitionDateText(competition: CompetitionSummary) {
  if (competition.nextMatch) return `Play by ${formatFixtureDate(competition.nextMatch.playByDate)}`;
  if (competition.status === "Open") return `Entries close ${formatFixtureDate(competition.entryClosesAt)}`;
  return competition.status;
}

function CompetitionListItem({ competition, onNavigate }: { competition: CompetitionSummary; onNavigate: (page: AppPage) => void }) {
  const roundCode = competition.nextMatch?.roundName ? shortRoundName(competition.nextMatch.roundName) : "";
  return (
    <button
      type="button"
      onClick={() => onNavigate("Competitions")}
      className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2] transition hover:bg-[#eef3f5]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-extrabold leading-tight text-[#10233f]">{competition.name}</p>
          <p className="mt-1 text-xs font-bold text-[#6c5a73]">
            {competition.clubName} - {competition.competitionType}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {roundCode ? <Badge variant="cyan">{roundCode}</Badge> : null}
          <Badge variant={competition.isEntered ? "green" : competition.status === "Open" ? "cyan" : "muted"}>
            {competition.isEntered ? "Entered" : competition.status}
          </Badge>
        </div>
      </div>
      <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#eeeaf2]">
        <p className="text-sm font-bold text-[#10233f]">{competitionStatusText(competition)}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#6c5a73]">{competitionDateText(competition)}</p>
      </div>
    </button>
  );
}

function CompetitionPanel({ activeTeam, mode, onNavigate }: { activeTeam: TeamContext; mode: "open" | "mine" | "draws"; onNavigate: (page: AppPage) => void }) {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/competitions", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setCompetitions(data.competitions ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const clubCompetitions = competitions.filter((competition) => competition.clubName === activeTeam.club || competition.canManage);
  const enteredCompetitions = clubCompetitions.filter((competition) => competition.isEntered);
  const openCompetitions = clubCompetitions.filter((competition) => competition.status === "Open" && !competition.isEntered);
  const visible = mode === "mine"
    ? clubCompetitions.filter((competition) => competition.isEntered)
    : mode === "draws"
      ? clubCompetitions.filter((competition) => competition.status !== "Open" && competition.status !== "Draft")
      : clubCompetitions;
  const title = mode === "mine" ? "My Competitions" : mode === "draws" ? "Competition Draws" : "Competitions";
  const badge = `${visible.length}`;
  const hasItems = mode === "open" ? Boolean(enteredCompetitions.length || openCompetitions.length) : Boolean(visible.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="muted">{loading ? "Loading" : badge}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {mode === "open" ? (
          <>
            {enteredCompetitions.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">You are in</p>
                {enteredCompetitions.map((competition) => (
                  <CompetitionListItem key={competition.id} competition={competition} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
            {openCompetitions.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">Open to enter</p>
                {openCompetitions.map((competition) => (
                  <CompetitionListItem key={competition.id} competition={competition} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          visible.map((competition) => (
            <CompetitionListItem key={competition.id} competition={competition} onNavigate={onNavigate} />
          ))
        )}
        {!hasItems ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            {loading ? "Loading competitions..." : "No competitions to show yet."}
          </p>
        ) : null}
        <Button variant="dark" className="w-full" onClick={() => onNavigate("Competitions")}>
          <Trophy className="h-4 w-4" />
          Open competitions
        </Button>
      </CardContent>
    </Card>
  );
}

function selectedCompetitionFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("competition")?.trim() ?? "";
}

function CompetitionsPage({ activeTeam }: { activeTeam: TeamContext }) {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [memberships, setMemberships] = useState<CompetitionMembership[]>([]);
  const [selectedId, setSelectedId] = useState(selectedCompetitionFromUrl);
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmingEntryId, setConfirmingEntryId] = useState("");
  const [enteringId, setEnteringId] = useState("");

  async function loadCompetitions(nextSelectedId = selectedId) {
    setLoading(true);
    try {
      const response = await fetch("/api/competitions", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Competitions unavailable.");
      const nextCompetitions = data.competitions ?? [];
      setCompetitions(nextCompetitions);
      setMemberships(data.memberships ?? []);
      const requestedCompetitionId = selectedCompetitionFromUrl();
      const preferredId = nextSelectedId || requestedCompetitionId;
      const preferredIsVisible = preferredId
        ? nextCompetitions.some((competition: CompetitionSummary) => competition.id === preferredId)
        : false;
      const nextId = preferredIsVisible ? preferredId : nextCompetitions[0]?.id || "";
      setSelectedId(nextId);
      setDetail(null);
      if (nextId) {
        await loadDetail(nextId);
        if (preferredId && preferredId !== nextId) {
          setMessage("That competition is no longer available, so I opened the latest available competition.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Competitions unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(competitionId: string) {
    const response = await fetch(`/api/competitions/${competitionId}`, { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Competition unavailable.");
    setDetail(data.competition);
  }

  useEffect(() => {
    loadCompetitions();
  }, []);

  async function competitionAction(path: string, body: Record<string, unknown> = {}, competitionId = selectedId) {
    if (!competitionId) return false;
    try {
      const response = await fetch(`/api/competitions/${competitionId}${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update competition.");
      setDetail(data.competition);
      await loadCompetitions(competitionId);
      setMessage("Competition updated.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update competition.");
      return false;
    }
  }

  function membershipForCompetition(competition: CompetitionSummary | CompetitionDetail) {
    return memberships.find((membership) => membership.club_name === competition.clubName);
  }

  async function enterCompetition(competition: CompetitionSummary) {
    const membership = membershipForCompetition(competition);
    if (!membership) {
      setMessage(`You need to be a member of ${competition.clubName} to enter this competition.`);
      return;
    }
    setEnteringId(competition.id);
    try {
      const entered = await competitionAction("/entries", { clubMembershipId: membership.club_membership_id }, competition.id);
      if (entered) {
        setConfirmingEntryId("");
        setMessage(`You are entered in ${competition.name}.`);
      }
    } finally {
      setEnteringId("");
    }
  }

  const orderedCompetitions = [...competitions].sort((left, right) => Number(right.isEntered) - Number(left.isEntered));
  const enteredCompetitions = orderedCompetitions.filter((competition) => competition.isEntered);
  const enterableCompetitions = orderedCompetitions.filter((competition) => competition.status === "Open" && !competition.isEntered && Boolean(membershipForCompetition(competition)));
  const otherCompetitions = orderedCompetitions.filter((competition) => !competition.isEntered && !enterableCompetitions.some((enterable) => enterable.id === competition.id));

  return (
    <section className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Competitions</CardTitle>
            <Badge variant="cyan">{loading ? "Loading" : `${competitions.length}`}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            {message ? <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">{message}</p> : null}
            {[
              ["You are in", enteredCompetitions],
              ["Open to enter", enterableCompetitions],
              ["Other competitions", otherCompetitions]
            ].map(([sectionTitle, sectionCompetitions]) => (sectionCompetitions as CompetitionSummary[]).length ? (
              <div key={sectionTitle as string} className="grid gap-2">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">{sectionTitle as string}</p>
                {(sectionCompetitions as CompetitionSummary[]).map((competition) => {
              const selected = selectedId === competition.id;
              const membership = membershipForCompetition(competition);
              const canEnter = competition.status === "Open" && !competition.isEntered && Boolean(membership);
              const confirming = confirmingEntryId === competition.id;
              return (
                <article
                  key={competition.id}
                  className={cn("rounded-xl p-3 ring-1 ring-[#eeeaf2]", selected ? "bg-[#10233f] text-white" : "bg-white")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setSelectedId(competition.id);
                        await loadDetail(competition.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-black">{competition.name}</p>
                      <p className={cn("text-xs font-bold", selected ? "text-white/70" : "text-[#6c5a73]")}>
                        {competition.clubName} - {competition.competitionType} - closes {formatFixtureDate(competition.entryClosesAt)}
                      </p>
                      {competition.nextMatch ? (
                        <p className={cn("mt-1 text-sm font-semibold", selected ? "text-white/80" : "text-[#10233f]")}>
                          {competition.nextMatch.roundName}: {competition.nextMatch.opponentName} by {formatFixtureDate(competition.nextMatch.playByDate)}
                        </p>
                      ) : competition.isEntered ? (
                        <p className={cn("mt-1 text-sm font-semibold", selected ? "text-white/80" : "text-[#10233f]")}>
                          {competition.status === "Open" ? "Entered - awaiting draw" : "Entered - next tie to be confirmed"}
                        </p>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {competition.isEntered && competition.nextMatch?.roundName ? <Badge variant="cyan">{shortRoundName(competition.nextMatch.roundName)}</Badge> : null}
                      <Badge variant={competition.isEntered ? "green" : "muted"}>{competition.isEntered ? "Entered" : competition.status}</Badge>
                      {canEnter ? (
                        <Button size="sm" onClick={() => setConfirmingEntryId(competition.id)} disabled={enteringId === competition.id}>
                          <PlusCircle className="h-4 w-4" />
                          Enter
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {confirming ? (
                    <div className={cn("mt-3 grid gap-2 rounded-xl p-3 sm:grid-cols-[1fr_auto_auto]", selected ? "bg-white/10" : "bg-[#f7f5fa]")}>
                      <p className={cn("text-sm font-semibold", selected ? "text-white/80" : "text-[#6c5a73]")}>
                        Confirm entry into {competition.name}?
                      </p>
                      <Button size="sm" onClick={() => enterCompetition(competition)} disabled={enteringId === competition.id}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmingEntryId("")}>
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
                })}
              </div>
            ) : null)}
            {!competitions.length ? (
              <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-4 ring-1 ring-[#eeeaf2]">
                <p className="text-sm font-semibold text-[#6c5a73]">
                  {loading ? "Loading..." : "No competitions have been created yet."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {detail ? (
          <CompetitionDetailCard
            competition={detail}
            onResult={(matchId, player1Score, player2Score) => competitionAction(`/matches/${matchId}`, { player1Score, player2Score })}
          />
        ) : null}
    </section>
  );
}

function CompetitionDetailCard({
  competition,
  onResult
}: {
  competition: CompetitionDetail;
  onResult: (matchId: string, player1Score: number, player2Score: number) => Promise<boolean>;
}) {
  const [scoreMatch, setScoreMatch] = useState<CompetitionDetail["matches"][number] | null>(null);
  const drawHasRun = competition.matches.length > 0;
  const roundsWithMatches = competition.rounds.map((round) => ({
    ...round,
    matches: competition.matches.filter((match) => match.roundNumber === round.roundNumber)
  }));
  const roundFormatSummary = competition.rounds.map((round) => `${shortRoundName(round.name) || round.name}: best of ${round.framesToPlay}`).join(" / ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{competition.name}</CardTitle>
        <Badge variant={competition.competitionType === "Handicap" ? "cyan" : "muted"}>{competition.competitionType}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-sm font-bold text-[#10233f]">{competition.clubName}</p>
          <p className="text-xs font-semibold text-[#6c5a73]">Entries close {formatFixtureDate(competition.entryClosesAt)} - {competition.entrantCount} entrants</p>
          {drawHasRun && roundFormatSummary ? (
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#10233f] ring-1 ring-[#eeeaf2]">
              {roundFormatSummary}
            </p>
          ) : null}
          {competition.rules ? <p className="mt-2 text-sm font-semibold text-[#6c5a73]">{competition.rules}</p> : null}
        </div>
        {competition.status === "Open" ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Entries are open. Use the competition list above to enter; entrants will be hidden until the draw is made.
          </p>
        ) : null}
        {drawHasRun ? <div className="grid gap-3">
          {roundsWithMatches.map((round) => (
            <section key={round.id} className="rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[#10233f]">{round.name}</p>
                  <p className="text-xs font-semibold text-[#6c5a73]">Play by {formatFixtureDate(round.playByDate)}</p>
                </div>
                <Badge variant="muted">Best of {round.framesToPlay}</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {round.matches.map((match) => (
                  <CompetitionMatchResultRow key={match.id} competitionType={competition.competitionType} match={match} onOpenScore={setScoreMatch} />
                ))}
                {!round.matches.length ? (
                  <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#6c5a73]">Draw places will appear here once this round is known.</p>
                ) : null}
              </div>
            </section>
          ))}
        </div> : null}
        {scoreMatch ? (
          <CompetitionScoreModal
            match={scoreMatch}
            onCancel={() => setScoreMatch(null)}
            onSave={async (matchId, player1Score, player2Score) => {
              const saved = await onResult(matchId, player1Score, player2Score);
              if (saved) setScoreMatch(null);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function CompetitionMatchResultRow({
  match,
  competitionType,
  onOpenScore
}: {
  match: CompetitionDetail["matches"][number];
  competitionType: CompetitionSummary["competitionType"];
  onOpenScore: (match: CompetitionDetail["matches"][number]) => void;
}) {
  const completed = match.status === "Completed";
  const scoreText = match.player1Score !== null && match.player2Score !== null ? `${match.player1Score}-${match.player2Score}` : "";
  const showHandicap = competitionType === "Handicap";

  return (
    <div className={cn("rounded-lg bg-white px-3 py-2 ring-1 ring-[#eeeaf2]", match.isPlaceholder ? "text-[#6c5a73]" : "")}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase text-[#6c5a73]">Match {match.matchNumber}</p>
            <Badge variant={completed ? "green" : match.isPlaceholder ? "muted" : "cyan"}>
              {match.isPlaceholder ? "Pending" : completed && scoreText ? scoreText : match.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-black leading-tight text-[#10233f]">
            <CompetitionPlayerName name={match.player1Name} handicap={showHandicap ? match.player1Handicap : null} />
            <span className="text-[#6c5a73]">v</span>
            <CompetitionPlayerName name={match.player2Name} handicap={showHandicap ? match.player2Handicap : null} />
          </div>
        </div>
        {match.canReport && !match.isPlaceholder && match.status !== "Bye" ? (
          <Button size="sm" variant={completed ? "secondary" : "default"} onClick={() => onOpenScore(match)}>
            {completed ? "Edit score" : "Enter score"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CompetitionPlayerName({ name, handicap }: { name: string; handicap: number | null }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      <span>{name}</span>
      {handicap !== null ? (
        <span className="rounded-md bg-[#eef3f5] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#6c5a73]">
          Hcp {handicap}
        </span>
      ) : null}
    </span>
  );
}

function CompetitionScoreModal({
  match,
  onCancel,
  onSave
}: {
  match: CompetitionDetail["matches"][number];
  onCancel: () => void;
  onSave: (matchId: string, player1Score: number, player2Score: number) => Promise<void>;
}) {
  const winningScore = Math.max(1, Math.floor(match.framesToPlay / 2) + 1);
  const initialWinner = match.player1Score !== null && match.player2Score !== null
    ? match.player1Score > match.player2Score ? "p1" : "p2"
    : "";
  const initialLoserScore = match.player1Score !== null && match.player2Score !== null
    ? Math.min(match.player1Score, match.player2Score)
    : 0;
  const [winner, setWinner] = useState<"p1" | "p2" | "">(initialWinner);
  const [loserScore, setLoserScore] = useState(initialLoserScore);
  const [saving, setSaving] = useState(false);
  const canSave = Boolean(winner && loserScore >= 0 && loserScore < winningScore);
  const winnerName = winner === "p1" ? match.player1Name : winner === "p2" ? match.player2Name : "Select winner";
  const player1Score = winner === "p1" ? winningScore : loserScore;
  const player2Score = winner === "p2" ? winningScore : loserScore;

  async function saveResult() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(match.id, player1Score, player2Score);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/60 p-4" role="dialog" aria-modal="true" aria-label="Enter competition score">
      <div className="w-full max-w-md rounded-[18px] bg-white p-4 shadow-elevated ring-1 ring-[#eeeaf2]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#6c5a73]">{match.roundName} - Match {match.matchNumber}</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#10233f]">Enter score</h2>
          </div>
          <Badge variant="muted">Best of {match.framesToPlay}</Badge>
        </div>
        <div className="mt-4 grid gap-2">
          {([
            ["p1", match.player1Name],
            ["p2", match.player2Name]
          ] as const).map(([value, name]) => (
            <button
              key={value}
              type="button"
              onClick={() => setWinner(value)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-xl px-3 text-left font-extrabold ring-1 transition",
                winner === value ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-[#f7f5fa] text-[#10233f] ring-[#eeeaf2]"
              )}
            >
              <span>{name}</span>
              <span className={cn("text-xs font-bold uppercase", winner === value ? "text-white/70" : "text-[#6c5a73]")}>
                {winner === value ? "Winner" : "Tap to choose"}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
          <p className="text-xs font-bold uppercase text-[#6c5a73]">Frame score</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="rounded-xl bg-white p-3 text-center ring-1 ring-[#eeeaf2]">
              <p className="text-[10px] font-bold uppercase text-[#6c5a73]">{winnerName}</p>
              <p className="text-3xl font-extrabold text-[#10233f]">{winner ? winningScore : "-"}</p>
            </div>
            <span className="text-xl font-extrabold text-[#6c5a73]">-</span>
            <div className="rounded-xl bg-white p-3 text-center ring-1 ring-[#eeeaf2]">
              <p className="text-[10px] font-bold uppercase text-[#6c5a73]">Other player</p>
              <div className="mt-1 grid grid-cols-[40px_1fr_40px] items-center gap-2">
                <button
                  type="button"
                  className="grid h-10 place-items-center rounded-lg bg-[#eeeaf2] text-xl font-extrabold text-[#10233f]"
                  onClick={() => setLoserScore((score) => Math.max(0, score - 1))}
                  aria-label="Decrease losing score"
                >
                  -
                </button>
                <span className="text-3xl font-extrabold text-[#10233f]">{loserScore}</span>
                <button
                  type="button"
                  className="grid h-10 place-items-center rounded-lg bg-[#eeeaf2] text-xl font-extrabold text-[#10233f]"
                  onClick={() => setLoserScore((score) => Math.min(winningScore - 1, score + 1))}
                  aria-label="Increase losing score"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-bold text-[#6c5a73]">
            {winner ? `${match.player1Name} ${player1Score} - ${player2Score} ${match.player2Name}` : "Choose the winner first."}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveResult} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save result"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlayerHome({
  activeTeam,
  standingsData,
  playerGameResults,
  matchResults,
  onNavigate,
  onOpenFixture,
  leagueTeamCount,
  panels
}: {
  activeTeam: TeamContext;
  standingsData: Standing[];
  playerGameResults: PlayerGameResult[];
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
  onOpenFixture: (fixtureId: string) => void;
  leagueTeamCount: number;
  panels: AppearancePanelId[];
}) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} />;
    if (panel === "leagueTableSnapshot") return <HomeLeagueTableCard key={panel} activeTeam={activeTeam} standingsData={standingsData} onNavigate={onNavigate} />;
    if (panel === "myStats") return <PlayerStatCard key={panel} activeTeam={activeTeam} playerGameResults={playerGameResults} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "personalRecentForm") return <PersonalRecentFormCard key={panel} playerGameResults={playerGameResults} />;
    if (panel === "individualGames") return <PlayerGameResultsCard key={panel} results={playerGameResults} />;
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:gap-5">
      <div className="md:col-span-2">
        <FixtureWeekCarouselCard activeTeam={activeTeam} onOpenFixture={onOpenFixture} />
      </div>
      {panels.map(renderPanel)}
    </section>
  );
}

function ClubHubPage({ activeTeam, onNavigate }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="overflow-hidden md:col-span-2">
        <CardContent className="pt-4">
          <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
            <p className="text-xs font-extrabold uppercase text-white/65">Club</p>
            <h2 className="mt-1 text-3xl font-black leading-none">{activeTeam.club}</h2>
            <p className="mt-2 max-w-xl text-sm font-semibold text-white/75">
              Table bookings and club competitions live here, separate from interclub team duties.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Club Actions</CardTitle>
          <Badge variant="cyan">{activeTeam.club.replace(" Golf Club", "")}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button className="w-full" onClick={() => onNavigate("Bookings")} style={{ backgroundColor: activeTeam.primaryColor }}>
            <CalendarPlus className="h-4 w-4" />
            Book table
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => onNavigate("Competitions")}>
            <Trophy className="h-4 w-4" />
            Enter competitions
          </Button>
        </CardContent>
      </Card>
      <CompetitionPanel activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />
    </section>
  );
}

function ClubMemberHome({ activeTeam, onNavigate, panels }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; panels: AppearancePanelId[] }) {
  const compactPanels = useMemo(() => {
    if (activeTeam.role === "Club Member") {
      return panels.filter((panel) => panel === "openCompetitions");
    }
    if (activeTeam.role === "Club Admin") {
      return panels.filter((panel) => panel === "clubCompetitionAdmin" || panel === "openCompetitions" || panel === "interclubLeagues");
    }
    return panels;
  }, [activeTeam.role, panels]);

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
              Club members can book tables and enter competitions at their club.
            </p>
          </CardContent>
        </Card>
      );
    }
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "clubCompetitionAdmin") {
      return (
        <Card key={panel}>
          <CardHeader>
            <CardTitle>Club Admin</CardTitle>
            <Badge variant="green">{activeTeam.club.replace(" Golf Club", "")}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <a
              href="/admin?tab=invites"
              className="grid min-h-[74px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                <Users className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-black">Members & invites</span>
                <span className="block text-xs font-semibold text-[#6c5a73]">Add members and queue invite emails.</span>
              </span>
            </a>
            <a
              href="/admin?tab=competitions"
              className="grid min-h-[74px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                <Trophy className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-black">Competitions</span>
                <span className="block text-xs font-semibold text-[#6c5a73]">Create draws and manage results.</span>
              </span>
            </a>
            <button
              type="button"
              onClick={() => onNavigate("Bookings")}
              className="grid min-h-[74px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2] sm:col-span-2"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                <CalendarPlus className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-black">Table bookings</span>
                <span className="block text-xs font-semibold text-[#6c5a73]">See current and future table usage.</span>
              </span>
            </button>
          </CardContent>
        </Card>
      );
    }
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
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {compactPanels.map(renderPanel)}
    </section>
  );
}

function MemberActionsCard({ activeTeam, onNavigate }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void }) {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingCompetitions(true);
    fetch("/api/competitions", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setCompetitions(data.competitions ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingCompetitions(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam.club]);

  const clubCompetitions = competitions.filter((competition) => competition.clubName === activeTeam.club || competition.canManage);
  const enteredCompetitions = clubCompetitions.filter((competition) => competition.isEntered);
  const openCompetitions = clubCompetitions.filter((competition) => competition.status === "Open" && !competition.isEntered);

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
        {enteredCompetitions.length ? (
          <div className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase text-[#6c5a73]">Competitions you are in</p>
              <Badge variant="green">{enteredCompetitions.length}</Badge>
            </div>
            {enteredCompetitions.slice(0, 3).map((competition) => (
              <button
                key={competition.id}
                type="button"
                onClick={() => onNavigate("Competitions")}
                className="grid gap-1 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-[#eeeaf2]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-extrabold leading-tight text-[#10233f]">{competition.name}</p>
                  {competition.nextMatch?.roundName ? <Badge variant="cyan">{shortRoundName(competition.nextMatch.roundName)}</Badge> : null}
                </div>
                <p className="text-xs font-semibold text-[#6c5a73]">
                  {competition.nextMatch
                    ? `${competition.nextMatch.opponentName} - play by ${formatFixtureDate(competition.nextMatch.playByDate)}`
                    : competition.status === "Open"
                      ? "Entered - awaiting draw"
                      : "Next tie to be confirmed"}
                </p>
              </button>
            ))}
            {enteredCompetitions.length > 3 ? (
              <button type="button" onClick={() => onNavigate("Competitions")} className="text-left text-xs font-extrabold uppercase text-[#10233f]">
                View all competitions
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onNavigate("Competitions")}
          className="grid min-h-[68px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left ring-1 ring-[#eeeaf2]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
            <Trophy className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-black">Enter competitions</span>
            <span className="block text-xs font-semibold text-[#6c5a73]">
              {loadingCompetitions
                ? "Checking club competitions..."
                : openCompetitions.length
                  ? `${openCompetitions.length} open for entry`
                  : enteredCompetitions.length
                    ? "View draws, rounds and results"
                    : "Club draws and entries"}
            </span>
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
  const orderedLeagues = isClubOnlyRole(activeTeam.role)
    ? leagueOrder
    : [activeTeam.league, ...leagueOrder.filter((league) => league !== activeTeam.league)];

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Interclub Leagues</CardTitle>
          <Badge variant="muted">{isClubOnlyRole(activeTeam.role) ? "A to C" : `${activeTeam.league} first`}</Badge>
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
          name: isClubOnlyRole(activeTeam.role) ? activeTeam.club : activeTeam.name,
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

function FixturesPage({
  activeTeam,
  matchResults,
  leagueTeamCount,
  onOpenFixture,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  matchResults: MatchResult[];
  leagueTeamCount: number;
  onOpenFixture: (fixtureId: string) => void;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FixtureWeekCarouselCard
          activeTeam={activeTeam}
          onOpenFixture={onOpenFixture}
        />
      </div>
      <SeasonCompleteCard activeTeam={activeTeam} action="View results" leagueTeamCount={leagueTeamCount} />
      <TeamRecentFormCard activeTeam={activeTeam} matchResults={matchResults} />
    </section>
  );
}

function MatchPage({
  activeTeam,
  fixtureId,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  fixtureId: string;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const managerView = activeTeam.role === "Manager" || activeTeam.role === "Assistant Manager";

  return (
    <section className="grid gap-4">
      {fixtureId ? (
        managerView ? (
          <ManagerLineupCard
            activeTeam={activeTeam}
            preferredFixtureId={fixtureId}
            onDataRefresh={onDataRefresh}
            onTeamSummaryUpdate={onTeamSummaryUpdate}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Match</CardTitle>
              <Badge variant="muted">{activeTeam.league}</Badge>
            </CardHeader>
            <CardContent>
              <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
                Scores and frame details for this match will appear here as they are entered.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Match</CardTitle>
            <Badge variant="muted">No fixture selected</Badge>
          </CardHeader>
          <CardContent>
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              Choose a fixture from the weekly fixtures list.
            </p>
          </CardContent>
        </Card>
      )}
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
  const clubMember = isClubOnlyRole(activeTeam.role);

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

function ManagerHome({
  activeTeam,
  matchResults,
  onNavigate,
  onOpenFixture,
  leagueTeamCount,
  panels,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
  onOpenFixture: (fixtureId: string) => void;
  leagueTeamCount: number;
  panels: AppearancePanelId[];
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "matchPlanning") return null;
    if (panel === "managerActions") return <ManagerActionCard key={panel} activeTeam={activeTeam} />;
    if (panel === "seasonComplete") return <SeasonCompleteCard key={panel} activeTeam={activeTeam} action="Review season" leagueTeamCount={leagueTeamCount} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "squadManagement") return <SquadManagementCard key={panel} activeTeam={activeTeam} />;
    if (panel === "managerSnapshot") return <ManagerSeasonSnapshot key={panel} activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "clubCompetitionAdmin") return null;
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} />;
    if (panel === "messages") return <MessagesPage key={panel} activeTeam={activeTeam} compact />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <MatchPlanningCard
          activeTeam={activeTeam}
          onDataRefresh={onDataRefresh}
          onTeamSummaryUpdate={onTeamSummaryUpdate}
          onOpenFixture={onOpenFixture}
        />
      </div>
      {panels.map(renderPanel)}
    </section>
  );
}

function MatchPlanningCard({
  activeTeam,
  onDataRefresh,
  onTeamSummaryUpdate,
  onOpenFixture
}: {
  activeTeam: TeamContext;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
  onOpenFixture?: (fixtureId: string) => void;
}) {
  return (
    <div className="grid gap-4 md:col-span-2">
      <FixtureWeekCarouselCard
        activeTeam={activeTeam}
        onOpenFixture={onOpenFixture}
      />
    </div>
  );
}

function AssistantManagerHome({ activeTeam, matchResults, leagueTeamCount, panels, onNavigate }: { activeTeam: TeamContext; matchResults: MatchResult[]; leagueTeamCount: number; panels: AppearancePanelId[]; onNavigate: (page: AppPage) => void }) {
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
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "clubCompetitionAdmin") return null;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {panels.map(renderPanel)}
    </section>
  );
}

function TeamStatsCard({ activeTeam, onNavigate, leagueTeamCount }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; leagueTeamCount: number }) {
  const hasLeagueTable = teamHasActivity(activeTeam);
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

function HomeLeagueTableCard({ activeTeam, standingsData, onNavigate }: { activeTeam: TeamContext; standingsData: Standing[]; onNavigate: (page: AppPage) => void }) {
  const rows = standingsData.length ? standingsData : standings.filter((row) => row.league === activeTeam.league && row.season === activeTeam.season);

  return (
    <Card className="overflow-hidden md:col-span-2">
      <CardHeader>
        <CardTitle>My League Table</CardTitle>
        <Badge variant="muted">{activeTeam.league}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="overflow-hidden rounded-xl ring-1 ring-[#eeeaf2]">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px_56px_56px] gap-2 bg-[#f7f5fa] px-3 py-2 text-[11px] font-extrabold uppercase text-[#6c5a73]">
            <span>Pos</span>
            <span>Team</span>
            <span className="text-right">P</span>
            <span className="text-right">Diff</span>
            <span className="text-right">Pts</span>
          </div>
          {rows.map((row) => {
            const active = row.team === activeTeam.name;
            return (
              <div
                key={`${row.season}-${row.league}-${row.team}`}
                className={cn(
                  "grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px_56px_56px] items-center gap-2 border-t border-[#eeeaf2] px-3 py-2 text-sm font-extrabold",
                  active ? "bg-[#eef7f5]" : "bg-white"
                )}
                style={active ? { borderLeft: `5px solid ${activeTeam.primaryColor}` } : undefined}
              >
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-[#10233f] text-white" : "bg-[#f0edf4] text-[#10233f]")}>
                  {row.position}
                </span>
                <span className="min-w-0 whitespace-normal break-words leading-tight">{row.team}</span>
                <span className="text-right">{row.played}</span>
                <span className="text-right">{row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}</span>
                <span className="text-right text-lg">{row.leaguePoints}</span>
              </div>
            );
          })}
        </div>
        <Button variant="secondary" className="w-full" onClick={() => onNavigate("Table")}>
          <Trophy className="h-4 w-4" />
          Open table
        </Button>
      </CardContent>
    </Card>
  );
}

function SeasonCompleteCard({ activeTeam = teamContexts[0], action, leagueTeamCount = standings.length, onAction }: { activeTeam?: TeamContext; action: string; leagueTeamCount?: number; onAction?: () => void }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const seasonStatus = seasonStatusFor(activeTeam.season);
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount);
  const qualified = seasonStatus === "complete" && qualification !== "none";
  const statusLabel = seasonStatus === "complete" ? "Complete" : seasonStatus === "not-started" ? "Not started" : "In play";
  const cardTitle = seasonStatus === "complete" ? "Season Complete" : "Season Status";
  const summary = (() => {
    if (seasonStatus === "complete") {
      return hasLeagueTable
        ? `${activeTeam.name} finished ${ordinal(activeTeam.leaguePosition)} in ${activeTeam.league}`
        : `${activeTeam.name} has no final league table`;
    }
    if (seasonStatus === "not-started") {
      return `${activeTeam.season} starts in September. No final league position yet.`;
    }
    return hasLeagueTable
      ? `${activeTeam.name} is currently ${ordinal(activeTeam.leaguePosition)} in ${activeTeam.league}`
      : `${activeTeam.name} has no league table yet`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
        <Badge variant={qualified ? qualificationBadgeVariant(qualification) : seasonStatus === "in-progress" ? "green" : "muted"}>
          {qualified ? qualificationLabel(qualification) : statusLabel}
        </Badge>
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
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">{seasonDateSummary(activeTeam.season)}</p>
        <p className="text-sm font-semibold text-[#6c5a73]">{summary}</p>
        {onAction ? (
          <Button className="mt-4 w-full" style={{ backgroundColor: activeTeam.primaryColor }} onClick={onAction}>{action}</Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function seasonBounds(season: string) {
  const match = season.match(/^(\d{4})\/(\d{2})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(`${String(startYear).slice(0, 2)}${match[2]}`);
  return {
    start: new Date(startYear, 8, 1),
    end: new Date(endYear, 2, 31, 23, 59, 59)
  };
}

function seasonStatusFor(season: string) {
  const bounds = seasonBounds(season);
  if (!bounds) return "in-progress" as const;
  const today = new Date();
  if (today < bounds.start) return "not-started" as const;
  if (today > bounds.end) return "complete" as const;
  return "in-progress" as const;
}

function seasonDateSummary(season: string) {
  const bounds = seasonBounds(season);
  if (!bounds) return season;
  return `${bounds.start.toLocaleDateString("en-IE", { month: "short", year: "numeric" })} to ${bounds.end.toLocaleDateString("en-IE", { month: "short", year: "numeric" })}`;
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
  home_player_1_id: string | null;
  home_player_1_name: string;
  home_player_2_id: string | null;
  home_player_2_name: string | null;
  away_player_1_id: string | null;
  away_player_1_name: string;
  away_player_2_id: string | null;
  away_player_2_name: string | null;
  breaks?: Array<{
    id: string;
    playerId: string;
    playerName: string;
    breakValue: number;
    recordedAt: string;
  }>;
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
    completedGames: number;
    totalGames: number;
    games: ManagerLineupGame[];
  }>;
  games: ManagerLineupGame[];
};

type LineupPickerTarget = {
  slotNumber: number;
  key: "player1Id" | "player2Id";
  label: string;
} | null;

type BreakEntryTarget = {
  game: ManagerLineupGame;
  fixture: NonNullable<ManagerLineupPayload["fixture"]>;
} | null;

const defaultLineupSlots: ManagerLineupSlot[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1", player1Id: "", player2Id: "" },
  { slotNumber: 2, gameType: "Singles", label: "Singles 2", player1Id: "", player2Id: "" },
  { slotNumber: 3, gameType: "Doubles", label: "Doubles", player1Id: "", player2Id: "" },
  { slotNumber: 4, gameType: "Singles", label: "Singles 4", player1Id: "", player2Id: "" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5", player1Id: "", player2Id: "" },
  { slotNumber: 6, gameType: "Singles", label: "Singles 6", player1Id: "", player2Id: "" }
];

type FixtureWeekFixture = {
  id: string;
  fixtureDate: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  matchId: string | null;
  homeTeamScore: number | null;
  awayTeamScore: number | null;
  homeLineupStatus: "Draft" | "Published" | null;
  awayLineupStatus: "Draft" | "Published" | null;
  completedGames: number;
  totalGames: number;
  isOwnFixture: boolean;
  games: ManagerLineupGame[];
};

type FixtureWeek = {
  id: string;
  weekNumber: number;
  weekLabel: string;
  startsOn: string;
  fixtures: FixtureWeekFixture[];
};

function weekDistanceFromToday(week: FixtureWeek) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const starts = new Date(`${week.startsOn}T00:00:00`);
  const ends = new Date(starts);
  ends.setDate(starts.getDate() + 6);
  if (today >= starts && today <= ends) return 0;
  return Math.abs(today.getTime() - starts.getTime());
}

function fixtureWeekShouldPoll(week?: FixtureWeek) {
  if (!week) return false;
  const today = localIsoDate();
  const weekStarts = week.startsOn.slice(0, 10);
  return weekStarts === today || week.fixtures.some((fixture) => {
    const inProgressMatch = fixture.totalGames > 0 && fixture.completedGames < fixture.totalGames;
    const lineupStarted = Boolean(fixture.homeLineupStatus || fixture.awayLineupStatus);
    return inProgressMatch || lineupStarted;
  });
}

function fixtureHasStarted(fixture: FixtureWeekFixture) {
  return Boolean(fixture.totalGames > 0 || fixture.homeTeamScore !== null || fixture.awayTeamScore !== null);
}

function FixtureWeekCarouselCard({
  activeTeam,
  selectedFixtureId,
  onSelectFixture,
  onOpenFixture
}: {
  activeTeam: TeamContext;
  selectedFixtureId?: string;
  onSelectFixture?: (fixtureId: string) => void;
  onOpenFixture?: (fixtureId: string) => void;
}) {
  const [weeks, setWeeks] = useState<FixtureWeek[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedFixtureId, setExpandedFixtureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    let active = true;
    let pollId: number | undefined;
    setLoading(true);
    setMessage("");

    async function loadWeeks(showLoading: boolean) {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({ league: activeTeam.league, season: activeTeam.season });
      if (activeTeam.teamId) params.set("teamId", activeTeam.teamId);
      const response = await fetch(`/api/fixtures/weeks?${params.toString()}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Fixtures unavailable.");
      if (!active) return;
      const nextWeeks: FixtureWeek[] = data.weeks ?? [];
      setWeeks(nextWeeks);
      if (nextWeeks.length) {
        setActiveIndex((current) => {
          if (current >= 0 && current < nextWeeks.length && !showLoading) return current;
          return nextWeeks.reduce((bestIndex, item, index) =>
            weekDistanceFromToday(item) < weekDistanceFromToday(nextWeeks[bestIndex]) ? index : bestIndex,
          0);
        });
      }
      setMessage("");
    }

    loadWeeks(true)
      .then(() => {
        if (!active) return;
        pollId = window.setInterval(() => {
          setWeeks((currentWeeks) => {
            if (fixtureWeekShouldPoll(currentWeeks[activeIndexRef.current])) {
              loadWeeks(false).catch(() => undefined);
            }
            return currentWeeks;
          });
        }, 8000);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Fixtures unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [activeTeam.league, activeTeam.season, activeTeam.teamId]);

  const week = weeks[activeIndex];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fixtures / Results</CardTitle>
        <Badge variant="muted">{activeTeam.league}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {message ? <p className="rounded-xl bg-[#fff8eb] p-3 text-sm font-semibold text-[#8a5a00] ring-1 ring-[#ffb00055]">{message}</p> : null}
        {loading ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Loading fixtures...</p>
        ) : week ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f5fa] p-2 ring-1 ring-[#eeeaf2]">
              <Button size="icon" variant="secondary" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex <= 0} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 text-center">
                <p className="text-xs font-bold uppercase text-[#6c5a73]">{week.weekLabel}</p>
                <p className="text-sm font-extrabold text-[#10233f]">{formatFixtureDate(week.startsOn)}</p>
              </div>
              <Button size="icon" variant="secondary" onClick={() => setActiveIndex((index) => Math.min(weeks.length - 1, index + 1))} disabled={activeIndex >= weeks.length - 1} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-[#eeeaf2]">
              {week.fixtures.map((fixture) => {
                const hasScore = fixture.homeTeamScore !== null && fixture.awayTeamScore !== null;
                const expanded = expandedFixtureId === fixture.id || selectedFixtureId === fixture.id;
                const managerOwnFixture = fixture.isOwnFixture && (activeTeam.role === "Manager" || activeTeam.role === "Assistant Manager");
                const canManage = Boolean(onOpenFixture && managerOwnFixture);
                const canInspect = fixtureHasStarted(fixture);
                const canOpenRow = canManage || canInspect;
                const homeLineupStatus = visibleLineupStatus(fixture.homeLineupStatus, fixture.fixtureDate);
                const awayLineupStatus = visibleLineupStatus(fixture.awayLineupStatus, fixture.fixtureDate);
                return (
                  <article
                    key={fixture.id}
                    className={cn("border-b border-[#eeeaf2] last:border-b-0", fixture.isOwnFixture && "bg-[#f7f5fa]")}
                    style={fixture.isOwnFixture ? { borderLeft: `5px solid ${activeTeam.primaryColor}` } : undefined}
                  >
                    <button
                      type="button"
                      disabled={!canOpenRow}
                      className={cn(
                        "grid w-full gap-2 p-3 text-left transition-colors",
                        canOpenRow ? "hover:bg-[#f7f5fa]" : "cursor-default"
                      )}
                      onClick={() => {
                        if (canManage) {
                          onSelectFixture?.(fixture.id);
                          onOpenFixture?.(fixture.id);
                          return;
                        }
                        if (!canInspect) return;
                        setExpandedFixtureId((current) => current === fixture.id ? "" : fixture.id);
                      }}
                    >
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <FixtureTeamLabel teamName={fixture.homeTeamName} lineupStatus={fixtureHasStarted(fixture) ? undefined : homeLineupStatus} />
                        {hasScore ? (
                          <span className="rounded-lg bg-[#10233f] px-2 py-1 text-sm font-black text-white">{fixture.homeTeamScore}-{fixture.awayTeamScore}</span>
                        ) : (
                          <span className="text-xs font-black uppercase text-[#6c5a73]">v</span>
                        )}
                        <FixtureTeamLabel teamName={fixture.awayTeamName} align="right" lineupStatus={fixtureHasStarted(fixture) ? undefined : awayLineupStatus} />
                      </div>
                      {canManage ? (
                        <span className="justify-self-start rounded-lg px-3 py-2 text-xs font-extrabold uppercase text-white" style={{ backgroundColor: activeTeam.primaryColor }}>
                          {fixtureHasStarted(fixture) ? "Open match" : "Pick team"}
                        </span>
                      ) : null}
                    </button>
                    {expanded && canInspect ? (
                      <div className="border-t border-[#eeeaf2] bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
                        <ReadOnlyFixtureDetails fixture={fixture} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <div className="flex justify-center gap-1">
              {weeks.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn("h-2 w-6 rounded-full", index === activeIndex ? "bg-[#10233f]" : "bg-[#d8d3df]")}
                  aria-label={`Go to ${item.weekLabel}`}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No fixtures are scheduled for {activeTeam.league}.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ManagerLineupCard({
  activeTeam,
  preferredFixtureId,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  preferredFixtureId?: string;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const [payload, setPayload] = useState<ManagerLineupPayload | null>(null);
  const [slots, setSlots] = useState<ManagerLineupSlot[]>(defaultLineupSlots);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingGameIds, setPendingGameIds] = useState<Set<string>>(new Set());
  const [pendingBreak, setPendingBreak] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<LineupPickerTarget>(null);
  const [breakTarget, setBreakTarget] = useState<BreakEntryTarget>(null);
  const [openedFixtureId, setOpenedFixtureId] = useState("");
  const dirtyDraftRef = useRef(false);
  const fixtureIdRef = useRef("");
  const matchSnapshotRef = useRef("");
  const testManagerMode = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embed") === "1" &&
    new URLSearchParams(window.location.search).get("role")?.toLowerCase() === "manager";
  const testUserEmail = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";

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
        const params = new URLSearchParams({ teamId: activeTeam.teamId });
        if (preferredFixtureId) params.set("fixtureId", preferredFixtureId);
        if (testManagerMode) params.set("testManager", "1");
        if (testUserEmail) params.set("testUser", testUserEmail);
        const response = await fetch(`/api/manager/lineup?${params.toString()}`, { credentials: "same-origin" });
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
  }, [activeTeam.teamId, preferredFixtureId]);

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
          slots,
          testManager: testManagerMode,
          testUser: testUserEmail
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
                  completedGames: 0,
                  totalGames: 0,
                  games: []
                }]).map((fixture) => {
                  const isOwnFixture = fixture.homeTeamId === activeTeam.teamId || fixture.awayTeamId === activeTeam.teamId;
                  const bothPublished = fixture.homeLineupStatus === "Published" && fixture.awayLineupStatus === "Published";
                  const hasScore = fixture.homeTeamScore !== null && fixture.awayTeamScore !== null;
                  const matchStarted = Boolean(fixture.totalGames > 0);
                  const active = fixture.id === openedFixtureId;
                  const canManageFixture = Boolean(payload.canManage && isOwnFixture);
                  const managerActionSide = activeTeam.teamId === fixture.awayTeamId ? "away" : "home";
                  const managedLineupStatus = activeTeam.teamId === fixture.awayTeamId ? fixture.awayLineupStatus : fixture.homeLineupStatus;
                  const managedPublished = managedLineupStatus === "Published";
                  const showLineupStatus = isOwnFixture && !matchStarted;
                  const actionLabel = canManageFixture && !active
                    ? bothPublished ? "Enter scores" : managedPublished ? "" : "Pick team"
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
                          <FixtureTeamLabel teamName={fixture.homeTeamName} lineupStatus={showLineupStatus ? fixture.homeLineupStatus : undefined} />
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
                          <FixtureTeamLabel teamName={fixture.awayTeamName} align="right" lineupStatus={showLineupStatus ? fixture.awayLineupStatus : undefined} />
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          {actionLabel ? (
                            <span className={cn(
                              "inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-extrabold uppercase tracking-wide",
                              canManageFixture && !bothPublished && !managedPublished
                                ? "bg-[#1b8a72] text-white"
                                : "bg-[#10233f] text-white",
                              managerActionSide === "away" ? "col-start-3 justify-self-end" : "col-start-1 justify-self-start"
                            )}>
                              {actionLabel}
                            </span>
                          ) : (
                            <span className="col-span-2 text-xs font-bold text-[#6c5a73]">
                              {matchStarted ? "Lineups and frames available" : "Scheduled"}
                            </span>
                          )}
                          <ChevronDown className={cn("col-start-2 row-start-1 h-4 w-4 justify-self-center text-[#6c5a73] transition-transform", active && "rotate-180")} />
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
                          {isOwnFixture && matchReady ? (
                            <GeneratedMatchCard
                              payload={payload}
                              onRecord={recordGameWinner}
                              onBreak={(game) => setBreakTarget({ game, fixture: payload.fixture! })}
                              pendingGameIds={pendingGameIds}
                            />
                          ) : null}
                          {!isOwnFixture ? <ReadOnlyFixtureDetails fixture={fixture} /> : null}
                          {isOwnFixture && !managedPublished && payload.canManage ? (
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
                                <Button onClick={() => submitLineup("publish")} disabled={busy || selectedCount < 7}>
                                  {selectedCount < 7 ? `Pick ${7 - selectedCount} more` : "Publish lineup"}
                                </Button>
                              </div>
                              {selectedCount < 7 ? (
                                <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">
                                  Pick all 7 player slots before publishing. Drafts can still be saved.
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          {isOwnFixture && managedPublished ? <PublishedLineupSummary title={`${activeTeam.name} published lineup`} slots={payload.lineup?.slots ?? slots} /> : null}
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
            {breakTarget ? (
              <BreakEntrySheet
                target={breakTarget}
                busy={pendingBreak}
                onClose={() => setBreakTarget(null)}
                onSave={(playerId, breakValue) => recordBreak(breakTarget.game.id, playerId, breakValue)}
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
    const nextPayload = applyOptimisticGameWinner(payload, gameId, winnerTeamId);
    const previousTeamSummary: TeamSummaryUpdate = {
      leagueMatchesPlayed: activeTeam.leagueMatchesPlayed,
      matchesWon: activeTeam.matchesWon,
      matchesLost: activeTeam.matchesLost,
      pointsFor: activeTeam.pointsFor,
      pointsAgainst: activeTeam.pointsAgainst,
      leaguePoints: activeTeam.leaguePoints
    };
    setPendingGameIds((current) => new Set(current).add(gameId));
    setPayload(nextPayload);
    const summaryUpdate = liveSummaryFromGameChange(activeTeam, previousPayload, nextPayload);
    if (summaryUpdate && activeTeam.teamId) onTeamSummaryUpdate?.(activeTeam.teamId, summaryUpdate);
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
          winnerTeamId,
          testManager: testManagerMode,
          testUser: testUserEmail
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
      if (activeTeam.teamId) onTeamSummaryUpdate?.(activeTeam.teamId, previousTeamSummary);
      setMessage(error instanceof Error ? error.message : "Could not update result.");
    } finally {
      setPendingGameIds((current) => {
        const next = new Set(current);
        next.delete(gameId);
        return next;
      });
    }
  }

  async function recordBreak(gameId: string, playerId: string, breakValue: number) {
    if (!activeTeam.teamId || !payload?.fixture) return;
    setPendingBreak(true);
    setMessage("");
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          fixtureId: payload.fixture.id,
          action: "recordBreak",
          gameId,
          playerId,
          breakValue,
          testManager: testManagerMode,
          testUser: testUserEmail
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not record break.");
      setPayload(data);
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setBreakTarget(null);
      setMessage("Break recorded.");
      onDataRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record break.");
    } finally {
      setPendingBreak(false);
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

function visibleLineupStatus(status: "Draft" | "Published" | null, fixtureDate: string) {
  if (status) return status;
  return fixtureDate.slice(0, 10) === localIsoDate() ? null : undefined;
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

function fixtureScoreForTeam(payload: ManagerLineupPayload, teamId: string) {
  const fixture = payload.fixture;
  if (!fixture) return { pointsFor: 0, pointsAgainst: 0 };

  return payload.games.reduce((score, game) => {
    if (game.winner_team_id === fixture.homeTeamId) {
      return {
        pointsFor: score.pointsFor + (teamId === fixture.homeTeamId ? game.points_awarded : 0),
        pointsAgainst: score.pointsAgainst + (teamId === fixture.awayTeamId ? game.points_awarded : 0)
      };
    }
    if (game.winner_team_id === fixture.awayTeamId) {
      return {
        pointsFor: score.pointsFor + (teamId === fixture.awayTeamId ? game.points_awarded : 0),
        pointsAgainst: score.pointsAgainst + (teamId === fixture.homeTeamId ? game.points_awarded : 0)
      };
    }
    return score;
  }, { pointsFor: 0, pointsAgainst: 0 });
}

function fixtureIsComplete(payload: ManagerLineupPayload) {
  return payload.games.length === 6 && payload.games.every((game) => game.winner_team_id);
}

function liveSummaryFromGameChange(activeTeam: TeamContext, previousPayload: ManagerLineupPayload, nextPayload: ManagerLineupPayload): TeamSummaryUpdate | null {
  if (!activeTeam.teamId || !nextPayload.fixture) return null;

  const previousScore = fixtureScoreForTeam(previousPayload, activeTeam.teamId);
  const nextScore = fixtureScoreForTeam(nextPayload, activeTeam.teamId);
  const pointsFor = (activeTeam.pointsFor ?? 0) + nextScore.pointsFor - previousScore.pointsFor;
  const pointsAgainst = (activeTeam.pointsAgainst ?? 0) + nextScore.pointsAgainst - previousScore.pointsAgainst;
  const previousComplete = fixtureIsComplete(previousPayload);
  const nextComplete = fixtureIsComplete(nextPayload);
  const completedNow = !previousComplete && nextComplete;
  const teamWon = nextScore.pointsFor > nextScore.pointsAgainst;
  const teamLost = nextScore.pointsFor < nextScore.pointsAgainst;

  return {
    pointsFor,
    pointsAgainst,
    leaguePoints: pointsFor,
    leagueMatchesPlayed: (activeTeam.leagueMatchesPlayed ?? 0) + (completedNow ? 1 : 0),
    matchesWon: (activeTeam.matchesWon ?? 0) + (completedNow && teamWon ? 1 : 0),
    matchesLost: (activeTeam.matchesLost ?? 0) + (completedNow && teamLost ? 1 : 0)
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
                  {selected || unavailable ? (
                    <span className="text-xs font-extrabold uppercase text-[#6c5a73]">
                      {selected ? "Selected" : "Picked"}
                    </span>
                  ) : null}
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

function ReadOnlyFixtureDetails({ fixture }: { fixture: { games?: ManagerLineupGame[]; status: string; homeTeamId: string; awayTeamId: string } }) {
  const games = fixture.games ?? [];

  if (!games.length) {
    return (
      <div className="rounded-xl bg-[#f7f5fa] p-3">
        <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Match details</p>
        <p className="mt-1 text-sm font-bold text-[#10233f]">
          Scores and frame details will appear here once the match card is active.
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
        {games.map((game) => {
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
              {game.breaks?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {game.breaks.map((item) => (
                    <span key={item.id} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white">
                      {item.playerName} {item.breakValue}
                    </span>
                  ))}
                </div>
              ) : null}
              {!game.winner_team_id ? <p className="text-xs font-semibold text-white/60">Awaiting result</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeneratedMatchCard({
  payload,
  onRecord,
  onBreak,
  pendingGameIds
}: {
  payload: ManagerLineupPayload;
  onRecord: (gameId: string, winnerTeamId: string) => void;
  onBreak: (game: ManagerLineupGame) => void;
  pendingGameIds: Set<string>;
}) {
  const games = payload.games;
  const fixture = payload.fixture;
  if (!fixture) return null;

  return (
    <div className="rounded-xl bg-[#10233f] p-3 text-white">
      <p className="text-xs font-extrabold uppercase text-white/60">Result entry</p>
      <div className="mt-2 grid gap-2">
        {games.map((game) => {
          const breaks = game.breaks ?? [];
          return (
            <div key={game.id} className="grid gap-2 rounded-lg bg-white/10 p-2 text-sm font-bold">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase text-white/55">Game {game.game_number} - {game.points_awarded} pts</p>
                <p className="mt-1 leading-tight">
                  {game.home_player_1_name}{game.home_player_2_name ? ` / ${game.home_player_2_name}` : ""} <span className="text-white/55">v</span> {game.away_player_1_name}{game.away_player_2_name ? ` / ${game.away_player_2_name}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button className="min-h-9 px-2 py-1 text-xs" size="sm" disabled={pendingGameIds.has(game.id)} variant={game.winner_team_id === fixture.homeTeamId ? "default" : "secondary"} onClick={() => onRecord(game.id, fixture.homeTeamId)}>
                  {pendingGameIds.has(game.id) && game.winner_team_id === fixture.homeTeamId ? "..." : fixture.homeTeamName.replace(/ Golf Club/g, "")}
                </Button>
                <Button className="min-h-9 px-2 py-1 text-xs" size="sm" disabled={pendingGameIds.has(game.id)} variant={game.winner_team_id === fixture.awayTeamId ? "default" : "secondary"} onClick={() => onRecord(game.id, fixture.awayTeamId)}>
                  {pendingGameIds.has(game.id) && game.winner_team_id === fixture.awayTeamId ? "..." : fixture.awayTeamName.replace(/ Golf Club/g, "")}
                </Button>
              </div>
              <div className="rounded-lg bg-[#071426]/35 px-2.5 py-2 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/55">Breaks</span>
                    {breaks.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-extrabold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7bc7d6]" />
                        <span>{item.playerName}</span>
                        <span className="rounded bg-white/15 px-1.5 py-0.5">{item.breakValue}</span>
                      </span>
                    ))}
                    {!breaks.length ? <span className="text-xs font-semibold text-white/45">None</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onBreak(game)}
                    className="min-h-8 rounded-md bg-white/10 px-2 text-xs font-extrabold text-[#7bc7d6] transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
                  >
                    Record break
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function gameBreakPlayers(game: ManagerLineupGame) {
  return [
    { id: game.home_player_1_id, name: game.home_player_1_name },
    { id: game.home_player_2_id, name: game.home_player_2_name ?? "" },
    { id: game.away_player_1_id, name: game.away_player_1_name },
    { id: game.away_player_2_id, name: game.away_player_2_name ?? "" }
  ].filter((player): player is { id: string; name: string } => Boolean(player.id && player.name));
}

function BreakEntrySheet({
  target,
  busy,
  onSave,
  onClose
}: {
  target: NonNullable<BreakEntryTarget>;
  busy: boolean;
  onSave: (playerId: string, breakValue: number) => void;
  onClose: () => void;
}) {
  const players = gameBreakPlayers(target.game);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [breakValue, setBreakValue] = useState("");
  const numericBreak = Number(breakValue);
  const canSave = Boolean(playerId && Number.isInteger(numericBreak) && numericBreak >= 1 && numericBreak <= 147);

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#071426]/50 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Record break">
      <div className="mx-auto grid max-h-[86vh] w-full max-w-lg gap-4 overflow-hidden rounded-2xl bg-white p-4 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Record break</p>
            <h3 className="text-lg font-black text-[#10233f]">Game {target.game.game_number}</h3>
            <p className="mt-1 text-sm font-bold text-[#6c5a73]">
              {target.fixture.homeTeamName} v {target.fixture.awayTeamName}
            </p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg bg-[#f7f5fa] text-[#10233f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
            onClick={onClose}
            aria-label="Close break entry"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-2">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Player</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]",
                  player.id === playerId ? "border-[#1b8a72] bg-[#e9f7f3] text-[#10233f]" : "border-[#eeeaf2] bg-white text-[#10233f] hover:bg-[#eef7f5]"
                )}
                onClick={() => setPlayerId(player.id)}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-extrabold uppercase text-[#6c5a73]">Break value</span>
          <input
            type="number"
            min={1}
            max={147}
            inputMode="numeric"
            value={breakValue}
            onChange={(event) => setBreakValue(event.target.value)}
            className="min-h-12 rounded-lg border border-[#d8d3df] bg-white px-3 text-lg font-black text-[#10233f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
            placeholder="e.g. 42"
          />
        </label>
        <Button disabled={!canSave || busy} onClick={() => onSave(playerId, numericBreak)}>
          {busy ? "Saving..." : "Save break"}
        </Button>
      </div>
    </div>
  );
}

function SquadManagementCard({ activeTeam }: { activeTeam: TeamContext }) {
  const [players, setPlayers] = useState<Array<{ personId: string; name: string; played: number; won: number; lost: number; winPercentage: number; highestBreak: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!activeTeam.teamId) {
      setPlayers([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setMessage("");
    fetch(`/api/team/player-stats?teamId=${encodeURIComponent(activeTeam.teamId)}`, { credentials: "same-origin" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Player stats unavailable.");
        setPlayers(data.players ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Player stats unavailable.");
        setPlayers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam.teamId]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Player Stats</CardTitle>
        <Badge variant="muted">{loading ? "Loading" : `${players.length}`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_44px_44px_44px_58px_54px] gap-2 rounded-xl bg-[#f7f5fa] px-3 py-2 text-[11px] font-extrabold uppercase text-[#6c5a73]">
          <span>Player</span>
          <span className="text-right">P</span>
          <span className="text-right">W</span>
          <span className="text-right">L</span>
          <span className="text-right">Win</span>
          <span className="text-right">Break</span>
        </div>
        {players.map((player) => (
          <div key={player.personId} className="grid min-h-12 grid-cols-[minmax(0,1fr)_44px_44px_44px_58px_54px] items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-[#eeeaf2]">
            <span className="min-w-0 whitespace-normal break-words font-extrabold leading-tight">{player.name}</span>
            <span className="text-right">{player.played}</span>
            <span className="text-right text-[#0a6b45]">{player.won}</span>
            <span className="text-right text-[#b42318]">{player.lost}</span>
            <span className="text-right">{player.played ? `${player.winPercentage}%` : "-"}</span>
            <span className="text-right">{player.highestBreak ?? "-"}</span>
          </div>
        ))}
        {!players.length ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            {loading ? "Loading player stats..." : message || `No player stats are available for ${activeTeam.name} yet.`}
          </p>
        ) : null}
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
    <div className="min-w-0 rounded-xl bg-white/10 p-2.5 ring-1 ring-white/20 backdrop-blur sm:p-3">
      <p className="text-[10px] font-bold uppercase leading-tight text-white/65">{label}</p>
      <p className="mt-1 truncate text-2xl font-extrabold leading-none text-white sm:text-3xl">{value}</p>
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
