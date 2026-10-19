"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  Copy,
  Home,
  LogOut,
  Mail,
  Menu as MenuIcon,
  MessageCircle,
  Phone,
  PlusCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trash2,
  Trophy,
  UserCircle,
  Users,
  XCircle
} from "lucide-react";
import { appearanceMenuOptions, defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import { clubTeamStructure, playerGameResults as demoPlayerGameResults, recentResults, standings, teamContexts, upcomingFixture } from "@/lib/demo-data";
import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, MatchResult, PlayerBreakStat, PlayerGameResult, Role, RoleAppearance, SponsorAd, Standing, TeamContext } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeagueChairLiveIndicator, LeagueChairLiveStatusList, useLiveScoringStatuses } from "@/components/live-scoring-dashboard";
import { LastManStandingHomePanel, LastManStandingPage, loadLastManStandingSummaries } from "@/components/last-man-standing";
import { ClubLadderHomePanel, ClubLadderPage } from "@/components/club-ladder";
import { ClubFeatureUnavailable } from "@/components/club-feature-unavailable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shouldShowFixtureDates } from "@/lib/fixture-scheduling.mjs";
import { cn } from "@/lib/utils";

type AppPage = "Home" | "Fixtures" | "Match" | "Results" | "Table" | "Club" | "Ladder" | "Bookings" | "Competitions" | "Friendlies" | "Contacts" | "Players" | "Stats" | "Messages" | "Menu" | "Interclub Leagues" | "Last Man Standing" | "Shop";
type TeamSummaryUpdate = Partial<Pick<TeamContext, "leagueMatchesPlayed" | "matchesWon" | "matchesLost" | "pointsFor" | "pointsAgainst" | "leaguePoints">>;
type ShopProduct = {
  id: string;
  productName: string;
  description: string;
  imagePath: string;
  priceEuros: number;
  optionName?: string | null;
  optionValues?: string[];
};
type ShopCartItem = {
  key: string;
  productId: string;
  productName: string;
  imagePath: string;
  priceEuros: number;
  selectedOption: string;
  quantity: number;
};
const roleOptions: Role[] = ["Player", "Manager", "Club Member", "Club Admin"];
const RECENT_FORM_LIMIT = 3;
const SIMULATION_CONTROLS_ENABLED = false;
const leagueOrder: TeamContext["league"][] = ["A League", "B League", "C League"];
const pagesWithLeagueAside: AppPage[] = ["Home"];
const attackSnookerRules = [
  "Start with six reds on the table.",
  "To start a break, you may pot any ball. Reds may be potted consecutively, but coloured balls may not be potted twice in a row.",
  "A break is the total value of all consecutive pots. If more than one ball is potted on a shot, the shot scores the total value of all balls potted.",
  "When a red is potted, it stays down. When a colour is potted while reds remain, it is replaced on its own spot, or the highest available spot if its own spot is covered.",
  "When all reds are potted, the remaining colours can be potted in any order.",
  "While at least one red remains, a player may call Double before the first shot of a visit. Any break on that visit is doubled.",
  "Double can only be called once in a frame. If the player fouls at the end of a Double visit, the double does not count for that break.",
  "A frame ends after 10 minutes, when all balls other than the cue ball are potted, or when it is mathematically impossible for one player to win.",
  "There are no snookers. Fouls are worth 6 points, and after a foul the cue ball can be placed anywhere on the table for the next shot."
];

function isClubOnlyRole(role: Role) {
  return role === "Club Member" || role === "Club Admin" || role === "League Chair";
}

function seasonSortValue(season: string) {
  const match = season.match(/^(\d{4})\/(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

export function currentAppSeason(contexts: TeamContext[]) {
  const seasons = Array.from(new Set(contexts.filter((context) => !isClubOnlyRole(context.role)).map((context) => context.season).filter(Boolean)));
  if (!seasons.length) return "Club";
  return seasons.find((season) => seasonStatusFor(season) === "in-progress")
    ?? [...seasons].sort((a, b) => seasonSortValue(b) - seasonSortValue(a))[0];
}

function currentTestUserParam() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";
}

function withTestUser(path: string) {
  const testUser = currentTestUserParam();
  if (!testUser) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}testUser=${encodeURIComponent(testUser)}`;
}

function isPwaContainer() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(
    navigatorWithStandalone.standalone ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function withCompetitionContext(path: string, activeTeam: TeamContext) {
  const contextualPath = activeTeam.club
    ? `${path}${path.includes("?") ? "&" : "?"}contextClub=${encodeURIComponent(activeTeam.club)}`
    : path;
  return withTestUser(contextualPath);
}

const menuIconMap: Record<AppearanceMenuId | "Menu", typeof Home> = {
  Home,
  Fixtures: CalendarDays,
  Results: ClipboardCheck,
  Table: Trophy,
  Club: CalendarPlus,
  Bookings: CalendarPlus,
  Competitions: Trophy,
  Friendlies: Swords,
  Contacts: Phone,
  Players: Users,
  Stats: BarChart3,
  Messages: Mail,
  "Interclub Leagues": Trophy,
  "Last Man Standing": ShieldCheck,
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

function withMyClubLast(items: AppearanceMenuId[]) {
  return items.includes("Club") ? [...items.filter((item) => item !== "Club"), "Club" as AppearanceMenuId] : items;
}

function fixedMenuItemsForRole(role: Role, enteredCompetitionCount: number): AppearanceMenuId[] {
  if (role === "Club Member") {
    return ["Home", "Fixtures", "Table", "Bookings", "Competitions", "Interclub Leagues"];
  }
  if (role === "Club Admin") {
    return ["Home", "Fixtures", "Table", "Competitions", "Bookings", "Contacts", "Interclub Leagues"];
  }
  if (role === "League Chair") {
    return ["Home", "Contacts", "Interclub Leagues"];
  }

  const base: AppearanceMenuId[] = role === "Manager"
    ? ["Home", "Fixtures", "Table", "Results", "Contacts", "Friendlies", "Last Man Standing", "Club"]
    : ["Home", "Fixtures", "Table", "Results", "Friendlies", "Last Man Standing", "Club"];
  if (enteredCompetitionCount > 0) {
    return withMyClubLast(role === "Manager"
      ? ["Home", "Fixtures", "Table", "Results", "Contacts", "Friendlies", "Competitions", "Last Man Standing", "Club"]
      : ["Home", "Fixtures", "Table", "Results", "Friendlies", "Competitions", "Last Man Standing", "Club"]);
  }
  return withMyClubLast(base);
}

function applyLeagueChairAccess(menuItems: AppearanceMenuId[], activeTeam: TeamContext) {
  if (!activeTeam.hasLeagueChairAccess) return menuItems;
  const extras: AppearanceMenuId[] = ["Contacts", "Last Man Standing"];
  return Array.from(new Set([...menuItems, ...extras]));
}

export function AppShell({
  contexts = teamContexts,
  standingsData = standings,
  playerBreakStats = [],
  playerGameResults = demoPlayerGameResults,
  matchResults,
  sponsorAds = [],
  activeMatchCount = 0,
  appearance,
  userLabel,
  onSignOut,
  onPageVisit,
  onDataRefresh
}: {
  contexts?: TeamContext[];
  standingsData?: Standing[];
  playerBreakStats?: PlayerBreakStat[];
  playerGameResults?: PlayerGameResult[];
  matchResults?: MatchResult[];
  sponsorAds?: SponsorAd[];
  activeMatchCount?: number;
  appearance?: AppearanceConfig;
  userLabel?: string;
  onSignOut?: () => void;
  onPageVisit?: (pageLabel: string, activeTeam: TeamContext) => void;
  onDataRefresh?: () => void;
}) {
  const appSeason = useMemo(() => currentAppSeason(contexts), [contexts]);
  const appContexts = useMemo(
    () => contexts.filter((context) => context.season === appSeason || isClubOnlyRole(context.role)),
    [appSeason, contexts]
  );
  const preferredContextId = useMemo(() => {
    const availableContexts = appContexts.length ? appContexts : contexts;
    if (typeof window === "undefined") return availableContexts[0]?.id ?? teamContexts[0].id;
    const params = new URLSearchParams(window.location.search);
    const requestedTeam = params.get("team")?.trim().toLowerCase();
    const requestedRole = params.get("role")?.trim().toLowerCase();
    if (!requestedTeam && !requestedRole) return availableContexts[0]?.id ?? teamContexts[0].id;
    return availableContexts.find((team) => {
      const teamMatches = requestedTeam ? normalizeLookupKey(team.name) === normalizeLookupKey(requestedTeam) : true;
      const roleMatches = requestedRole ? team.role.toLowerCase() === requestedRole : true;
      return teamMatches && roleMatches;
    })?.id ?? availableContexts[0]?.id ?? teamContexts[0].id;
  }, [appContexts, contexts]);
  const preferredContext = useMemo(
    () => appContexts.find((team) => team.id === preferredContextId) ?? appContexts[0] ?? contexts[0] ?? teamContexts[0],
    [appContexts, contexts, preferredContextId]
  );
  const [selectedId, setSelectedId] = useState(preferredContextId);
  const [activePage, setActivePage] = useState<AppPage>(() => {
    if (typeof window === "undefined") return "Home";
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    return requestedPage === "Competitions" || requestedPage === "Last Man Standing" ? requestedPage : "Home";
  });
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [simulatedRole, setSimulatedRole] = useState<Role>(contexts[0]?.role ?? teamContexts[0].role);
  const [simulatedClub, setSimulatedClub] = useState(contexts[0]?.club ?? teamContexts[0].club);
  const [teamSummaryOverrides, setTeamSummaryOverrides] = useState<Record<string, TeamSummaryUpdate>>({});
  const [enteredCompetitionCount, setEnteredCompetitionCount] = useState(0);
  const [lastManStandingAvailable, setLastManStandingAvailable] = useState<boolean | null>(null);
  const hasAppliedUrlContext = useRef(false);
  useEffect(() => {
    setTeamSummaryOverrides({});
  }, [contexts]);
  function changeContext(nextId: string) {
    setSelectedId(nextId);
    setSelectedFixtureId("");
    setActivePage("Home");
  }

  function changeSimulatedRole(nextRole: Role) {
    setSimulatedRole(nextRole);
    setSelectedFixtureId("");
    setActivePage("Home");
  }

  function changeSimulatedClub(nextClub: string) {
    setSimulatedClub(nextClub);
    setSelectedFixtureId("");
    setActivePage("Home");
  }

  useEffect(() => {
    if (!appContexts.some((team) => team.id === selectedId)) {
      setSelectedId(appContexts[0]?.id ?? preferredContextId);
    }
  }, [appContexts, preferredContextId, selectedId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasAppliedUrlContext.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("team") || params.has("role") || params.has("season")) {
      hasAppliedUrlContext.current = true;
      setSelectedId(preferredContextId);
    }
  }, [preferredContextId]);

  const realActiveTeam = useMemo(
    () => appContexts.find((team) => team.id === selectedId) ?? appContexts[0] ?? contexts[0] ?? teamContexts[0],
    [appContexts, contexts, selectedId]
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
  const appRefreshKey = `${activeTeam.id}|${activeTeam.role}|${activePage}`;
  const appRefreshKeyRef = useRef("");
  const updateTeamSummary = (teamId: string, summary: TeamSummaryUpdate) => {
    setTeamSummaryOverrides((current) => ({
      ...current,
      [teamId]: {
        ...current[teamId],
        ...summary
      }
    }));
  };
  useEffect(() => {
    if (!appRefreshKeyRef.current) {
      appRefreshKeyRef.current = appRefreshKey;
      return;
    }
    if (appRefreshKeyRef.current === appRefreshKey) return;
    appRefreshKeyRef.current = appRefreshKey;
    onDataRefresh?.();
    window.dispatchEvent(new Event("interclub:refresh-panels"));
  }, [appRefreshKey, onDataRefresh]);
  const appearanceConfig = useMemo(() => normalizeAppearanceConfig(appearance ?? defaultAppearanceConfig), [appearance]);
  const activeAppearance = appearanceConfig[activeTeam.role] ?? defaultAppearanceConfig[activeTeam.role];
  const userCanShare = useMemo(() => contexts.some((context) => isManagerRole(context.role)), [contexts]);
  useEffect(() => {
    let active = true;
    if (!isClubOnlyRole(activeTeam.role)) {
      setEnteredCompetitionCount(0);
      return () => {
        active = false;
      };
    }
    fetch(withCompetitionContext("/api/competitions", activeTeam), { credentials: "same-origin" })
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
  useEffect(() => {
    let active = true;
    const refreshAvailability = () => {
      loadLastManStandingSummaries()
        .then((competitions) => {
          if (active) setLastManStandingAvailable(competitions.length > 0);
        })
        .catch(() => {
          if (active) setLastManStandingAvailable(false);
        });
    };
    refreshAvailability();
    window.addEventListener("interclub:refresh-panels", refreshAvailability);
    return () => {
      active = false;
      window.removeEventListener("interclub:refresh-panels", refreshAvailability);
    };
  }, []);
  const activeMenuItems = useMemo(() => {
    const items = applyLeagueChairAccess(fixedMenuItemsForRole(activeTeam.role, enteredCompetitionCount), activeTeam);
    return lastManStandingAvailable === true ? items : items.filter((item) => item !== "Last Man Standing");
  }, [activeTeam, activeTeam.role, enteredCompetitionCount, lastManStandingAvailable]);
  useEffect(() => {
    if (lastManStandingAvailable === false && activePage === "Last Man Standing") setActivePage("Home");
  }, [activePage, lastManStandingAvailable]);
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
  const activePlayerBreakStat = useMemo(
    () => playerBreakStats.find((stat) => stat.league === activeTeam.league && stat.season === activeTeam.season) ?? null,
    [activeTeam.league, activeTeam.season, playerBreakStats]
  );
  const activeSponsorAd = sponsorAds.find((ad) =>
    ad.placement === "league-chair-banner" &&
    (ad.audience === "Everyone" || (ad.audience === "League Chair" && activeTeam.hasLeagueChairAccess))
  );
  const allMatchResults = matchResults ?? [];
  const clubOnlyView = isClubOnlyRole(activeTeam.role);
  const showLeaguePanels = !clubOnlyView && activePage === "Home" && pagesWithLeagueAside.includes(activePage);
  const navigateToPage = (page: AppPage) => {
    if (page !== "Match") setSelectedFixtureId("");
    setActivePage(page);
  };
  const openFixturePage = (fixtureId: string) => {
    setSelectedFixtureId(fixtureId);
    setActivePage("Match");
  };
  const previousPageRef = useRef(activePage);

  useEffect(() => {
    if (previousPageRef.current === activePage) return;
    previousPageRef.current = activePage;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [activePage]);

  useEffect(() => {
    onPageVisit?.(activePage, activeTeam);
  }, [activePage, activeTeam.id, activeTeam.name, activeTeam.role, onPageVisit]);

  return (
    <>
      <main className="min-h-screen app-bg pb-24 text-[#10233f]">
      <PwaPullToRefresh
        onRefresh={() => {
          onDataRefresh?.();
          window.dispatchEvent(new Event("interclub:refresh-panels"));
        }}
      />
      <Header
        activeTeam={activeTeam}
        contexts={appContexts.length ? appContexts : contexts}
        selectedId={selectedId}
        onContextChange={changeContext}
        simulatedRole={simulatedRole}
        simulatedClub={simulatedClub}
        onRoleChange={changeSimulatedRole}
        onClubChange={changeSimulatedClub}
        onSignOut={onSignOut}
        userLabel={userLabel}
      />
      <section className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:items-start lg:gap-6 lg:px-8 xl:px-10",
        showLeaguePanels ? "lg:grid-cols-[220px_minmax(0,1fr)_380px] xl:grid-cols-[230px_minmax(0,1fr)_400px]" : "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]"
      )}>
        <DesktopRail activeTeam={activeTeam} activePage={activePage} onNavigate={navigateToPage} menuItems={activeMenuItems} />
        <div className="grid min-w-0 w-full gap-4">
          {activePage === "Home" ? (
            clubOnlyView ? (
              <ClubMemberHero activeTeam={activeTeam} userLabel={userLabel} />
            ) : (
              <MatchdayHero activeTeam={activeTeam} userLabel={userLabel} leagueTeamCount={activeStandings.length} activeMatchCount={activeMatchCount} />
            )
          ) : null}
          <PageContent
            activePage={activePage}
            activeTeam={activeTeam}
            standingsData={activeStandings}
            allStandingsData={standingsData}
            playerBreakStat={activePlayerBreakStat}
            playerGameResults={activePlayerGameResults}
            matchResults={activeMatchResults}
            allMatchResults={allMatchResults}
            appearance={{ ...activeAppearance, menuItems: activeMenuItems }}
            userCanShare={userCanShare}
            onNavigate={navigateToPage}
            onOpenFixture={openFixturePage}
            selectedFixtureId={selectedFixtureId}
            onSignOut={onSignOut}
            userLabel={userLabel}
            onDataRefresh={onDataRefresh}
            onTeamSummaryUpdate={updateTeamSummary}
          />
          {activeSponsorAd ? <SponsorBanner ad={activeSponsorAd} /> : null}
        </div>
        {showLeaguePanels ? (
          <aside className="grid gap-4 lg:content-start">
            <LeagueTable activeTeam={activeTeam} standingsData={activeStandings} matchResults={activeMatchResults} userCanShare={userCanShare} />
          </aside>
        ) : null}
      </section>
      </main>
      <BottomNav activePage={activePage} activeTeam={activeTeam} onNavigate={navigateToPage} menuItems={activeMenuItems} />
    </>
  );
}

function normalizeLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function buildSimulatedContext(baseTeam: TeamContext, role: Role, clubName: string, tableRows: Standing[]): TeamContext {
  const club = clubTeamStructure.find((entry) => entry.club === clubName) ?? clubTeamStructure[0];
  const baseSuffix = baseTeam.name.match(/\b([ABC])$/)?.[1] ?? "A";
  const suffix = role === "Manager" ? "A" : baseSuffix;
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

function SponsorBanner({ ad }: { ad: SponsorAd }) {
  function recordAdvertClick() {
    const testUser = new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";
    const clickUrl = testUser ? `/api/ad-click?testUser=${encodeURIComponent(testUser)}` : "/api/ad-click";
    fetch(clickUrl, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adId: ad.id,
        adName: ad.name,
        linkUrl: ad.linkUrl,
        placement: ad.placement,
        audience: ad.audience,
        userAgent: window.navigator.userAgent
      })
    }).catch(() => {});
  }

  return (
    <a
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`Visit ${ad.name}`}
      onClick={recordAdvertClick}
      className="block overflow-hidden rounded-lg bg-[#071426] shadow-card ring-1 ring-[#eeeaf2] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
    >
      <img
        src={ad.imagePath}
        alt={ad.altText}
        className="h-auto w-full object-cover"
        loading="lazy"
      />
    </a>
  );
}

function PageContent({
  activePage,
  activeTeam,
  standingsData,
  allStandingsData,
  playerBreakStat,
  playerGameResults,
  matchResults,
  allMatchResults,
  appearance,
  userCanShare,
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
  playerBreakStat: PlayerBreakStat | null;
  playerGameResults: PlayerGameResult[];
  matchResults: MatchResult[];
  allMatchResults: MatchResult[];
  appearance: RoleAppearance;
  userCanShare: boolean;
  onNavigate: (page: AppPage) => void;
  onOpenFixture: (fixtureId: string) => void;
  selectedFixtureId: string;
  onSignOut?: () => void;
  userLabel?: string;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const leagueTeamCount = standingsData.length;
  const memberRestrictedPages: AppPage[] = ["Match", "Results", "Players", "Stats"];

  if (activeTeam.role === "Club Member" && memberRestrictedPages.includes(activePage)) {
    return <ClubMemberHome activeTeam={activeTeam} onNavigate={onNavigate} panels={appearance.panels} />;
  }

  if (activePage === "Club") return <ClubHubPage activeTeam={activeTeam} onNavigate={onNavigate} />;
  if (activePage === "Ladder") return <ClubLadderPage activeTeam={activeTeam} />;
  if (activePage === "Bookings") return <TableBookings activeTeam={activeTeam} />;
  if (activePage === "Competitions") return <CompetitionsPage activeTeam={activeTeam} />;
  if (activePage === "Contacts") return <ContactsPage activeTeam={activeTeam} />;
  if (activePage === "Friendlies") {
    return (
      <FriendliesPage
        activeTeam={activeTeam}
        onDataRefresh={onDataRefresh}
        onTeamSummaryUpdate={onTeamSummaryUpdate}
      />
    );
  }
  if (activePage === "Fixtures") {
    return (
      <FixturesPage
        activeTeam={activeTeam}
        matchResults={matchResults}
        leagueTeamCount={leagueTeamCount}
        onOpenFixture={onOpenFixture}
        userCanShare={userCanShare}
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
  if (activePage === "Results") return <ResultsPage activeTeam={activeTeam} playerGameResults={playerGameResults} matchResults={matchResults} userCanShare={userCanShare} />;
  if (activePage === "Table") return <TablesPage activeTeam={activeTeam} standingsData={allStandingsData} matchResults={allMatchResults} userCanShare={userCanShare} />;
  if (activePage === "Players") return <PlayersPage activeTeam={activeTeam} playerGameResults={playerGameResults} />;
  if (activePage === "Stats") return <StatsPage activeTeam={activeTeam} playerBreakStat={playerBreakStat} playerGameResults={playerGameResults} matchResults={matchResults} leagueTeamCount={leagueTeamCount} userCanShare={userCanShare} />;
  if (activePage === "Messages") return <MessagesPage activeTeam={activeTeam} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activePage === "Shop") return <ShopPage activeTeam={activeTeam} />;
  if (activePage === "Last Man Standing") return <LastManStandingPage />;
  if (activePage === "Menu") return <MoreMenu activeTeam={activeTeam} menuItems={appearance.menuItems} onNavigate={onNavigate} />;
  if (activePage === "Interclub Leagues") return <InterclubLeaguesPage activeTeam={activeTeam} standingsData={allStandingsData} matchResults={allMatchResults} onNavigate={onNavigate} userCanShare={userCanShare} />;
  if (activeTeam.role === "Manager") return <ManagerHome activeTeam={activeTeam} matchResults={matchResults} onNavigate={onNavigate} onOpenFixture={onOpenFixture} leagueTeamCount={leagueTeamCount} panels={appearance.panels} onDataRefresh={onDataRefresh} onTeamSummaryUpdate={onTeamSummaryUpdate} userCanShare={userCanShare} />;
  if (isClubOnlyRole(activeTeam.role)) return <ClubMemberHome activeTeam={activeTeam} onNavigate={onNavigate} panels={appearance.panels} />;
  return <PlayerHome activeTeam={activeTeam} standingsData={standingsData} playerBreakStat={playerBreakStat} playerGameResults={playerGameResults} matchResults={matchResults} onNavigate={onNavigate} onOpenFixture={onOpenFixture} leagueTeamCount={leagueTeamCount} panels={appearance.panels} userCanShare={userCanShare} />;
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
  simulatedRole: Role;
  simulatedClub: string;
  userLabel?: string;
  onRoleChange: (role: Role) => void;
  onClubChange: (club: string) => void;
  onSignOut?: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full overflow-visible bg-[#10233f] px-4 py-3 text-white shadow-elevated sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1440px] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.16)] ring-1 ring-white/25">
              <img src="/icons/icon-192.png" alt="Interclub Snooker" className="h-full w-full rounded-lg object-contain" />
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
          <AccountMenu userLabel={userLabel} onSignOut={onSignOut} accountOpen={accountOpen} setAccountOpen={setAccountOpen} />
        </div>
        <div className="grid min-w-0 w-full gap-2 sm:w-[270px]">
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
      </div>
    </header>
  );
}

function AccountMenu({
  userLabel,
  onSignOut,
  accountOpen,
  setAccountOpen
}: {
  userLabel?: string;
  onSignOut?: () => void;
  accountOpen: boolean;
  setAccountOpen: (updater: boolean | ((open: boolean) => boolean)) => void;
}) {
  if (!userLabel) return null;

  return (
    <div className="relative z-[120] shrink-0">
      <button
        type="button"
        onClick={() => setAccountOpen((open) => !open)}
        className="flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-2.5 text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6] sm:min-h-11 sm:px-3"
        aria-haspopup="menu"
        aria-expanded={accountOpen}
        aria-label="Account menu"
      >
        <UserCircle className="h-5 w-5 shrink-0" />
        <span className="hidden max-w-[180px] truncate text-sm font-bold md:block">{userLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
      </button>
      {accountOpen ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[130] w-64 rounded-xl bg-white p-2 text-[#10233f] shadow-elevated ring-1 ring-[#eeeaf2]" role="menu">
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
  );
}

function contextLabel(context: TeamContext) {
  if (context.role === "Club Member") return `${context.club.replace(" Golf Club", "")} - Member`;
  if (context.role === "Club Admin") return `${context.club.replace(" Golf Club", "")} - Club Admin`;
  if (context.role === "League Chair") return "Interclub League Chair";
  return `${context.name} - ${context.role}`;
}

function contextDescription(context: TeamContext) {
  if (isClubOnlyRole(context.role)) {
    if (context.role === "Club Admin") return "Club administration";
    if (context.role === "League Chair") return "League chair access";
    return "Club access";
  }
  return `${context.league} - ${context.club.replace(" Golf Club", "")}`;
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
  const uniqueContexts = [activeTeam, ...contexts].filter((context, index, list) => {
    const key = `${context.role}|${normalizeLookupKey(context.name)}|${normalizeLookupKey(context.club)}`;
    return list.findIndex((item) => `${item.role}|${normalizeLookupKey(item.name)}|${normalizeLookupKey(item.club)}` === key) === index;
  });
  const embeddedDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";
  const hasMultipleRoles = new Set(uniqueContexts.map((context) => context.role)).size > 1;
  const canSwitchContext = embeddedDemo ? uniqueContexts.length > 1 : hasMultipleRoles;

  if (!canSwitchContext) {
    return (
      <div className="min-h-11 rounded-xl bg-white/95 px-4 py-2 text-[#10233f] shadow-card">
        <p className="truncate text-sm font-extrabold">{contextLabel(activeTeam)}</p>
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
        {uniqueContexts.map((context) => (
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

function PwaPullToRefresh({ onRefresh }: { onRefresh: () => void }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const threshold = 82;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!isPwaContainer()) return;

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 0 || event.touches.length !== 1) return;
      startYRef.current = event.touches[0].clientY;
      trackingRef.current = true;
    }

    function onTouchMove(event: TouchEvent) {
      if (!trackingRef.current || startYRef.current == null || window.scrollY > 0) return;
      const distance = Math.max(0, event.touches[0].clientY - startYRef.current);
      if (distance < 8) return;
      const nextDistance = Math.min(120, distance * 0.55);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    }

    function onTouchEnd() {
      if (!trackingRef.current) return;
      const shouldRefresh = pullDistanceRef.current >= threshold;
      trackingRef.current = false;
      startYRef.current = null;
      pullDistanceRef.current = 0;
      if (!shouldRefresh) {
        setPullDistance(0);
        return;
      }
      setRefreshing(true);
      setPullDistance(threshold);
      onRefreshRef.current();
      window.setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 650);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (!pullDistance && !refreshing) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-3 z-[80] flex justify-center transition-transform"
      style={{ transform: `translateY(${Math.max(0, pullDistance - 42)}px)` }}
      aria-live="polite"
    >
      <div className="rounded-xl bg-[#10233f] px-4 py-2 text-xs font-extrabold uppercase text-white shadow-elevated ring-1 ring-white/15">
        {refreshing ? "Refreshing" : pullDistance >= threshold ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
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

function MatchdayHero({ activeTeam, userLabel, leagueTeamCount, interclubView = false, activeMatchCount = 0 }: { activeTeam: TeamContext; userLabel?: string; leagueTeamCount: number; interclubView?: boolean; activeMatchCount?: number }) {
  const manager = activeTeam.role === "Manager";
  const clubMember = isClubOnlyRole(activeTeam.role);
  const hasTeamActivity = teamHasActivity(activeTeam);
  const played = activeTeam.leagueMatchesPlayed ?? 0;
  const won = activeTeam.matchesWon ?? 0;
  const points = activeTeam.leaguePoints ?? activeTeam.pointsFor ?? 0;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount, activeTeam.league);
  return (
    <section className="min-w-0 overflow-hidden rounded-[18px] text-white shadow-card">
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
        <div className="relative grid gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <ClubLogoTile club={activeTeam.club} logoPath={activeTeam.logoPath} size="hero" />
            <div className="min-w-0 flex-1">
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
              <h2 className="mt-1 whitespace-normal text-3xl font-extrabold leading-tight [overflow-wrap:normal] sm:text-4xl xl:text-5xl">{activeTeam.name}</h2>
              <p className="mt-2 text-sm font-semibold text-white/80">{activeTeam.club}</p>
              {userLabel ? (
                <p className="mt-1 truncate text-xs font-bold text-white/65">
                  Signed in: {userLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <HeroMetric label="Played" value={hasTeamActivity ? String(played) : "-"} />
            <HeroMetric label="Matches Won" value={hasTeamActivity ? String(won) : "-"} />
            <HeroMetric label="Pts" value={hasTeamActivity ? String(points) : "-"} />
          </div>
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

function ClubMemberHero({ activeTeam, userLabel }: { activeTeam: TeamContext; userLabel?: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[18px] text-white shadow-card">
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
            <h2 className="mt-1 break-words text-3xl font-extrabold leading-tight sm:text-4xl xl:text-5xl">{activeTeam.club}</h2>
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

function fixtureDateHasPassed(date: string | null | undefined) {
  return Boolean(date && date.slice(0, 10) < localIsoDate());
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

type QualificationStatus = "final" | "semi" | "prelim" | "none";

function qualificationStatus(position: number, teamCount: number, league?: TeamContext["league"]): QualificationStatus {
  if (!position) return "none";
  if (league === "C League") {
    if (position <= 2) return "semi";
    return position <= 6 ? "prelim" : "none";
  }
  if (!teamCount) return "none";
  if (teamCount >= 7) return position <= 4 ? "semi" : "none";
  if (teamCount >= 5) {
    if (position === 1) return "final";
    return position <= 3 ? "semi" : "none";
  }
  return "none";
}

function qualificationBadgeVariant(status: QualificationStatus) {
  if (status === "final") return "gold";
  if (status === "semi" || status === "prelim") return "green";
  return "muted";
}

function qualificationPositionColors(status: QualificationStatus) {
  if (status === "final") return { background: "#ffb000", color: "#25002b" };
  if (status === "semi") return { background: "#00ff85", color: "#071426" };
  if (status === "prelim") return { background: "#04f5ff", color: "#071426" };
  return { background: "#eeeaf2", color: "#25002b" };
}

function qualificationLabel(status: QualificationStatus) {
  if (status === "final") return "Final";
  if (status === "semi") return "Semi";
  if (status === "prelim") return "Prelim";
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

function isManagerRole(role: Role) {
  return role === "Manager";
}

function svgEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateForShare(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;
}

const shareVisualWidth = 720;
const shareVisualPadding = 32;
const shareVisualContentWidth = shareVisualWidth - shareVisualPadding * 2;
const shareVisualHeaderRadius = 10;

function imageBlobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Unable to create image."));
    }, "image/png", 0.95);
  });
}

async function svgToPngBlob(svg: string) {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to render shared image."));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || shareVisualWidth;
    canvas.height = image.naturalHeight || shareVisualWidth;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable.");

    context.fillStyle = "#f3f6f8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return imageBlobFromCanvas(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function shareSvgVisual(filename: string, title: string, svg: string) {
  const pngFilename = filename.replace(/\.svg$/i, ".png");
  let blob: Blob;
  let downloadFilename = pngFilename;
  let mimeType = "image/png";

  try {
    blob = await svgToPngBlob(svg);
  } catch {
    blob = new Blob([svg], { type: "image/svg+xml" });
    downloadFilename = filename;
    mimeType = "image/svg+xml";
  }

  const file = new File([blob], downloadFilename, { type: mimeType });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ title, files: [file] });
    } catch {
      // If native sharing is available but cancelled/refused, do not open a second download prompt.
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const opened = window.open("", "_blank", "noopener,noreferrer");
  if (opened) {
    opened.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${svgEscape(title)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef2f6; font-family: Inter, Arial, sans-serif; }
            main { width: min(100%, 720px); padding: 16px; box-sizing: border-box; }
            img { width: 100%; height: auto; display: block; border-radius: 20px; box-shadow: 0 24px 70px rgba(16, 35, 63, .22); }
            a { display: flex; min-height: 44px; align-items: center; justify-content: center; margin-top: 12px; border-radius: 12px; background: #10233f; color: white; text-decoration: none; font-weight: 800; }
          </style>
        </head>
        <body>
          <main>
            <img src="${url}" alt="${svgEscape(title)}" />
            <a href="${url}" download="${svgEscape(downloadFilename)}">Download visual</a>
          </main>
        </body>
      </html>
    `);
    opened.document.close();
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFilename;
    link.click();
  }
}

function buildWeekResultsShareSvg(activeTeam: TeamContext, week: FixtureWeek) {
  const width = shareVisualWidth;
  const rowHeight = 126;
  const shareRows = [
    ...week.postponedFixtures.map((fixture) => ({
      homeTeamName: fixture.homeTeamName,
      awayTeamName: fixture.awayTeamName,
      homeTeamScore: null,
      awayTeamScore: null,
      completedGames: 0,
      status: "Postponed",
      postponed: true
    })),
    ...week.fixtures.map((fixture) => ({
      homeTeamName: fixture.homeTeamName,
      awayTeamName: fixture.awayTeamName,
      homeTeamScore: fixture.homeTeamScore,
      awayTeamScore: fixture.awayTeamScore,
      completedGames: fixture.completedGames,
      status: fixture.status,
      postponed: false
    }))
  ];
  const height = 286 + Math.max(shareRows.length, 1) * rowHeight;
  const rows = shareRows.map((fixture, index) => {
    const y = 222 + index * rowHeight;
    const home = teamColors(fixture.homeTeamName);
    const away = teamColors(fixture.awayTeamName);
    const postponed = fixture.postponed;
    const hasScore = !postponed && fixture.homeTeamScore !== null && fixture.awayTeamScore !== null && (fixture.status === "Completed" || fixture.completedGames > 0);
    const score = postponed ? "POSTPONED" : hasScore ? `${fixture.homeTeamScore}-${fixture.awayTeamScore}` : "v";
    const scoreBoxWidth = postponed ? 128 : 98;
    const scoreBoxX = 656 - scoreBoxWidth;
    const scoreTextX = scoreBoxX + scoreBoxWidth / 2;
    const scoreFontSize = postponed ? 17 : 27;
    const scoreFill = postponed ? "#eef2f6" : "#10233f";
    const scoreTextFill = postponed ? "#10233f" : "#ffffff";
    const homeWon = hasScore && Number(fixture.homeTeamScore) > Number(fixture.awayTeamScore);
    const awayWon = hasScore && Number(fixture.awayTeamScore) > Number(fixture.homeTeamScore);

    return `
      <rect x="${shareVisualPadding}" y="${y}" width="${shareVisualContentWidth}" height="108" rx="20" fill="${index % 2 ? "#ffffff" : "#f5f7fb"}" stroke="#dfe7ee" />
      <rect x="${shareVisualPadding}" y="${y}" width="7" height="108" rx="4" fill="${home.primaryColor}" />
      <circle cx="62" cy="${y + 33}" r="7" fill="${home.primaryColor}" />
      <text x="80" y="${y + 41}" font-size="24" font-weight="800" fill="${homeWon ? "#007a3d" : home.primaryColor}">${svgEscape(truncateForShare(fixture.homeTeamName, 28))}</text>
      <circle cx="62" cy="${y + 78}" r="7" fill="${away.primaryColor}" />
      <text x="80" y="${y + 86}" font-size="24" font-weight="800" fill="${awayWon ? "#007a3d" : away.primaryColor}">${svgEscape(truncateForShare(fixture.awayTeamName, 28))}</text>
      <rect x="${scoreBoxX}" y="${y + 30}" width="${scoreBoxWidth}" height="48" rx="14" fill="${scoreFill}" stroke="${postponed ? "#dfe7ee" : scoreFill}" />
      <text x="${scoreTextX}" y="${y + 63}" text-anchor="middle" font-size="${scoreFontSize}" font-weight="850" fill="${scoreTextFill}">${svgEscape(score)}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <defs>
        <linearGradient id="hero" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${svgEscape(activeTeam.primaryColor)}" />
          <stop offset=".62" stop-color="${svgEscape(activeTeam.accentColor)}" />
          <stop offset="1" stop-color="#071426" />
        </linearGradient>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" />
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect x="0" y="0" width="${width}" height="176" rx="${shareVisualHeaderRadius}" fill="url(#hero)" />
      <rect x="0" y="0" width="${width}" height="176" rx="${shareVisualHeaderRadius}" fill="url(#grid)" />
      <text x="${shareVisualPadding}" y="58" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="104" font-size="36" font-weight="850" fill="#ffffff">Fixtures / Results</text>
      <text x="${shareVisualPadding}" y="142" font-size="20" font-weight="650" fill="rgba(255,255,255,.86)">${svgEscape(activeTeam.league)} • ${svgEscape(week.weekLabel)} • ${svgEscape(formatFixtureDate(week.startsOn))}</text>
      <rect x="516" y="44" width="140" height="44" rx="14" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.28)" />
      <text x="586" y="73" text-anchor="middle" font-size="18" font-weight="800" fill="#ffffff">${svgEscape(activeTeam.season)}</text>
      ${rows}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildLeagueTableShareSvg(activeTeam: TeamContext, tableRows: Standing[], matchResults: MatchResult[]) {
  const width = shareVisualWidth;
  const rowHeight = 86;
  const height = 286 + Math.max(tableRows.length, 1) * rowHeight;
  const rows = tableRows.map((row, index) => {
    const y = 220 + index * rowHeight;
    const diff = row.pointsFor - row.pointsAgainst;
    const colors = teamColors(row.team);
    const qualification = qualificationStatus(row.position, tableRows.length, activeTeam.league);
    const positionColors = qualificationPositionColors(qualification);
    const activeFill = row.team === activeTeam.name ? "#eef4ff" : index % 2 ? "#ffffff" : "#f7f9fc";

    return `
      <rect x="${shareVisualPadding}" y="${y}" width="${shareVisualContentWidth}" height="72" rx="16" fill="${activeFill}" stroke="#dfe7ee" />
      <rect x="${shareVisualPadding}" y="${y}" width="7" height="72" rx="4" fill="${colors.primaryColor}" />
      <rect x="56" y="${y + 16}" width="40" height="40" rx="12" fill="${positionColors.background}" />
      <text x="76" y="${y + 43}" text-anchor="middle" font-size="19" font-weight="850" fill="${positionColors.color}">${row.position}</text>
      <text x="116" y="${y + 35}" font-size="23" font-weight="850" fill="${colors.primaryColor}">${svgEscape(truncateForShare(row.team, 22))}</text>
      <text x="116" y="${y + 58}" font-size="15" font-weight="750" fill="#6c7788">${svgEscape(tableForm(row, matchResults))}</text>
      <text x="444" y="${y + 32}" text-anchor="end" font-size="16" font-weight="800" fill="#6c7788">P</text>
      <text x="444" y="${y + 58}" text-anchor="end" font-size="24" font-weight="850" fill="#10233f">${row.played}</text>
      <text x="532" y="${y + 32}" text-anchor="end" font-size="16" font-weight="800" fill="#6c7788">DIFF</text>
      <text x="532" y="${y + 58}" text-anchor="end" font-size="24" font-weight="850" fill="#10233f">${diff > 0 ? `+${diff}` : diff}</text>
      <text x="650" y="${y + 32}" text-anchor="end" font-size="16" font-weight="800" fill="#6c7788">PTS</text>
      <text x="650" y="${y + 59}" text-anchor="end" font-size="30" font-weight="900" fill="#10233f">${row.leaguePoints}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <defs>
        <linearGradient id="hero" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${svgEscape(activeTeam.primaryColor)}" />
          <stop offset=".62" stop-color="${svgEscape(activeTeam.accentColor)}" />
          <stop offset="1" stop-color="#071426" />
        </linearGradient>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" />
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect x="0" y="0" width="${width}" height="176" rx="${shareVisualHeaderRadius}" fill="url(#hero)" />
      <rect x="0" y="0" width="${width}" height="176" rx="${shareVisualHeaderRadius}" fill="url(#grid)" />
      <text x="${shareVisualPadding}" y="58" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="108" font-size="39" font-weight="850" fill="#ffffff">${svgEscape(activeTeam.league)} Table</text>
      <text x="${shareVisualPadding}" y="146" font-size="20" font-weight="650" fill="rgba(255,255,255,.84)">${svgEscape(activeTeam.season)}</text>
      ${rows}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildPersonalStatsShareSvg(activeTeam: TeamContext, playerBreakStat: PlayerBreakStat | null, results: PlayerGameResult[]) {
  const width = shareVisualWidth;
  const height = 718;
  const wins = results.filter((result) => result.result === "Won").length;
  const losses = results.filter((result) => result.result === "Lost").length;
  const played = results.length;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const form = results.slice(0, RECENT_FORM_LIMIT).map((result) => result.result === "Won" ? "W" : "L").join(" ") || "-";
  const stats = [
    ["Played", played || "-"],
    ["Won", wins || "-"],
    ["Lost", losses || "-"],
    ["Win rate", played ? `${winRate}%` : "-"],
    ["High break", playerBreakStat?.highestBreak ?? "-"],
    ["Recent form", form]
  ];
  const statCards = stats.map(([label, value], index) => {
    const x = shareVisualPadding + (index % 2) * 334;
    const y = 274 + Math.floor(index / 2) * 116;
    return `
      <rect x="${x}" y="${y}" width="304" height="92" rx="18" fill="${index % 2 ? "#ffffff" : "#f7f9fc"}" stroke="#dfe7ee" />
      <text x="${x + 22}" y="${y + 34}" font-size="15" font-weight="750" fill="#6c7788" letter-spacing="1.2">${svgEscape(String(label).toUpperCase())}</text>
      <text x="${x + 22}" y="${y + 70}" font-size="31" font-weight="850" fill="#10233f">${svgEscape(value)}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <defs>
        <linearGradient id="hero" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${svgEscape(activeTeam.primaryColor)}" />
          <stop offset=".62" stop-color="${svgEscape(activeTeam.accentColor)}" />
          <stop offset="1" stop-color="#071426" />
        </linearGradient>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" />
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect width="${width}" height="210" rx="${shareVisualHeaderRadius}" fill="url(#hero)" />
      <rect width="${width}" height="210" rx="${shareVisualHeaderRadius}" fill="url(#grid)" />
      <text x="${shareVisualPadding}" y="62" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="119" font-size="42" font-weight="850" fill="#ffffff">Player Stats</text>
      <text x="${shareVisualPadding}" y="158" font-size="21" font-weight="650" fill="rgba(255,255,255,.84)">${svgEscape(activeTeam.name)} • ${svgEscape(activeTeam.season)}</text>
      ${statCards}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildIndividualGamesShareSvg(activeTeam: TeamContext, results: PlayerGameResult[]) {
  const width = shareVisualWidth;
  const visible = results.slice(0, 8);
  const rowHeight = 108;
  const height = 282 + Math.max(visible.length, 1) * rowHeight;
  const rows = visible.map((game, index) => {
    const y = 210 + index * rowHeight;
    const matchup = personalGameMatchupLabel(game);
    const resultFill = game.result === "Won" ? "#00ff85" : "#f7d7df";
    const resultText = game.result === "Won" ? "#071426" : "#8d1534";
    return `
      <rect x="${shareVisualPadding}" y="${y}" width="${shareVisualContentWidth}" height="92" rx="18" fill="${index % 2 ? "#ffffff" : "#f7f9fc"}" stroke="#dfe7ee" />
      <text x="58" y="${y + 38}" font-size="23" font-weight="850" fill="#10233f">${svgEscape(truncateForShare(matchup.title, 34))}</text>
      <text x="58" y="${y + 66}" font-size="16" font-weight="650" fill="#6c7788">${svgEscape(`${game.sourceWeek} • Game ${game.gameNumber}${matchup.detail ? ` • ${matchup.detail}` : ""}`)}</text>
      <rect x="568" y="${y + 26}" width="104" height="40" rx="12" fill="${resultFill}" />
      <text x="620" y="${y + 52}" text-anchor="middle" font-size="17" font-weight="850" fill="${resultText}">${svgEscape(game.result)}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect x="0" y="0" width="${width}" height="166" rx="${shareVisualHeaderRadius}" fill="${svgEscape(activeTeam.primaryColor)}" />
      <text x="${shareVisualPadding}" y="58" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="110" font-size="40" font-weight="850" fill="#ffffff">Individual Games</text>
      <text x="${shareVisualPadding}" y="145" font-size="19" font-weight="650" fill="rgba(255,255,255,.84)">${svgEscape(activeTeam.name)} • ${svgEscape(activeTeam.season)}</text>
      ${rows}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildTeamStatsShareSvg(activeTeam: TeamContext, leagueTeamCount: number) {
  const width = shareVisualWidth;
  const height = 650;
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount, activeTeam.league);
  const hasLeagueTable = teamHasActivity(activeTeam);
  const stats = [
    ["Played", activeTeam.leagueMatchesPlayed || "-"],
    ["Matches won", activeTeam.matchesWon ?? "-"],
    ["Points", activeTeam.leaguePoints ?? activeTeam.pointsFor ?? "-"],
    ["Position", hasLeagueTable ? ordinal(activeTeam.leaguePosition) : "-"],
    ["For", activeTeam.pointsFor ?? "-"],
    ["Against", activeTeam.pointsAgainst ?? "-"]
  ];
  const statCards = stats.map(([label, value], index) => {
    const x = shareVisualPadding + (index % 2) * 334;
    const y = 286 + Math.floor(index / 2) * 104;
    return `
      <rect x="${x}" y="${y}" width="304" height="82" rx="17" fill="#ffffff" stroke="#dfe7ee" />
      <text x="${x + 22}" y="${y + 32}" font-size="14" font-weight="750" fill="#6c7788" letter-spacing="1.1">${svgEscape(String(label).toUpperCase())}</text>
      <text x="${x + 22}" y="${y + 64}" font-size="30" font-weight="850" fill="#10233f">${svgEscape(value)}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <defs>
        <linearGradient id="hero" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${svgEscape(activeTeam.primaryColor)}" />
          <stop offset=".64" stop-color="${svgEscape(activeTeam.accentColor)}" />
          <stop offset="1" stop-color="#071426" />
        </linearGradient>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" />
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect width="${width}" height="218" rx="${shareVisualHeaderRadius}" fill="url(#hero)" />
      <rect width="${width}" height="218" rx="${shareVisualHeaderRadius}" fill="url(#grid)" />
      <text x="${shareVisualPadding}" y="62" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="119" font-size="42" font-weight="850" fill="#ffffff">${svgEscape(truncateForShare(activeTeam.name, 18))} Stats</text>
      <text x="${shareVisualPadding}" y="158" font-size="21" font-weight="650" fill="rgba(255,255,255,.84)">${svgEscape(activeTeam.league)} • ${svgEscape(activeTeam.season)}</text>
      <rect x="514" y="42" width="142" height="42" rx="13" fill="${qualification === "none" ? "rgba(255,255,255,.16)" : "#00ff85"}" />
      <text x="585" y="70" text-anchor="middle" font-size="17" font-weight="850" fill="${qualification === "none" ? "#ffffff" : "#071426"}">${svgEscape(hasLeagueTable ? qualificationLabel(qualification) : "Pending")}</text>
      ${statCards}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildTeamPlayerStatsShareSvg(activeTeam: TeamContext, players: TeamPlayerStat[]) {
  const width = shareVisualWidth;
  const visible = players.slice(0, 14);
  const rowHeight = 92;
  const height = 286 + Math.max(visible.length, 1) * rowHeight;
  const rows = visible.map((player, index) => {
    const y = 210 + index * rowHeight;
    return `
      <rect x="${shareVisualPadding}" y="${y}" width="${shareVisualContentWidth}" height="76" rx="16" fill="${index % 2 ? "#ffffff" : "#f7f9fc"}" stroke="#dfe7ee" />
      <text x="58" y="${y + 34}" font-size="22" font-weight="850" fill="${svgEscape(activeTeam.primaryColor)}">${svgEscape(truncateForShare(player.name, 24))}</text>
      <text x="58" y="${y + 59}" font-size="15" font-weight="750" fill="#6c7788">P ${player.played}  •  W ${player.won}  •  L ${player.lost}</text>
      <text x="522" y="${y + 33}" text-anchor="end" font-size="14" font-weight="750" fill="#6c7788">WIN</text>
      <text x="522" y="${y + 60}" text-anchor="end" font-size="25" font-weight="900" fill="#10233f">${player.played ? `${player.winPercentage}%` : "-"}</text>
      <text x="646" y="${y + 33}" text-anchor="end" font-size="14" font-weight="750" fill="#6c7788">BREAK</text>
      <text x="646" y="${y + 60}" text-anchor="end" font-size="25" font-weight="900" fill="#10233f">${player.highestBreak ?? "-"}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect x="0" y="0" width="${width}" height="166" rx="${shareVisualHeaderRadius}" fill="${svgEscape(activeTeam.primaryColor)}" />
      <text x="${shareVisualPadding}" y="58" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="108" font-size="37" font-weight="850" fill="#ffffff">${svgEscape(truncateForShare(activeTeam.name, 17))} Players</text>
      <text x="${shareVisualPadding}" y="144" font-size="19" font-weight="650" fill="rgba(255,255,255,.84)">${svgEscape(activeTeam.season)} • ${svgEscape(activeTeam.league)}</text>
      ${rows}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
}

function buildLeaguePlayerStatsShareSvg(activeTeam: TeamContext, players: LeaguePlayerStat[]) {
  const width = shareVisualWidth;
  const visible = players.slice(0, 14);
  const rowHeight = 94;
  const height = 304 + Math.max(visible.length, 1) * rowHeight;
  const rows = visible.map((player, index) => {
    const y = 226 + index * rowHeight;
    const colors = teamColors(player.teamName);
    return `
      <rect x="${shareVisualPadding}" y="${y}" width="${shareVisualContentWidth}" height="78" rx="16" fill="${index % 2 ? "#ffffff" : "#f7f9fc"}" stroke="#dfe7ee" />
      <rect x="${shareVisualPadding}" y="${y}" width="7" height="78" rx="4" fill="${colors.primaryColor}" />
      <text x="58" y="${y + 32}" font-size="21" font-weight="850" fill="${colors.primaryColor}">${svgEscape(truncateForShare(player.name, 23))}</text>
      <text x="58" y="${y + 58}" font-size="15" font-weight="750" fill="${colors.primaryColor}">${svgEscape(truncateForShare(player.teamName, 22))} • P ${player.played} • W ${player.won} • L ${player.lost}</text>
      <text x="526" y="${y + 32}" text-anchor="end" font-size="14" font-weight="750" fill="#6c7788">WIN</text>
      <text x="526" y="${y + 60}" text-anchor="end" font-size="25" font-weight="900" fill="#10233f">${player.played ? `${player.winPercentage}%` : "-"}</text>
      <text x="650" y="${y + 32}" text-anchor="end" font-size="14" font-weight="750" fill="#6c7788">BREAK</text>
      <text x="650" y="${y + 60}" text-anchor="end" font-size="25" font-weight="900" fill="#10233f">${player.highestBreak ?? "-"}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Avenir Next, Helvetica Neue, Arial, sans-serif">
      <rect width="${width}" height="${height}" rx="32" fill="#f3f6f8" />
      <rect x="0" y="0" width="${width}" height="184" rx="${shareVisualHeaderRadius}" fill="${svgEscape(activeTeam.primaryColor)}" />
      <text x="${shareVisualPadding}" y="58" font-size="17" font-weight="750" fill="rgba(255,255,255,.72)" letter-spacing="2.4">INTERCLUB SNOOKER</text>
      <text x="${shareVisualPadding}" y="110" font-size="37" font-weight="850" fill="#ffffff">${svgEscape(activeTeam.league)} Player Stats</text>
      <text x="${shareVisualPadding}" y="148" font-size="18" font-weight="650" fill="rgba(255,255,255,.84)">Ranked by win percentage • ${svgEscape(activeTeam.season)}</text>
      ${rows}
      <text x="${shareVisualPadding}" y="${height - 34}" font-size="16" font-weight="700" fill="#6c7788">interclubsnooker.com</text>
    </svg>
  `;
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
      <ClubFeatureUnavailable
        icon={CalendarPlus}
        eyebrow="Table bookings"
        title="Table bookings are not set up yet."
        description="Once a club administrator enables bookings, members can view availability and reserve tables here."
        primaryColor={activeTeam.primaryColor}
        accentColor={activeTeam.accentColor}
      />
    );
  }

  const loadBookings = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(withTestUser(`/api/table-bookings?date=${bookingDate}`), { credentials: "same-origin" });
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
      const response = await fetch(withTestUser("/api/table-bookings"), {
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
      const response = await fetch(withTestUser(`/api/table-bookings/${booking.id}`), {
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
  entryClosesAt: string | null;
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
  if (competition.status === "Open") return `Entries close ${competitionCloseDateText(competition)}`;
  return competition.status;
}

function competitionCloseDate(competition: CompetitionSummary | CompetitionDetail) {
  return typeof competition.entryClosesAt === "string" ? competition.entryClosesAt.slice(0, 10) : "";
}

function competitionCloseDateText(competition: CompetitionSummary | CompetitionDetail) {
  const closeDate = competitionCloseDate(competition);
  return closeDate ? formatFixtureDate(closeDate) : "date to be confirmed";
}

function competitionEntryClosed(competition: CompetitionSummary | CompetitionDetail) {
  const closeDate = competitionCloseDate(competition);
  return Boolean(closeDate) && closeDate < localIsoDate();
}

function shortClubDisplayName(clubName: string) {
  return clubName
    .replace(" Golf Club", "")
    .replace(" Lawn Tennis Club", "");
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
    fetch(withCompetitionContext("/api/competitions", activeTeam), { credentials: "same-origin" })
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
  }, [activeTeam.club]);

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
      const response = await fetch(withCompetitionContext("/api/competitions", activeTeam), { credentials: "same-origin" });
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
    const response = await fetch(withCompetitionContext(`/api/competitions/${competitionId}`, activeTeam), { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Competition unavailable.");
    setDetail(data.competition);
  }

  useEffect(() => {
    loadCompetitions();
  }, [activeTeam.club]);

  async function competitionAction(path: string, body: Record<string, unknown> = {}, competitionId = selectedId) {
    if (!competitionId) return false;
    try {
      const response = await fetch(withCompetitionContext(`/api/competitions/${competitionId}${path}`, activeTeam), {
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
    if (competitionEntryClosed(competition)) {
      setMessage(`Entries for ${competition.name} closed on ${competitionCloseDateText(competition)}.`);
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
  const enterableCompetitions = orderedCompetitions.filter((competition) => competition.status === "Open" && !competition.isEntered && !competitionEntryClosed(competition) && Boolean(membershipForCompetition(competition)));
  const otherCompetitions = orderedCompetitions.filter((competition) => !competition.isEntered && !enterableCompetitions.some((enterable) => enterable.id === competition.id));

  if (!loading && !message && !competitions.length) {
    return (
      <ClubFeatureUnavailable
        icon={Trophy}
        eyebrow="Club competitions"
        title="No club competitions have been created yet."
        description="Once a club administrator creates a competition, members can enter and follow draws, rounds and results here."
        primaryColor={activeTeam.primaryColor}
        accentColor={activeTeam.accentColor}
      />
    );
  }

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
              const entryClosed = competitionEntryClosed(competition);
              const canEnter = competition.status === "Open" && !competition.isEntered && !entryClosed && Boolean(membership);
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
                        {competition.clubName} - {competition.competitionType} - closes {competitionCloseDateText(competition)}
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
                      <Badge variant={competition.isEntered ? "green" : "muted"}>{competition.isEntered ? "Entered" : entryClosed && competition.status === "Open" ? "Closed" : competition.status}</Badge>
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
          <p className="text-xs font-semibold text-[#6c5a73]">Entries close {competitionCloseDateText(competition)} - {competition.entrantCount} entrants</p>
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
  playerBreakStat,
  playerGameResults,
  matchResults,
  onNavigate,
  onOpenFixture,
  leagueTeamCount,
  panels,
  userCanShare
}: {
  activeTeam: TeamContext;
  standingsData: Standing[];
  playerBreakStat: PlayerBreakStat | null;
  playerGameResults: PlayerGameResult[];
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
  onOpenFixture: (fixtureId: string) => void;
  leagueTeamCount: number;
  panels: AppearancePanelId[];
  userCanShare: boolean;
}) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "matchPlanning") {
      return (
        <div key={panel} className="md:col-span-2">
          <FixtureWeekCarouselCard activeTeam={activeTeam} onOpenFixture={onOpenFixture} userCanShare={userCanShare} />
        </div>
      );
    }
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} userCanShare={userCanShare} />;
    if (panel === "leagueTableSnapshot") return <HomeLeagueTableCard key={panel} activeTeam={activeTeam} standingsData={standingsData} onNavigate={onNavigate} />;
    if (panel === "myStats") {
      return (
        <Fragment key={panel}>
          <PlayerStatCard activeTeam={activeTeam} playerBreakStat={playerBreakStat} playerGameResults={playerGameResults} userCanShare={userCanShare} />
          {playerBreakStat ? <HighBreakSeasonCard activeTeam={activeTeam} breakStat={playerBreakStat} /> : null}
        </Fragment>
      );
    }
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "personalRecentForm") return <PersonalRecentFormCard key={panel} playerGameResults={playerGameResults} />;
    if (panel === "individualGames") return <PlayerGameResultsCard key={panel} activeTeam={activeTeam} results={playerGameResults} userCanShare={userCanShare} />;
    if (panel === "lastManStanding") return <div key={panel} className="md:col-span-2"><LastManStandingHomePanel onOpen={() => onNavigate("Last Man Standing")} /></div>;
    if (panel === "clubLadder") return <ClubLadderHomePanel key={panel} className="md:col-span-2" activeTeam={activeTeam} onOpen={() => onNavigate("Ladder")} />;
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:gap-5">
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
              Book tables, enter club competitions and keep up with club activity.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>At Your Club</CardTitle>
            <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Choose what you want to do.</p>
          </div>
          <Badge variant="cyan">{activeTeam.club.replace(" Golf Club", "")}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <ClubActionTile
            icon={Swords}
            eyebrow="Challenge"
            title="Club Ladders"
            description="View rankings, make challenges and track your form."
            colors={["#10233f", "#1b8a72"]}
            onClick={() => onNavigate("Ladder")}
          />
          <ClubActionTile
            icon={CalendarPlus}
            eyebrow="Tables"
            title="Book a table"
            description="Find a time and reserve your table."
            colors={[activeTeam.primaryColor, activeTeam.accentColor]}
            onClick={() => onNavigate("Bookings")}
          />
          <ClubActionTile
            icon={Trophy}
            eyebrow="Competitions"
            title="Club competitions"
            description="Enter events and follow draws."
            colors={["#25002b", "#6d2c78"]}
            onClick={() => onNavigate("Competitions")}
          />
        </CardContent>
      </Card>
      <ClubTeamsOverview activeTeam={activeTeam} />
      <AttackSnookerGameCard />
    </section>
  );
}

function ClubActionTile({
  icon: Icon,
  eyebrow,
  title,
  description,
  colors,
  onClick
}: {
  icon: typeof Trophy;
  eyebrow: string;
  title: string;
  description: string;
  colors: [string, string];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid min-h-[138px] grid-cols-[48px_1fr] items-start gap-3 overflow-hidden rounded-xl p-4 text-left text-white shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><Icon className="h-6 w-6" /></span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase text-white/60">{eyebrow}</span>
        <span className="mt-1 block text-lg font-black leading-tight">{title}</span>
        <span className="mt-2 block text-xs font-semibold leading-relaxed text-white/75">{description}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-black">Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </span>
    </button>
  );
}

type ClubTeamOverview = {
  teamId: string;
  name: string;
  league: TeamContext["league"];
  season: string;
  logoPath: string;
  primaryColor: string;
  accentColor: string;
  position: number | null;
  matchesPlayed: number;
  points: number;
  playerCount: number;
  managerCount: number;
  nextFixtureDate: string | null;
  nextOpponentName: string | null;
  nextHomeAway: "Home" | "Away" | null;
  people: Array<{
    personId: string;
    name: string;
    role: Role;
  }>;
};

function ClubTeamsOverview({ activeTeam }: { activeTeam: TeamContext }) {
  const [teams, setTeams] = useState<ClubTeamOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    setOpenTeamIds(new Set());
    const params = new URLSearchParams({ club: activeTeam.club });
    if (activeTeam.season && activeTeam.season !== "Club") params.set("season", activeTeam.season);
    fetch(withTestUser(`/api/club/teams?${params.toString()}`), { credentials: "same-origin" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Club teams unavailable.");
        setTeams(data.teams ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Club teams unavailable.");
        setTeams([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam.club, activeTeam.season]);

  function toggleTeam(teamId: string) {
    setOpenTeamIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Club Teams</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">See each {activeTeam.club.replace(" Golf Club", "")} team at a glance.</p>
        </div>
        <Badge variant="muted">{loading ? "Loading" : `${teams.length}`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {teams.map((team) => {
          const open = openTeamIds.has(team.teamId);
          return (
            <div key={team.teamId} className="overflow-hidden rounded-[18px] bg-white ring-1 ring-[#eeeaf2]">
              <button
                type="button"
                onClick={() => toggleTeam(team.teamId)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6] sm:p-4"
                style={clubPanelStyle(team.primaryColor, team.accentColor)}
                aria-expanded={open}
              >
                <ClubLogoTile club={activeTeam.club} logoPath={team.logoPath} size="compact" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="cyan">{team.league}</Badge>
                    {team.position ? <Badge variant="green">Position {ordinal(team.position)}</Badge> : null}
                    <Badge variant="muted">{team.season}</Badge>
                    <Badge variant="soft">{team.playerCount} players</Badge>
                    {team.managerCount ? <Badge variant="soft">{team.managerCount} manager{team.managerCount === 1 ? "" : "s"}</Badge> : null}
                  </div>
                  <h3 className="mt-2 truncate text-xl font-black leading-tight text-white sm:text-2xl">{team.name}</h3>
                  {team.nextOpponentName ? (
                    <p className="mt-1 truncate text-xs font-bold text-white/70">
                      Next: {team.nextHomeAway} v {team.nextOpponentName}
                    </p>
                  ) : null}
                </div>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-white/80 transition-transform", open && "rotate-180")} />
              </button>
              {open ? (
                <div className="grid gap-3 p-3 sm:p-4">
                  <ClubTeamPeopleList team={team} />
                </div>
              ) : null}
            </div>
          );
        })}
        {!teams.length ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            {loading ? "Loading club teams..." : message || "No active teams are available for this club."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ClubTeamPeopleList({ team }: { team: ClubTeamOverview }) {
  const grouped = [
    { label: "Managers", people: team.people.filter((person) => person.role === "Manager") },
    { label: "Players", people: team.people.filter((person) => person.role === "Player") }
  ].filter((group) => group.people.length);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{team.playerCount} players</Badge>
        {team.managerCount ? <Badge variant="muted">{team.managerCount} manager{team.managerCount === 1 ? "" : "s"}</Badge> : null}
      </div>
      {grouped.map((group) => (
        <div key={group.label} className="rounded-xl bg-[#f7f5fa] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase text-[#6c5a73]">{group.label}</p>
            <Badge variant="muted">{group.people.length}</Badge>
          </div>
          <div className="grid gap-1.5">
            {group.people.map((person) => (
              <div key={`${person.personId}-${person.role}`} className="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-[#eeeaf2]">
                <span className="min-w-0 truncate text-sm font-extrabold text-[#10233f]">{person.name}</span>
                {person.role !== "Player" ? <Badge variant="muted">{person.role}</Badge> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!grouped.length ? (
        <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No people are linked to this team yet.</p>
      ) : null}
    </div>
  );
}

function AttackSnookerGameCard() {
  return (
    <Card className="overflow-hidden md:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Games</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Club game formats and house rules.</p>
        </div>
        <Badge variant="green">Attack Snooker</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(320px,0.82fr)_minmax(420px,1.18fr)]">
        <div className="flex overflow-hidden rounded-[18px] bg-[#10233f] ring-1 ring-[#d8d1df] xl:max-h-[720px]">
          <img
            src="/attack-snooker.png"
            alt="Castle Attack Snooker Blitz rules poster"
            className="h-auto w-full object-contain"
            loading="lazy"
          />
        </div>
        <div className="grid gap-3">
          <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle("#10233F", "#146B4C")}>
            <p className="text-xs font-extrabold uppercase text-white/65">Attack Snooker</p>
            <h2 className="mt-1 text-3xl font-black leading-none">Fast frames, no snookers</h2>
            <p className="mt-2 text-sm font-semibold text-white/75">
              Six reds, 10-minute frames, pot-first scoring and one tactical Double call per frame.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:auto-rows-fr">
            {attackSnookerRules.map((rule, index) => (
              <div key={rule} className="grid grid-cols-[34px_1fr] gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#10233f] text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold leading-snug text-[#10233f]">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClubMemberHome({ activeTeam, onNavigate, panels }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; panels: AppearancePanelId[] }) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "lastManStanding") return <div key={panel} className="md:col-span-2"><LastManStandingHomePanel onOpen={() => onNavigate("Last Man Standing")} /></div>;
    if (panel === "clubLadder") return <ClubLadderHomePanel key={panel} className="md:col-span-2" activeTeam={activeTeam} onOpen={() => onNavigate("Ladder")} />;
    if (panel === "clubAccess") {
      return (
        <Card key={panel}>
          <CardHeader>
            <CardTitle>Club Access</CardTitle>
            <Badge variant="cyan">Member</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MiniStat label="Club" value={activeTeam.club.replace(" Golf Club", "")} />
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: "Book a table", page: "Bookings" as AppPage, icon: CalendarPlus },
                { label: "Fixtures", page: "Fixtures" as AppPage, icon: CalendarDays },
                { label: "League tables", page: "Table" as AppPage, icon: Trophy }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => onNavigate(item.page)}
                    className="flex min-h-12 items-center gap-2 rounded-lg bg-[#f7f5fa] px-3 text-left font-extrabold text-[#10233f] ring-1 ring-[#eeeaf2] transition hover:bg-[#eef3f5]"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
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
      {panels.map(renderPanel)}
    </section>
  );
}

function MemberActionsCard({ activeTeam, onNavigate }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void }) {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingCompetitions(true);
    fetch(withCompetitionContext("/api/competitions", activeTeam), { credentials: "same-origin" })
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
  onNavigate,
  userCanShare
}: {
  activeTeam: TeamContext;
  standingsData: Standing[];
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
  userCanShare: boolean;
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
        <CardContent className="grid gap-3">
          <p className="text-sm font-semibold text-[#6c5a73]">
            Follow A, B and C league tables from one place.
          </p>
          {!isClubOnlyRole(activeTeam.role) ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "My fixtures", page: "Fixtures" as AppPage, icon: CalendarDays },
                { label: "My results", page: "Results" as AppPage, icon: ClipboardCheck },
                { label: "All tables", page: "Table" as AppPage, icon: Trophy },
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
            </div>
          ) : null}
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
          <section key={league} className="grid gap-4">
            <LeagueTable activeTeam={contextForLeague} standingsData={leagueStandings} matchResults={leagueResults} userCanShare={userCanShare} />
          </section>
        );
      })}
    </section>
  );
}

function FixturesPage({
  activeTeam,
  onOpenFixture,
  userCanShare,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  matchResults: MatchResult[];
  leagueTeamCount: number;
  onOpenFixture: (fixtureId: string) => void;
  userCanShare: boolean;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const orderedLeagues: TeamContext["league"][] = isClubOnlyRole(activeTeam.role)
    ? leagueOrder
    : [activeTeam.league, ...leagueOrder.filter((league) => league !== activeTeam.league)];

  return (
    <section className="grid gap-5">
      {orderedLeagues.map((league, index) => {
        const leagueContext = {
          ...activeTeam,
          league,
          teamId: league === activeTeam.league ? activeTeam.teamId : ""
        } satisfies TeamContext;

        return (
          <FixtureWeekCarouselCard
            key={`${activeTeam.season}-${league}`}
            activeTeam={leagueContext}
            onOpenFixture={league === activeTeam.league ? onOpenFixture : undefined}
            userCanShare={userCanShare}
            onDataRefresh={onDataRefresh}
            onTeamSummaryUpdate={onTeamSummaryUpdate}
            includeCups={index === 0}
          />
        );
      })}
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
  return (
    <section className="grid gap-4">
      {fixtureId ? (
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

function ResultsPage({ activeTeam, playerGameResults, matchResults, userCanShare }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[]; matchResults: MatchResult[]; userCanShare: boolean }) {
  const playerView = activeTeam.role === "Player";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <LatestTeamResultCard activeTeam={activeTeam} matchResults={matchResults} />
      <SeasonResultsCard activeTeam={activeTeam} results={matchResults} />
      {playerView ? <PlayerGameResultsCard activeTeam={activeTeam} results={playerGameResults} userCanShare={userCanShare} /> : null}
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

function StatsPage({
  activeTeam,
  playerBreakStat,
  playerGameResults,
  matchResults,
  leagueTeamCount,
  userCanShare
}: {
  activeTeam: TeamContext;
  playerBreakStat: PlayerBreakStat | null;
  playerGameResults: PlayerGameResult[];
  matchResults: MatchResult[];
  leagueTeamCount: number;
  userCanShare: boolean;
}) {
  if (activeTeam.role === "Manager") {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <TeamStatsCard activeTeam={activeTeam} onNavigate={() => {}} leagueTeamCount={leagueTeamCount} userCanShare={userCanShare} />
        <ManagerSeasonSnapshot activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />
        <TeamRecentFormCard activeTeam={activeTeam} matchResults={matchResults} />
        <SquadManagementCard activeTeam={activeTeam} userCanShare={userCanShare} />
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlayerStatCard activeTeam={activeTeam} playerBreakStat={playerBreakStat} playerGameResults={playerGameResults} userCanShare={userCanShare} />
      {playerBreakStat ? <HighBreakSeasonCard activeTeam={activeTeam} breakStat={playerBreakStat} /> : null}
      <TeamPositionStrip activeTeam={activeTeam} />
      <PlayerGameResultsCard activeTeam={activeTeam} results={playerGameResults} userCanShare={userCanShare} />
    </section>
  );
}

function TablesPage({ activeTeam, standingsData, matchResults, userCanShare }: { activeTeam: TeamContext; standingsData: Standing[]; matchResults: MatchResult[]; userCanShare: boolean }) {
  const seasonRows = standingsData.filter((row) => row.season === activeTeam.season);
  const orderedLeagues: TeamContext["league"][] = isClubOnlyRole(activeTeam.role)
    ? leagueOrder
    : [
        activeTeam.league,
        ...leagueOrder
          .filter((league) => league !== activeTeam.league)
          .sort((a, b) => a.localeCompare(b))
      ];

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Tables</CardTitle>
          <Badge variant="muted">{activeTeam.season}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-semibold text-[#6c5a73]">
            {isClubOnlyRole(activeTeam.role)
              ? `A, B and C league tables for ${activeTeam.season}.`
              : `${activeTeam.league} is shown first. Other leagues for ${activeTeam.season} follow alphabetically.`}
          </p>
        </CardContent>
      </Card>
      {orderedLeagues.length ? orderedLeagues.map((league) => {
        const leagueStandings = seasonRows.filter((row) => row.league === league);
        const leagueResults = matchResults.filter((result) => result.league === league && result.season === activeTeam.season);
        const contextForLeague = {
          ...activeTeam,
          league
        } satisfies TeamContext;

        return (
          <section key={`${activeTeam.season}-${league}`} className="grid gap-4">
            <LeagueTable
              activeTeam={contextForLeague}
              standingsData={leagueStandings}
              matchResults={leagueResults}
              presentation="section"
              userCanShare={userCanShare}
            />
            {!isClubOnlyRole(activeTeam.role) ? <LeaguePlayerStatsCard activeTeam={contextForLeague} userCanShare={userCanShare} /> : null}
            <LeagueBreaksCard activeTeam={contextForLeague} />
          </section>
        );
      }) : (
        <LeagueTable activeTeam={activeTeam} standingsData={[]} matchResults={[]} presentation="section" userCanShare={userCanShare} />
      )}
      <Card>
        <CardContent className="grid gap-2 p-4 text-xs font-semibold leading-relaxed text-[#6c5a73]">
          <p>
            <span className="font-extrabold uppercase text-[#25002b]">League table order:</span> league points, head-to-head points between tied teams, points difference, matches won, then team name.
          </p>
          <p>
            <span className="font-extrabold uppercase text-[#25002b]">Player stats order:</span> players who can still reach 12 matches first, then win percentage, games won, games played, highest break, then player name.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

type ContactDirectoryEntry = {
  id: string;
  contactType: "League Official" | "Team Contact" | "Club Contact";
  contactLabel: string;
  displayName: string;
  phone: string;
  clubName: string | null;
  clubLogoPath: string | null;
  clubPrimaryColor: string | null;
  clubAccentColor: string | null;
  leagueName: string | null;
  teamName: string | null;
};

function normalizePhoneForHref(phone: string) {
  const compact = phone.replace(/[^\d+]/g, "");
  return compact || phone;
}

function normalizePhoneForWhatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `353${digits.slice(1)}`;
  return digits;
}

function useCanUsePhoneCalls() {
  const [canCall, setCanCall] = useState(false);

  useEffect(() => {
    function update() {
      const userAgent = window.navigator.userAgent;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const smallViewport = window.matchMedia("(max-width: 820px)").matches;
      setCanCall(/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (coarsePointer && smallViewport));
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return canCall;
}

function ContactsPage({ activeTeam }: { activeTeam: TeamContext }) {
  const [contacts, setContacts] = useState<ContactDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [openClubNames, setOpenClubNames] = useState<Set<string>>(new Set());
  const canView = activeTeam.role === "Manager" || activeTeam.role === "Club Admin" || activeTeam.role === "League Chair" || Boolean(activeTeam.hasLeagueChairAccess);
  const canUsePhoneCalls = useCanUsePhoneCalls();

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(withTestUser("/api/contacts"), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Contacts could not be loaded.");
        return payload.contacts as ContactDirectoryEntry[];
      })
      .then((rows) => {
        if (!cancelled) {
          setContacts(rows);
          setOpenClubNames(new Set(rows.some((contact) => contact.clubName === activeTeam.club) ? [activeTeam.club] : []));
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Contacts could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView]);

  if (!canView) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Contacts</CardTitle>
          <Badge>Managers</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-bold text-[var(--pl-muted-text)]">Manager contacts are available to team managers and club admins.</p>
        </CardContent>
      </Card>
    );
  }

  const leagueContacts = contacts.filter((contact) => contact.contactType === "League Official");
  const groupedClubs = contacts
    .filter((contact) => contact.contactType !== "League Official")
    .reduce<Record<string, ContactDirectoryEntry[]>>((groups, contact) => {
      const key = contact.clubName ?? "Club contacts";
      groups[key] = groups[key] ?? [];
      groups[key].push(contact);
      return groups;
    }, {});

  const clubNames = Object.keys(groupedClubs).sort((a, b) => {
    if (a === activeTeam.club) return -1;
    if (b === activeTeam.club) return 1;
    return a.localeCompare(b);
  });

  function toggleClub(clubName: string) {
    setOpenClubNames((current) => {
      const next = new Set(current);
      if (next.has(clubName)) {
        next.delete(clubName);
      } else {
        next.add(clubName);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Contacts</CardTitle>
            <p className="mt-1 text-sm font-bold text-[var(--pl-muted-text)]">Manager and league phone directory.</p>
          </div>
          <Badge>{contacts.length || "..."}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">Loading contacts...</div>
          ) : error ? (
            <div className="rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-black text-red-700">{error}</div>
          ) : !contacts.length ? (
            <div className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">No contacts have been set up yet.</div>
          ) : (
            <>
              {leagueContacts.length ? (
                <section className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-[var(--pl-text)]">League</h3>
                    <Badge variant="soft">{leagueContacts.length}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {leagueContacts.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} copiedId={copiedId} setCopiedId={setCopiedId} canUsePhoneCalls={canUsePhoneCalls} />
                    ))}
                  </div>
                </section>
              ) : null}
              {clubNames.map((clubName) => {
                const clubContacts = groupedClubs[clubName];
                const primary = clubContacts[0]?.clubPrimaryColor ?? activeTeam.primaryColor;
                const accent = clubContacts[0]?.clubAccentColor ?? activeTeam.accentColor;
                const logoPath = clubContacts[0]?.clubLogoPath ?? activeTeam.logoPath;
                const open = openClubNames.has(clubName);
                return (
                  <section key={clubName} className="max-w-full overflow-hidden rounded-[18px] bg-white ring-1 ring-[#eeeaf2]">
                    <button
                      type="button"
                      onClick={() => toggleClub(clubName)}
                      className="grid w-full max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden p-3 text-left text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6] sm:p-4"
                      style={clubPanelStyle(primary, accent)}
                      aria-expanded={open}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-[#eeeaf2] sm:h-14 sm:w-14">
                        <img src={logoPath} alt={`${clubName} logo`} className="max-h-full max-w-full object-contain" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="cyan">{clubContacts.length} contact{clubContacts.length === 1 ? "" : "s"}</Badge>
                          {clubName === activeTeam.club ? <Badge variant="green">Your club</Badge> : null}
                        </div>
                        <h3 className="mt-2 break-words text-lg font-black leading-tight text-white sm:text-2xl">{shortClubDisplayName(clubName)}</h3>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 shrink-0 text-white/80 transition-transform", open && "rotate-180")} />
                    </button>
                    {open ? (
                      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                        {clubContacts.map((contact) => (
                          <ContactCard key={contact.id} contact={contact} copiedId={copiedId} setCopiedId={setCopiedId} canUsePhoneCalls={canUsePhoneCalls} />
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactCard({
  contact,
  copiedId,
  setCopiedId,
  canUsePhoneCalls
}: {
  contact: ContactDirectoryEntry;
  copiedId: string;
  setCopiedId: (id: string) => void;
  canUsePhoneCalls: boolean;
}) {
  const phoneHref = normalizePhoneForHref(contact.phone);
  const whatsappNumber = normalizePhoneForWhatsapp(contact.phone);
  const hasPhone = Boolean(phoneHref);
  const contactActionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-black";
  const disabledActionClass = `${contactActionClass} cursor-not-allowed bg-[var(--pl-light-grey)] text-[var(--pl-muted-text)] opacity-70`;

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--pl-light-grey)] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--pl-muted-text)]">{contact.contactLabel}</p>
          <p className="mt-1 truncate text-base font-black text-[var(--pl-text)]">{contact.displayName}</p>
          <p className="text-sm font-bold text-[var(--pl-muted-text)]">{contact.phone || "No phone yet"}</p>
        </div>
        {contact.leagueName ? <Badge>{contact.leagueName.replace(" League", "")}</Badge> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {hasPhone && canUsePhoneCalls ? (
          <a className={`${contactActionClass} bg-[var(--pl-deep-purple)] text-white`} href={`tel:${phoneHref}`}>
            <Phone className="h-4 w-4" />
            Call
          </a>
        ) : (
          <span className={disabledActionClass} aria-disabled="true" title={hasPhone ? "Calls are available on phone devices." : "No phone number available."}>
            <Phone className="h-4 w-4" />
            Call
          </span>
        )}
        {whatsappNumber ? (
          <a className={`${contactActionClass} bg-[#0f8f61] text-white`} href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        ) : (
          <span className={disabledActionClass} aria-disabled="true" title="No phone number available.">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </span>
        )}
        <button
          type="button"
          className={cn(
            contactActionClass,
            hasPhone ? "bg-[var(--pl-light-grey)] text-[var(--pl-text)]" : "cursor-not-allowed bg-[var(--pl-light-grey)] text-[var(--pl-muted-text)] opacity-70"
          )}
          disabled={!hasPhone}
          onClick={async () => {
            if (!hasPhone) return;
            await navigator.clipboard?.writeText(contact.phone);
            setCopiedId(contact.id);
            window.setTimeout(() => setCopiedId(""), 1500);
          }}
        >
          <Copy className="h-4 w-4" />
          {copiedId === contact.id ? "Copied" : "Copy"}
        </button>
      </div>
    </article>
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
  onNavigate
}: {
  activeTeam: TeamContext;
  menuItems: AppearanceMenuId[];
  onNavigate: (page: AppPage) => void;
}) {
  const configured = menuItems.map(menuEntry);
  const overflowItems = configured.length > 5 ? configured.slice(4) : configured;
  const items = overflowItems.filter((item) => item.page !== "Home" && item.page !== "Club");

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>More</CardTitle>
          <Badge variant="muted">{activeTeam.name}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {activeTeam.hasLeagueChairAccess ? (
            <button
              onClick={() => onNavigate("Shop")}
              className="grid min-h-[76px] grid-cols-[44px_1fr] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 text-left"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-black">Shop</span>
                <span className="block text-xs font-semibold text-[#6c5a73]">League Chair merch preview.</span>
              </span>
            </button>
          ) : null}
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

function ShopPage({ activeTeam }: { activeTeam: TeamContext }) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedShopOptions, setSelectedShopOptions] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<ShopCartItem[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(withTestUser("/api/shop"), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Shop products could not be loaded.");
        return payload.products as ShopProduct[];
      })
      .then((rows) => {
        if (!cancelled) {
          const nextProducts = rows ?? [];
          setProducts(nextProducts);
          setSelectedShopOptions(Object.fromEntries(nextProducts.map((product) => [product.id, product.optionValues?.[0] ?? ""])));
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Shop products could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!activeTeam.hasLeagueChairAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shop</CardTitle>
          <Badge variant="muted">League Chair</Badge>
        </CardHeader>
        <CardContent>
          <p className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">
            Shop access is currently limited to League Chairs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cartTotal = cart.reduce((total, item) => total + item.priceEuros * item.quantity, 0);

  function updateSelectedOption(productId: string, value: string) {
    setSelectedShopOptions((current) => ({ ...current, [productId]: value }));
  }

  function addToCart(product: ShopProduct) {
    const selectedOption = selectedShopOptions[product.id] ?? product.optionValues?.[0] ?? "";
    if (product.optionValues?.length && !selectedOption) {
      setCheckoutMessage(`Choose a ${product.optionName || "option"} first.`);
      return;
    }
    const key = `${product.id}:${selectedOption}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) => item.key === key ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item);
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          productName: product.productName,
          imagePath: product.imagePath,
          priceEuros: product.priceEuros,
          selectedOption,
          quantity: 1
        }
      ];
    });
    setCheckoutMessage("");
  }

  function updateCartQuantity(key: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.key !== key));
      return;
    }
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.min(10, quantity) } : item));
  }

  async function checkout() {
    setCheckoutBusy(true);
    setCheckoutMessage("");
    try {
      const response = await fetch(withTestUser("/api/shop"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          buyerPhone,
          items: cart.map((item) => ({
            productId: item.productId,
            selectedOption: item.selectedOption,
            quantity: item.quantity
          }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Checkout could not be completed.");
      setCart([]);
      setCheckoutMessage(`Order received. Status: ${payload.order?.status ?? "Pending"}.`);
    } catch (checkoutError) {
      setCheckoutMessage(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be completed.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Shop</CardTitle>
          <p className="mt-1 text-sm font-bold text-[var(--pl-muted-text)]">Small-batch Interclub Snooker ideas and merch previews.</p>
        </div>
        <Badge variant="cyan">{products.length || "..."}</Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">Loading products...</div>
        ) : error ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">{error}</div>
        ) : !products.length ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-4 text-sm font-bold text-[var(--pl-muted-text)]">No products are available yet.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--pl-off-white)] ring-1 ring-[var(--pl-border)]">
                <div className="bg-white p-3">
                  <img
                    alt={product.productName}
                    className="aspect-square w-full rounded-[var(--radius-sm)] object-cover"
                    src={product.imagePath}
                  />
                </div>
                <div className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-black text-[var(--pl-text)]">{product.productName}</h3>
                    <Badge variant="green">{formatEuroPrice(product.priceEuros)}</Badge>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-[var(--pl-muted-text)]">{product.description}</p>
                  {product.optionValues?.length ? (
                    <label className="grid gap-1 text-xs font-black uppercase text-[var(--pl-muted-text)]">
                      {product.optionName || "Option"}
                      <select
                        className="min-h-11 rounded-[var(--radius-sm)] border border-[var(--pl-border)] bg-white px-3 text-sm font-extrabold normal-case text-[var(--pl-text)]"
                        value={selectedShopOptions[product.id] ?? product.optionValues[0] ?? ""}
                        onChange={(event) => updateSelectedOption(product.id, event.target.value)}
                      >
                        {product.optionValues.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <Button onClick={() => addToCart(product)} size="sm">
                    <ShoppingBag className="h-4 w-4" />
                    Add to cart
                  </Button>
                </div>
              </article>
            ))}
            </div>
            <aside className="grid content-start gap-3 rounded-[var(--radius-md)] bg-[var(--pl-off-white)] p-3 ring-1 ring-[var(--pl-border)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-[var(--pl-text)]">Your cart</h3>
                <Badge variant={cart.length ? "cyan" : "muted"}>{cart.length}</Badge>
              </div>
              {!cart.length ? (
                <p className="rounded-[var(--radius-sm)] bg-white p-3 text-sm font-bold text-[var(--pl-muted-text)]">Choose a size and add the tee to start an order.</p>
              ) : (
                <div className="grid gap-2">
                  {cart.map((item) => (
                    <div key={item.key} className="grid grid-cols-[52px_1fr_auto] gap-2 rounded-[var(--radius-sm)] bg-white p-2">
                      <img alt="" className="h-12 w-12 rounded-md object-cover" src={item.imagePath} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--pl-text)]">{item.productName}</p>
                        <p className="text-xs font-bold text-[var(--pl-muted-text)]">{item.selectedOption ? `Size ${item.selectedOption}` : "No option"}</p>
                        <p className="text-xs font-bold text-[var(--pl-muted-text)]">{formatEuroPrice(item.priceEuros)}</p>
                      </div>
                      <input
                        aria-label={`Quantity for ${item.productName}`}
                        className="h-10 w-14 rounded-md border border-[var(--pl-border)] px-2 text-center text-sm font-black"
                        min="0"
                        max="10"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => updateCartQuantity(item.key, Number(event.target.value))}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--pl-border)] pt-2 text-sm font-black text-[var(--pl-text)]">
                <span>Total</span>
                <span>{formatEuroPrice(cartTotal)}</span>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs font-black uppercase text-[var(--pl-muted-text)]">
                  Name
                  <input className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--pl-border)] bg-white px-3 text-sm font-bold normal-case text-[var(--pl-text)]" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase text-[var(--pl-muted-text)]">
                  Email
                  <input className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--pl-border)] bg-white px-3 text-sm font-bold normal-case text-[var(--pl-text)]" type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase text-[var(--pl-muted-text)]">
                  Phone
                  <input className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--pl-border)] bg-white px-3 text-sm font-bold normal-case text-[var(--pl-text)]" type="tel" value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} />
                </label>
              </div>
              <Button onClick={checkout} disabled={!cart.length || checkoutBusy}>
                {checkoutBusy ? "Checking out..." : "Checkout"}
              </Button>
              {checkoutMessage ? <p className="text-sm font-bold text-[var(--pl-muted-text)]">{checkoutMessage}</p> : null}
            </aside>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatEuroPrice(value: number) {
  return new Intl.NumberFormat("en-IE", { currency: "EUR", style: "currency" }).format(value);
}

function ManagerHome({
  activeTeam,
  matchResults,
  onNavigate,
  onOpenFixture,
  leagueTeamCount,
  panels,
  onDataRefresh,
  onTeamSummaryUpdate,
  userCanShare
}: {
  activeTeam: TeamContext;
  matchResults: MatchResult[];
  onNavigate: (page: AppPage) => void;
  onOpenFixture: (fixtureId: string) => void;
  leagueTeamCount: number;
  panels: AppearancePanelId[];
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
  userCanShare: boolean;
}) {
  const renderPanel = (panel: AppearancePanelId) => {
    if (panel === "matchPlanning") {
      return (
        <div key={panel} className="md:col-span-2">
          <MatchPlanningCard
            activeTeam={activeTeam}
            onDataRefresh={onDataRefresh}
            onTeamSummaryUpdate={onTeamSummaryUpdate}
            onOpenFixture={onOpenFixture}
            userCanShare={userCanShare}
          />
        </div>
      );
    }
    if (panel === "managerActions") return null;
    if (panel === "seasonComplete") return <SeasonCompleteCard key={panel} activeTeam={activeTeam} action="Review season" leagueTeamCount={leagueTeamCount} />;
    if (panel === "teamRecentForm") return <TeamRecentFormCard key={panel} activeTeam={activeTeam} matchResults={matchResults} />;
    if (panel === "squadManagement") return <SquadManagementCard key={panel} activeTeam={activeTeam} userCanShare={userCanShare} />;
    if (panel === "managerSnapshot") return <ManagerSeasonSnapshot key={panel} activeTeam={activeTeam} leagueTeamCount={leagueTeamCount} />;
    if (panel === "memberActions") return <MemberActionsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} />;
    if (panel === "openCompetitions") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="open" onNavigate={onNavigate} />;
    if (panel === "myCompetitionMatches") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="mine" onNavigate={onNavigate} />;
    if (panel === "competitionDraws") return <CompetitionPanel key={panel} activeTeam={activeTeam} mode="draws" onNavigate={onNavigate} />;
    if (panel === "clubCompetitionAdmin") return null;
    if (panel === "teamStats") return <TeamStatsCard key={panel} activeTeam={activeTeam} onNavigate={onNavigate} leagueTeamCount={leagueTeamCount} userCanShare={userCanShare} />;
    if (panel === "messages") return <MessagesPage key={panel} activeTeam={activeTeam} compact />;
    if (panel === "lastManStanding") return <div key={panel} className="md:col-span-2"><LastManStandingHomePanel onOpen={() => onNavigate("Last Man Standing")} /></div>;
    if (panel === "clubLadder") return <ClubLadderHomePanel key={panel} className="md:col-span-2" activeTeam={activeTeam} onOpen={() => onNavigate("Ladder")} />;
    return null;
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {panels.map(renderPanel)}
    </section>
  );
}

function MatchPlanningCard({
  activeTeam,
  onDataRefresh,
  onTeamSummaryUpdate,
  onOpenFixture,
  userCanShare = false
}: {
  activeTeam: TeamContext;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
  onOpenFixture?: (fixtureId: string) => void;
  userCanShare?: boolean;
}) {
  return (
    <div className="grid gap-4 md:col-span-2">
      <FixtureWeekCarouselCard
        activeTeam={activeTeam}
        onOpenFixture={onOpenFixture}
        userCanShare={userCanShare}
        onDataRefresh={onDataRefresh}
        onTeamSummaryUpdate={onTeamSummaryUpdate}
      />
    </div>
  );
}

type FriendlySummary = {
  id: string;
  fixtureDate: string;
  status: "Scheduled" | "Completed";
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamScore: number | null;
  awayTeamScore: number | null;
  homeLineupStatus: "Draft" | "Published" | null;
  awayLineupStatus: "Draft" | "Published" | null;
  completedGames: number;
  totalGames: number;
};

type FriendlyTeamOption = {
  id: string;
  name: string;
  clubName: string;
  league: string;
};

function defaultFriendlyDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 30, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function FriendliesPage({
  activeTeam,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const [friendlies, setFriendlies] = useState<FriendlySummary[]>([]);
  const [teams, setTeams] = useState<FriendlyTeamOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [fixtureDate, setFixtureDate] = useState(defaultFriendlyDateTime);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadFriendlies(selectFixtureId?: string) {
    if (!activeTeam.teamId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(withTestUser(`/api/friendlies?teamId=${encodeURIComponent(activeTeam.teamId)}`), {
        credentials: "same-origin",
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Friendlies unavailable.");
      const nextFriendlies: FriendlySummary[] = data.friendlies ?? [];
      const nextTeams: FriendlyTeamOption[] = data.teams ?? [];
      setFriendlies(nextFriendlies);
      setTeams(nextTeams);
      setCanManage(Boolean(data.canManage));
      setOpponentTeamId((current) => current || nextTeams[0]?.id || "");
      setSelectedFixtureId((current) => {
        if (selectFixtureId) return selectFixtureId;
        if (current && nextFriendlies.some((friendly) => friendly.id === current)) return current;
        return nextFriendlies[0]?.id ?? "";
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Friendlies unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFriendlies();
  }, [activeTeam.teamId]);

  async function createFriendly() {
    if (!activeTeam.teamId || !opponentTeamId || !fixtureDate) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/friendlies", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          opponentTeamId,
          fixtureDate,
          testUser: currentTestUserParam()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create friendly.");
      await loadFriendlies(data.fixtureId);
      setMessage("Friendly created. You can now pick the team.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create friendly.");
    } finally {
      setBusy(false);
    }
  }

  if (!activeTeam.teamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Friendlies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Friendlies are linked to interclub teams.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedFriendly = friendlies.find((friendly) => friendly.id === selectedFixtureId);

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Friendlies</CardTitle>
            <p className="mt-1 text-sm font-semibold text-[#6c5a73]">
              Private matches for {activeTeam.name}. They do not affect league tables or player stats.
            </p>
          </div>
          <Badge variant="muted">{friendlies.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {message ? <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#10233f]">{message}</p> : null}
          {canManage ? (
            <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2] md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
              <label className="grid gap-1">
                <span className="text-xs font-extrabold uppercase text-[#6c5a73]">Opponent</span>
                <select
                  value={opponentTeamId}
                  onChange={(event) => setOpponentTeamId(event.target.value)}
                  className="min-h-11 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold text-[#10233f]"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {team.league}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-extrabold uppercase text-[#6c5a73]">Date</span>
                <input
                  type="datetime-local"
                  value={fixtureDate}
                  onChange={(event) => setFixtureDate(event.target.value)}
                  className="min-h-11 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold text-[#10233f]"
                />
              </label>
              <Button onClick={createFriendly} disabled={busy || !opponentTeamId || !fixtureDate}>
                <PlusCircle className="h-4 w-4" />
                {busy ? "Creating..." : "Create"}
              </Button>
            </div>
          ) : null}
          {loading ? (
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Loading friendlies...</p>
          ) : friendlies.length ? (
            <div className="grid gap-2">
              {friendlies.map((friendly) => {
                const selected = friendly.id === selectedFixtureId;
                const hasScore = friendly.homeTeamScore !== null && friendly.awayTeamScore !== null;
                return (
                  <button
                    key={friendly.id}
                    type="button"
                    onClick={() => setSelectedFixtureId(friendly.id)}
                    className={cn(
                      "grid gap-2 rounded-xl border p-3 text-left transition-colors",
                      selected ? "border-[#10233f] bg-[#eef3f7]" : "border-[#eeeaf2] bg-white hover:bg-[#f7f5fa]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{formatFixtureDate(friendly.fixtureDate)}</p>
                      <Badge variant={friendly.status === "Completed" ? "green" : friendly.totalGames ? "cyan" : "muted"}>
                        {friendly.status === "Completed" ? "Completed" : friendly.totalGames ? `${friendly.completedGames}/${friendly.totalGames} played` : "Planning"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-black">
                      <span className="min-w-0 truncate" style={{ color: teamColors(friendly.homeTeamName).primaryColor }}>{friendly.homeTeamName}</span>
                      <span className="rounded-lg bg-[#10233f] px-2 py-1 text-xs text-white">
                        {hasScore ? `${friendly.homeTeamScore}-${friendly.awayTeamScore}` : "v"}
                      </span>
                      <span className="min-w-0 truncate text-right" style={{ color: teamColors(friendly.awayTeamName).primaryColor }}>{friendly.awayTeamName}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
              No friendlies have been created for {activeTeam.name}.
            </p>
          )}
        </CardContent>
      </Card>
      {selectedFriendly ? (
        canManage ? (
          <ManagerLineupCard
            activeTeam={activeTeam}
            preferredFixtureId={selectedFriendly.id}
            onDataRefresh={() => {
              void loadFriendlies(selectedFriendly.id);
              onDataRefresh?.();
            }}
            onTeamSummaryUpdate={onTeamSummaryUpdate}
          />
        ) : (
          <FriendlyReadOnlyCard
            activeTeam={activeTeam}
            fixtureId={selectedFriendly.id}
          />
        )
      ) : null}
    </section>
  );
}

function FriendlyReadOnlyCard({ activeTeam, fixtureId }: { activeTeam: TeamContext; fixtureId: string }) {
  const [payload, setPayload] = useState<ManagerLineupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!activeTeam.teamId || !fixtureId) return;
    let cancelled = false;
    const teamId = activeTeam.teamId;

    async function loadFriendly() {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ teamId, fixtureId });
        const testUser = currentTestUserParam();
        if (testUser) params.set("testUser", testUser);
        const response = await fetch(`/api/manager/lineup?${params.toString()}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Friendly details unavailable.");
        if (!cancelled) setPayload(data);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Friendly details unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFriendly();
    return () => {
      cancelled = true;
    };
  }, [activeTeam.teamId, fixtureId]);

  const fixture = payload?.weekFixtures?.[0];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Friendly details</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">
            Friendlies are read-only for players and do not affect league tables or player stats.
          </p>
        </div>
        <Badge variant="cyan">Friendly</Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">Loading friendly...</p>
        ) : message ? (
          <p className="rounded-xl bg-[#fff8eb] p-3 text-sm font-semibold text-[#8a5a00] ring-1 ring-[#ffb00055]">{message}</p>
        ) : fixture ? (
          <ReadOnlyFixtureDetails fixture={fixture} />
        ) : (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Friendly details will appear once the teams publish lineups or scoring starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TeamStatsCard({ activeTeam, onNavigate, leagueTeamCount, userCanShare = false }: { activeTeam: TeamContext; onNavigate: (page: AppPage) => void; leagueTeamCount: number; userCanShare?: boolean }) {
  const hasLeagueTable = teamHasActivity(activeTeam);
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount, activeTeam.league);

  return (
    <Card className="overflow-hidden md:col-span-2 xl:col-span-1">
      <CardHeader>
        <CardTitle>Team Stats</CardTitle>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {userCanShare ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void shareSvgVisual(
                  `${activeTeam.name.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-team-stats.svg`,
                  `${activeTeam.name} ${activeTeam.season} team stats`,
                  buildTeamStatsShareSvg(activeTeam, leagueTeamCount)
                );
              }}
              className="min-h-9 px-3 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Badge variant={hasLeagueTable ? qualificationBadgeVariant(qualification) : "muted"}>
            {hasLeagueTable ? ordinal(activeTeam.leaguePosition) : "Pending"}
          </Badge>
        </div>
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

function PlayerStatCard({
  activeTeam = teamContexts[0],
  playerBreakStat,
  playerGameResults = demoPlayerGameResults,
  userCanShare = false
}: {
  activeTeam?: TeamContext;
  playerBreakStat?: PlayerBreakStat | null;
  playerGameResults?: PlayerGameResult[];
  userCanShare?: boolean;
}) {
  const wins = playerGameResults.filter((result) => result.result === "Won").length;
  const losses = playerGameResults.filter((result) => result.result === "Lost").length;
  const played = playerGameResults.length;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const recentForm = playerGameResults.slice(0, RECENT_FORM_LIMIT).map((fixture) => fixture.result === "Won" ? "W" : "L").join(" ");
  const miniStats = [
    { label: "Played", value: String(played || "-") },
    { label: "Won", value: String(wins || "-") },
    { label: "Lost", value: String(losses || "-") },
    ...(playerBreakStat ? [{ label: "High break", value: String(playerBreakStat.highestBreak) }] : [])
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>My Stats</CardTitle>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {userCanShare && played ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void shareSvgVisual(
                  `${activeTeam.name.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-my-stats.svg`,
                  `${activeTeam.name} ${activeTeam.season} player stats`,
                  buildPersonalStatsShareSvg(activeTeam, playerBreakStat ?? null, playerGameResults)
                );
              }}
              className="min-h-9 px-3 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Badge variant={playerBreakStat ? "cyan" : "green"}>{playerBreakStat ? `High break ${playerBreakStat.highestBreak}` : recentForm || "-"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <p className="text-xs font-extrabold uppercase text-white/65">Personal win rate</p>
          <p className="mt-1 text-6xl font-black leading-none">{played ? `${winRate}%` : "-"}</p>
          <div className={cn("mt-4 grid gap-2", miniStats.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
            {miniStats.map((stat) => (
              <MiniStat key={stat.label} label={stat.label} value={stat.value} dark />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HighBreakSeasonCard({ activeTeam, breakStat }: { activeTeam: TeamContext; breakStat: PlayerBreakStat }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>High Break</CardTitle>
        <Badge variant="muted">{activeTeam.season}</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] p-4 text-white" style={clubPanelStyle(activeTeam.primaryColor, activeTeam.accentColor)}>
          <p className="text-xs font-extrabold uppercase text-white/65">High break this season</p>
          <p className="mt-1 text-6xl font-black leading-none">{breakStat.highestBreak}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Breaks" value={String(breakStat.totalBreaks)} dark />
            <MiniStat label="50+" value={String(breakStat.fiftyPlusBreaks)} dark />
            <MiniStat label="100+" value={String(breakStat.centuryBreaks)} dark />
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
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount, activeTeam.league);
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
  const hasScore = result.homeTeamScore > 0 || result.awayTeamScore > 0;
  const resultLabel = result.status === "Completed"
    ? homeWon ? "Home win" : awayWon ? "Away win" : "Draw"
    : hasScore ? "In play" : "Scheduled";

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
      <div className="p-3">
        <div className="grid gap-2 sm:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <p className="min-w-0 break-words font-extrabold leading-tight" style={{ color: homeColors.primaryColor }}>{result.homeTeamName}</p>
            <span className={cn("grid h-9 min-w-9 place-items-center rounded-md px-2 text-lg font-extrabold ring-1", scoreTone(result.homeTeamScore, result.awayTeamScore))}>
              {result.homeTeamScore}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <p className="min-w-0 break-words font-extrabold leading-tight" style={{ color: awayColors.primaryColor }}>{result.awayTeamName}</p>
            <span className={cn("grid h-9 min-w-9 place-items-center rounded-md px-2 text-lg font-extrabold ring-1", scoreTone(result.awayTeamScore, result.homeTeamScore))}>
              {result.awayTeamScore}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeeaf2] pt-2 text-xs font-semibold text-[#6c5a73]">
            <span>{formatFixtureDate(result.fixtureDate)}</span>
            <span>{resultLabel}</span>
          </div>
        </div>
        <div className="hidden min-h-[76px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid">
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
            <p className="mt-1 text-xs font-semibold text-[#6c5a73]">{resultLabel}</p>
          </div>
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
        {visibleGames.map((game) => {
          const matchup = personalGameMatchupLabel(game);
          return (
            <div key={game.gameId} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
              <div className="min-w-0">
                <p className="break-words font-black leading-tight">{matchup.title}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#6c5a73]">
                  {game.sourceWeek} - Game {game.gameNumber}{matchup.detail ? ` - ${matchup.detail}` : ""}
                </p>
              </div>
              <Badge variant={game.result === "Won" ? "green" : "red"}>{game.result}</Badge>
            </div>
          );
        })}
        {visibleGames.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Your personal match history will appear here once your account is linked.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlayerGameResultsCard({ activeTeam, results, userCanShare = false }: { activeTeam?: TeamContext; results: PlayerGameResult[]; userCanShare?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const wins = results.filter((result) => result.result === "Won").length;
  const losses = results.filter((result) => result.result === "Lost").length;
  const winRate = results.length ? Math.round((wins / results.length) * 100) : 0;
  const visibleResults = showAll ? results : results.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Individual Games</CardTitle>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {userCanShare && activeTeam && results.length ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void shareSvgVisual(
                  `${activeTeam.name.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-individual-games.svg`,
                  `${activeTeam.name} ${activeTeam.season} individual games`,
                  buildIndividualGamesShareSvg(activeTeam, results)
                );
              }}
              className="min-h-9 px-3 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Badge variant="cyan">{results.length ? `${winRate}% win rate` : "No games yet"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleResults.map((game) => {
          const matchup = personalGameMatchupLabel(game);
          return (
            <div key={game.gameId} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
              <div className="min-w-0">
                <p className="break-words font-black leading-tight">{matchup.title}</p>
                <p className="mt-0.5 break-words text-xs font-semibold leading-snug text-[#6c5a73]">
                  {matchup.detail ? `${matchup.detail} - ` : ""}{game.sourceWeek} - Game {game.gameNumber} - {game.homeTeamName} {game.matchScore} {game.awayTeamName}
                </p>
              </div>
              <Badge variant={game.result === "Won" ? "green" : "red"}>{game.result}</Badge>
            </div>
          );
        })}
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

type ManagerLineupSlot = {
  slotNumber: number;
  gameType: "Singles" | "Doubles";
  label: string;
  player1Id: string;
  player1Name?: string;
  player1GuestName?: string;
  player1IsGuest?: boolean;
  player1CountsForStats?: boolean;
  player1GuestTeamName?: string | null;
  player2Id: string;
  player2Name?: string;
  player2GuestName?: string;
  player2IsGuest?: boolean;
  player2CountsForStats?: boolean;
  player2GuestTeamName?: string | null;
};

type LineupPlayerOption = { id: string; name: string; teamName?: string; disabledReason?: string };

type ManagerLineupGame = {
  id: string;
  game_number: number;
  game_type: "Singles" | "Doubles";
  points_awarded: number;
  winner_team_id: string | null;
  home_player_1_id: string | null;
  home_player_1_name: string;
  home_player_1_win_percentage?: number | null;
  home_player_1_is_guest?: boolean;
  home_player_1_counts_for_stats?: boolean;
  home_player_1_guest_team_name?: string | null;
  home_player_2_id: string | null;
  home_player_2_name: string | null;
  home_player_2_win_percentage?: number | null;
  home_player_2_is_guest?: boolean;
  home_player_2_counts_for_stats?: boolean;
  home_player_2_guest_team_name?: string | null;
  away_player_1_id: string | null;
  away_player_1_name: string;
  away_player_1_win_percentage?: number | null;
  away_player_1_is_guest?: boolean;
  away_player_1_counts_for_stats?: boolean;
  away_player_1_guest_team_name?: string | null;
  away_player_2_id: string | null;
  away_player_2_name: string | null;
  away_player_2_win_percentage?: number | null;
  away_player_2_is_guest?: boolean;
  away_player_2_counts_for_stats?: boolean;
  away_player_2_guest_team_name?: string | null;
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
    fixtureType?: "League" | "Friendly" | "Cup";
  } | null;
  players: LineupPlayerOption[];
  guestPlayers?: LineupPlayerOption[];
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

type GuestPlayerSelection = {
  playerId?: string;
  guestName?: string;
};

type BreakEntryTarget = {
  game: ManagerLineupGame;
  fixture: NonNullable<ManagerLineupPayload["fixture"]>;
} | null;

const standardLineupSlots: ManagerLineupSlot[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1", player1Id: "", player2Id: "" },
  { slotNumber: 2, gameType: "Singles", label: "Singles 2", player1Id: "", player2Id: "" },
  { slotNumber: 3, gameType: "Doubles", label: "Doubles", player1Id: "", player2Id: "" },
  { slotNumber: 4, gameType: "Singles", label: "Singles 4", player1Id: "", player2Id: "" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5", player1Id: "", player2Id: "" },
  { slotNumber: 6, gameType: "Singles", label: "Singles 6", player1Id: "", player2Id: "" }
];

const cLeagueLineupSlots: ManagerLineupSlot[] = [
  { slotNumber: 1, gameType: "Singles", label: "Singles 1", player1Id: "", player2Id: "" },
  { slotNumber: 2, gameType: "Doubles", label: "Doubles 2", player1Id: "", player2Id: "" },
  { slotNumber: 3, gameType: "Singles", label: "Singles 3", player1Id: "", player2Id: "" },
  { slotNumber: 4, gameType: "Doubles", label: "Doubles 4", player1Id: "", player2Id: "" },
  { slotNumber: 5, gameType: "Singles", label: "Singles 5", player1Id: "", player2Id: "" }
];

function defaultLineupSlotsForLeague(league: string): ManagerLineupSlot[] {
  return (league === "C League" ? cLeagueLineupSlots : standardLineupSlots).map((slot) => ({ ...slot }));
}

function lineupPlayerPrefix(key: "player1Id" | "player2Id") {
  return key === "player1Id" ? "player1" : "player2";
}

function lineupSlotDisplayName(slot: ManagerLineupSlot, key: "player1Id" | "player2Id", players: LineupPlayerOption[], guestPlayers: LineupPlayerOption[]) {
  const prefix = lineupPlayerPrefix(key);
  const playerId = slot[key];
  const guestName = String(slot[`${prefix}GuestName` as keyof ManagerLineupSlot] ?? "");
  if (guestName) return guestName;
  if (!playerId) return "";
  return [...players, ...guestPlayers].find((player) => player.id === playerId)?.name ?? "";
}

type FixtureWeekFixture = {
  id: string;
  fixtureDate: string;
  rescheduled: boolean;
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
  lineups?: Array<{
    teamId: string;
    teamName: string;
    slots: Array<{
      slotNumber: number;
      gameType: "Singles" | "Doubles";
      player1Name: string;
      player2Name: string | null;
      player1IsGuest: boolean;
      player2IsGuest: boolean;
      player1GuestTeamName?: string | null;
      player2GuestTeamName?: string | null;
    }>;
  }>;
  games: ManagerLineupGame[];
  fixtureType?: "League" | "Friendly" | "Cup";
};

type FixtureWeek = {
  id: string;
  weekNumber: number | null;
  weekLabel: string;
  startsOn: string;
  fixtures: FixtureWeekFixture[];
  postponedFixtures: Array<{
    fixtureId: string;
    homeTeamName: string;
    awayTeamName: string;
    postponedTo: string;
  }>;
  competitionType?: "League" | "Cup";
  cupPlaceholders?: Array<{
    tieId: string;
    homeLabel: string;
    awayLabel: string;
  }>;
};

function fixtureWeekVisibleFromDate(week: FixtureWeek, league: TeamContext["league"]) {
  const matchDate = week.startsOn.slice(0, 10);
  if (league === "C League") return isoDateFromOffset(matchDate, -2);

  const date = new Date(`${matchDate}T12:00:00`);
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return localIsoDate(date);
}

function defaultFixtureWeekIndex(weeks: FixtureWeek[], league: TeamContext["league"]) {
  if (!weeks.length) return 0;
  const today = localIsoDate();
  const visibleWeeks = weeks
    .map((week, index) => ({ index, visibleFrom: fixtureWeekVisibleFromDate(week, league) }))
    .filter((week) => week.visibleFrom <= today);

  if (!visibleWeeks.length) return 0;
  return visibleWeeks.reduce((latest, week) => (
    week.visibleFrom >= latest.visibleFrom ? week : latest
  )).index;
}

const MATCH_POLL_ACTIVE_MS = 60_000;
const MATCH_POLL_IDLE_MS = 5 * 60 * 1000;
const MATCH_POLL_TICK_MS = 60_000;

type FixtureStatusSnapshot = {
  id: string;
  status: string;
  homeTeamScore: number | null;
  awayTeamScore: number | null;
  homeLineupStatus: "Draft" | "Published" | null;
  awayLineupStatus: "Draft" | "Published" | null;
  completedGames: number;
  totalGames: number;
};

function fixtureStatusSnapshot(fixtures: FixtureStatusSnapshot[]) {
  return JSON.stringify([...fixtures]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((fixture) => [
      fixture.id,
      fixture.status,
      fixture.homeTeamScore,
      fixture.awayTeamScore,
      fixture.homeLineupStatus,
      fixture.awayLineupStatus,
      fixture.completedGames,
      fixture.totalGames
    ]));
}

async function loadFixtureStatuses(fixtureIds: string[]) {
  if (!fixtureIds.length) return [];
  const response = await fetch(withTestUser(`/api/fixtures/status?fixtureIds=${encodeURIComponent(fixtureIds.join(","))}`), {
    credentials: "same-origin",
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Fixture status is unavailable.");
  return (data.fixtures ?? []) as FixtureStatusSnapshot[];
}

function fixtureWeekPollInterval(week?: FixtureWeek) {
  if (!week) return null;
  const today = localIsoDate();
  if (!isMatchPollingWindow()) return null;
  const activeFixtures = week.fixtures.filter((fixture) => (
    fixture.fixtureDate.slice(0, 10) === today && fixture.status !== "Completed"
  ));
  if (!activeFixtures.length) return null;
  return activeFixtures.some((fixture) => fixture.completedGames > 0)
    ? MATCH_POLL_ACTIVE_MS
    : MATCH_POLL_IDLE_MS;
}

function isMatchPollingWindow() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 19 * 60 + 30 && minutes <= 23 * 60 + 30;
}

function managerLineupPollInterval(payload: ManagerLineupPayload | null) {
  if (!payload?.fixture || payload.fixture.status === "Completed") return null;
  if (payload.fixture.fixtureDate.slice(0, 10) !== localIsoDate() || !isMatchPollingWindow()) return null;
  const currentWeekFixture = payload.weekFixtures.find((fixture) => fixture.id === payload.fixture?.id);
  const hasStarted = payload.games.some((game) => Boolean(game.winner_team_id))
    || (currentWeekFixture?.completedGames ?? 0) > 0;
  return hasStarted ? MATCH_POLL_ACTIVE_MS : MATCH_POLL_IDLE_MS;
}

function fixtureHasStarted(fixture: FixtureWeekFixture) {
  return Boolean(fixture.totalGames > 0 || fixture.homeTeamScore !== null || fixture.awayTeamScore !== null);
}

function fixtureHasPublishedLineups(fixture: FixtureWeekFixture) {
  return fixture.homeLineupStatus === "Published" && fixture.awayLineupStatus === "Published";
}

function fixtureOwnLineupPublished(fixture: FixtureWeekFixture, teamId?: string | null) {
  if (!teamId || !fixture.isOwnFixture) return false;
  const ownStatus = fixture.homeTeamId === teamId ? fixture.homeLineupStatus : fixture.awayLineupStatus;
  return ownStatus === "Published";
}

function FixtureWeekCarouselCard({
  activeTeam,
  selectedFixtureId,
  onSelectFixture,
  onOpenFixture,
  userCanShare = false,
  onDataRefresh,
  onTeamSummaryUpdate,
  includeCups = true
}: {
  activeTeam: TeamContext;
  selectedFixtureId?: string;
  onSelectFixture?: (fixtureId: string) => void;
  onOpenFixture?: (fixtureId: string) => void;
  userCanShare?: boolean;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
  includeCups?: boolean;
}) {
  const [weeks, setWeeks] = useState<FixtureWeek[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedFixtureId, setExpandedFixtureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const activeIndexRef = useRef(0);
  const weeksRef = useRef<FixtureWeek[]>([]);
  const embeddedDemoMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    let active = true;
    let pollId: number | undefined;
    let lastPollAt = Date.now();
    setLoading(true);
    setMessage("");

    async function loadWeeks(showLoading: boolean) {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({ league: activeTeam.league, season: activeTeam.season });
      params.set("includeCups", includeCups ? "1" : "0");
      if (activeTeam.teamId) params.set("teamId", activeTeam.teamId);
      if (!showLoading) params.set("refresh", String(Date.now()));
      const response = await fetch(withTestUser(`/api/fixtures/weeks?${params.toString()}`), { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Fixtures unavailable.");
      if (!active) return;
      const nextWeeks: FixtureWeek[] = data.weeks ?? [];
      weeksRef.current = nextWeeks;
      setWeeks(nextWeeks);
      if (nextWeeks.length) {
        setActiveIndex((current) => {
          if (current >= 0 && current < nextWeeks.length && !showLoading) return current;
          return defaultFixtureWeekIndex(nextWeeks, activeTeam.league);
        });
      }
      setMessage("");
    }

    loadWeeks(true)
      .then(() => {
        if (!active) return;
        lastPollAt = Date.now();
        let statusPollInFlight = false;
        pollId = window.setInterval(async () => {
          if (document.visibilityState !== "visible") return;
          const currentWeek = weeksRef.current[activeIndexRef.current];
          const interval = embeddedDemoMode
            ? MATCH_POLL_ACTIVE_MS
            : fixtureWeekPollInterval(currentWeek);
          if (!interval || Date.now() - lastPollAt < interval || statusPollInFlight) return;
          const today = localIsoDate();
          const visibleFixtures = (currentWeek?.fixtures ?? []).filter((fixture) => (
            fixture.fixtureDate.slice(0, 10) === today && fixture.status !== "Completed"
          ));
          if (!visibleFixtures.length) return;
          lastPollAt = Date.now();
          statusPollInFlight = true;
          try {
            const nextStatuses = await loadFixtureStatuses(visibleFixtures.map((fixture) => fixture.id));
            if (fixtureStatusSnapshot(visibleFixtures) !== fixtureStatusSnapshot(nextStatuses)) await loadWeeks(false);
          } catch {
            // The next scheduled check or a manual refresh will retry.
          } finally {
            statusPollInFlight = false;
          }
        }, MATCH_POLL_TICK_MS);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Fixtures unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const refreshPanels = () => {
      lastPollAt = Date.now();
      loadWeeks(false).catch(() => undefined);
    };
    window.addEventListener("interclub:refresh-panels", refreshPanels);
    return () => {
      active = false;
      window.removeEventListener("interclub:refresh-panels", refreshPanels);
      if (pollId) window.clearInterval(pollId);
    };
  }, [activeTeam.league, activeTeam.season, activeTeam.teamId, embeddedDemoMode, includeCups]);

  const week = weeks[activeIndex];
  const showFixtureDates = week
    ? shouldShowFixtureDates(week.startsOn, week.fixtures.map((fixture) => fixture.fixtureDate))
    : false;
  const liveFixtureIds = useMemo(() => week?.fixtures.map((fixture) => fixture.id) ?? [], [week]);
  const liveStatuses = useLiveScoringStatuses(liveFixtureIds, Boolean(activeTeam.hasLiveScoringAccess));
  const managerCanShare = userCanShare;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Fixtures / Results</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {managerCanShare ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!week}
              onClick={() => {
                if (!week) return;
                void shareSvgVisual(
                  `${activeTeam.league.toLowerCase().replace(/\s+/g, "-")}-${week.weekLabel.toLowerCase().replace(/\s+/g, "-")}-results.svg`,
                  `${activeTeam.league} ${week.weekLabel} results`,
                  buildWeekResultsShareSvg(activeTeam, week)
                );
              }}
              className="min-h-9 px-3 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Badge variant="muted">{week?.competitionType === "Cup" ? "Cup" : activeTeam.league}</Badge>
        </div>
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
              {(week.cupPlaceholders ?? []).map((tie) => (
                <div key={tie.tieId} className="grid gap-2 border-b border-[#eeeaf2] bg-[#f7f5fa] p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <span className="min-w-0 text-sm font-extrabold text-[#6c5a73]">{tie.homeLabel}</span>
                    <span className="text-xs font-black uppercase text-[#6c5a73]">v</span>
                    <span className="min-w-0 text-right text-sm font-extrabold text-[#6c5a73]">{tie.awayLabel}</span>
                  </div>
                  <span className="justify-self-start rounded-md bg-white px-2 py-1 text-[11px] font-extrabold uppercase text-[#6c5a73] ring-1 ring-[#ded7e5]">Awaiting previous result</span>
                </div>
              ))}
              {week.postponedFixtures.map((fixture) => (
                <div key={`postponed-${fixture.fixtureId}`} className="grid gap-2 border-b border-[#eeeaf2] bg-[#fffaf0] p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-extrabold text-[#10233f]">{fixture.homeTeamName}</span>
                    <span className="text-xs font-black uppercase text-[#6c5a73]">v</span>
                    <span className="min-w-0 truncate text-right text-sm font-extrabold text-[#10233f]">{fixture.awayTeamName}</span>
                  </div>
                  <span className="justify-self-start rounded-md bg-[#fff1d6] px-2 py-1 text-[11px] font-extrabold uppercase text-[#8a5a00] ring-1 ring-[#ffb00055]">
                    Postponed to {formatFixtureDate(fixture.postponedTo)}
                  </span>
                </div>
              ))}
              {week.fixtures.map((fixture) => {
                const hasScore = fixture.homeTeamScore !== null && fixture.awayTeamScore !== null;
                const expanded = expandedFixtureId === fixture.id || selectedFixtureId === fixture.id;
                const managerOwnFixture = fixture.isOwnFixture && (activeTeam.role === "Manager");
                const canManage = Boolean(managerOwnFixture && activeTeam.season !== "2025/26");
                const canEditInline = canManage && fixture.status !== "Completed";
                const ownLineupPublished = fixtureOwnLineupPublished(fixture, activeTeam.teamId);
                const canInspect = fixtureHasStarted(fixture) || fixtureHasPublishedLineups(fixture) || ownLineupPublished;
                const fixtureLiveStatuses = liveStatuses[fixture.id] ?? [];
                const hasVisibleLiveScoring = Boolean(activeTeam.hasLiveScoringAccess && fixtureLiveStatuses.length);
                const canOpenRow = Boolean(hasVisibleLiveScoring || canManage || canInspect);
                const homeLineupStatus = visibleLineupStatus(fixture.homeLineupStatus, fixture.fixtureDate);
                const awayLineupStatus = visibleLineupStatus(fixture.awayLineupStatus, fixture.fixtureDate);
                const lineupsPublished = fixtureHasPublishedLineups(fixture) && fixture.status !== "Completed" && fixture.completedGames === 0;
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
                          setExpandedFixtureId((current) => current === fixture.id ? "" : fixture.id);
                          return;
                        }
                        if (!canInspect && !hasVisibleLiveScoring) return;
                        setExpandedFixtureId((current) => current === fixture.id ? "" : fixture.id);
                      }}
                    >
                      {showFixtureDates ? (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase text-[#6c5a73]">
                          <span>{formatFixtureDate(fixture.fixtureDate)}</span>
                          {fixture.rescheduled ? (
                            <span className="rounded-md bg-[#fff1d6] px-2 py-1 text-[#8a5a00] ring-1 ring-[#ffb00055]">Rescheduled</span>
                          ) : null}
                        </div>
                      ) : fixture.rescheduled ? (
                        <span className="justify-self-start rounded-md bg-[#fff1d6] px-2 py-1 text-[11px] font-extrabold uppercase text-[#8a5a00] ring-1 ring-[#ffb00055]">Rescheduled</span>
                      ) : null}
                      <div className="grid gap-2 md:hidden">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                          <FixtureTeamLabel teamName={fixture.homeTeamName} lineupStatus={fixtureHasStarted(fixture) ? undefined : homeLineupStatus} />
                          {hasScore ? (
                            <span className={cn("grid h-8 min-w-12 place-items-center rounded-md px-2 text-sm font-black ring-1", scoreTone(fixture.homeTeamScore ?? 0, fixture.awayTeamScore ?? 0))}>
                              {fixture.homeTeamScore}
                            </span>
                          ) : (
                            <span className="text-xs font-black uppercase text-[#6c5a73]">Home</span>
                          )}
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                          <FixtureTeamLabel teamName={fixture.awayTeamName} lineupStatus={fixtureHasStarted(fixture) ? undefined : awayLineupStatus} />
                          {hasScore ? (
                            <span className={cn("grid h-8 min-w-12 place-items-center rounded-md px-2 text-sm font-black ring-1", scoreTone(fixture.awayTeamScore ?? 0, fixture.homeTeamScore ?? 0))}>
                              {fixture.awayTeamScore}
                            </span>
                          ) : (
                            <span className="text-xs font-black uppercase text-[#6c5a73]">Away</span>
                          )}
                        </div>
                      </div>
                      <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:grid">
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
                      {lineupsPublished ? (
                        <span className="justify-self-start rounded-lg bg-[#e9fff4] px-3 py-1.5 text-xs font-extrabold uppercase text-[#007a45] ring-1 ring-[#00a85a33]">
                          Lineups published
                        </span>
                      ) : null}
                      {activeTeam.hasLiveScoringAccess ? (
                        <LeagueChairLiveIndicator statuses={fixtureLiveStatuses} />
                      ) : null}
                    </button>
                    {expanded && canOpenRow ? (
                      <div className="grid gap-3 border-t border-[#eeeaf2] bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
                        {hasVisibleLiveScoring ? (
                          <LeagueChairLiveStatusList statuses={fixtureLiveStatuses} showScorer={false} />
                        ) : null}
                        {canEditInline ? (
                          <ManagerLineupCard
                            activeTeam={activeTeam}
                            preferredFixtureId={fixture.id}
                            inlineFixtureOnly
                            onDataRefresh={onDataRefresh}
                            onTeamSummaryUpdate={onTeamSummaryUpdate}
                          />
                        ) : canInspect ? (
                          <ReadOnlyFixtureDetails fixture={fixture} showWinPercentages={Boolean(activeTeam.hasLeagueChairAccess)} />
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {weeks.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn("h-2 w-4 rounded-full md:w-6", index === activeIndex ? "bg-[#10233f]" : "bg-[#d8d3df]")}
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
  inlineFixtureOnly = false,
  onDataRefresh,
  onTeamSummaryUpdate
}: {
  activeTeam: TeamContext;
  preferredFixtureId?: string;
  inlineFixtureOnly?: boolean;
  onDataRefresh?: () => void;
  onTeamSummaryUpdate?: (teamId: string, summary: TeamSummaryUpdate) => void;
}) {
  const [payload, setPayload] = useState<ManagerLineupPayload | null>(null);
  const [slots, setSlots] = useState<ManagerLineupSlot[]>(() => defaultLineupSlotsForLeague(activeTeam.league));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingGameIds, setPendingGameIds] = useState<Set<string>>(new Set());
  const [pendingBreak, setPendingBreak] = useState(false);
  const [pendingBreakIds, setPendingBreakIds] = useState<Set<string>>(new Set());
  const [completingMatch, setCompletingMatch] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<LineupPickerTarget>(null);
  const [breakTarget, setBreakTarget] = useState<BreakEntryTarget>(null);
  const [openedFixtureId, setOpenedFixtureId] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const dirtyDraftRef = useRef(false);
  const fixtureIdRef = useRef("");
  const matchSnapshotRef = useRef("");
  const payloadRef = useRef<ManagerLineupPayload | null>(null);
  const testManagerMode = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embed") === "1" &&
    new URLSearchParams(window.location.search).get("role")?.toLowerCase() === "manager";
  const testUserEmail = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("testUser")?.trim() ?? "";

  useEffect(() => {
    if (!pickerTarget || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pickerTarget]);

  useEffect(() => {
    if (!activeTeam.teamId) return;
    let cancelled = false;
    let firstLoad = true;
    dirtyDraftRef.current = false;
    fixtureIdRef.current = "";
    matchSnapshotRef.current = "";
    payloadRef.current = null;
    setInitialLoading(true);
    setSlots(defaultLineupSlotsForLeague(activeTeam.league));

    async function loadLineup() {
      if (!activeTeam.teamId) return;
      if (firstLoad) setMessage("");
      try {
        const params = new URLSearchParams({ teamId: activeTeam.teamId });
        const activeFixtureId = preferredFixtureId || fixtureIdRef.current;
        if (activeFixtureId) params.set("fixtureId", activeFixtureId);
        if (testManagerMode) params.set("testManager", "1");
        if (testUserEmail) params.set("testUser", testUserEmail);
        const response = await fetch(`/api/manager/lineup?${params.toString()}`, { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Lineup unavailable.");
        setPayload(data);
        payloadRef.current = data;
        const fixtureId = data.fixture?.id ?? "";
        const fixtureChanged = fixtureId !== fixtureIdRef.current;
        const lineupStatus = data.lineup?.status ?? "Draft";
        if (fixtureChanged) {
          fixtureIdRef.current = fixtureId;
          dirtyDraftRef.current = false;
          setOpenedFixtureId(preferredFixtureId && fixtureId === preferredFixtureId ? fixtureId : "");
        } else if (firstLoad && preferredFixtureId && fixtureId === preferredFixtureId) {
          setOpenedFixtureId(fixtureId);
        }
        if (firstLoad || fixtureChanged || lineupStatus === "Published" || !dirtyDraftRef.current) {
          setSlots(data.lineup?.slots?.length ? data.lineup.slots : defaultLineupSlotsForLeague(activeTeam.league));
        }
        const matchSnapshot = managerLineupSnapshot(data);
        if (!firstLoad && matchSnapshotRef.current && matchSnapshotRef.current !== matchSnapshot) {
          onDataRefresh?.();
        }
        matchSnapshotRef.current = matchSnapshot;
      } catch (error) {
        if (!cancelled && firstLoad) setMessage(error instanceof Error ? error.message : "Lineup unavailable.");
      } finally {
        if (!cancelled && firstLoad) setInitialLoading(false);
        firstLoad = false;
      }
    }

    let lastPollAt = Date.now();
    let statusPollInFlight = false;
    loadLineup();
    const poll = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const interval = testManagerMode
        ? MATCH_POLL_ACTIVE_MS
        : managerLineupPollInterval(payloadRef.current);
      if (!interval || Date.now() - lastPollAt < interval || statusPollInFlight) return;
      const fixtureId = payloadRef.current?.fixture?.id;
      const currentFixture = payloadRef.current?.weekFixtures.find((fixture) => fixture.id === fixtureId);
      if (!fixtureId || !currentFixture) return;
      lastPollAt = Date.now();
      statusPollInFlight = true;
      try {
        const nextStatuses = await loadFixtureStatuses([fixtureId]);
        if (fixtureStatusSnapshot([currentFixture]) !== fixtureStatusSnapshot(nextStatuses)) await loadLineup();
      } catch {
        // The next scheduled check or a manual refresh will retry.
      } finally {
        statusPollInFlight = false;
      }
    }, MATCH_POLL_TICK_MS);
    const refreshPanels = () => {
      lastPollAt = Date.now();
      loadLineup();
    };
    window.addEventListener("interclub:refresh-panels", refreshPanels);

    return () => {
      cancelled = true;
      window.removeEventListener("interclub:refresh-panels", refreshPanels);
      window.clearInterval(poll);
    };
  }, [activeTeam.teamId, activeTeam.league, preferredFixtureId, testManagerMode, testUserEmail]);

  function updateSlot(slotNumber: number, key: "player1Id" | "player2Id", value: string) {
    dirtyDraftRef.current = true;
    setSlots((current) => current.map((slot) => {
      if (slot.slotNumber !== slotNumber) return slot;
      const prefix = lineupPlayerPrefix(key);
      return {
        ...slot,
        [key]: value,
        [`${prefix}GuestName`]: "",
        [`${prefix}IsGuest`]: false,
        [`${prefix}CountsForStats`]: true
      };
    }));
  }

  function updateGuestSlot(slotNumber: number, key: "player1Id" | "player2Id", selection: GuestPlayerSelection) {
    dirtyDraftRef.current = true;
    setSlots((current) => current.map((slot) => {
      if (slot.slotNumber !== slotNumber) return slot;
      const prefix = lineupPlayerPrefix(key);
      return {
        ...slot,
        [key]: selection.playerId ?? "",
        [`${prefix}GuestName`]: selection.guestName ?? "",
        [`${prefix}IsGuest`]: true,
        [`${prefix}CountsForStats`]: false
      };
    }));
  }

  function selectedPlayerIdsExcept(slotNumber?: number, key?: "player1Id" | "player2Id") {
    if (payload?.fixture?.fixtureType === "Friendly") return new Set<string>();
    return new Set(
      slots.flatMap((slot) => {
        const ids = [];
        if (!(slot.slotNumber === slotNumber && key === "player1Id") && slot.player1Id && !slot.player1IsGuest) ids.push(slot.player1Id);
        if (!(slot.slotNumber === slotNumber && key === "player2Id") && slot.player2Id && !slot.player2IsGuest) ids.push(slot.player2Id);
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
  const guestPlayerOptions = payload?.guestPlayers ?? [];
  const ownStatus = payload?.lineup?.status ?? "Draft";
  const opponentName = payload?.fixture
    ? payload.fixture.homeTeamId === activeTeam.teamId ? payload.fixture.awayTeamName : payload.fixture.homeTeamName
    : "";
  const ownPublished = ownStatus === "Published";
  const opponentHasPublished = payload?.opponentStatus?.status === "Published";
  const canSeeOpponentLineup = ownStatus === "Published" && opponentHasPublished;
  const matchReady = Boolean(payload?.games.length);
  const matchLocked = payload?.fixture?.status === "Completed";
  const allGamesScored = Boolean(payload?.games.length && payload.games.every((game) => game.winner_team_id));
  const selectedCount = slots.reduce((count, slot) => {
    return count
      + (slot.player1Id || slot.player1GuestName ? 1 : 0)
      + (slot.gameType === "Doubles" && (slot.player2Id || slot.player2GuestName) ? 1 : 0);
  }, 0);
  const requiredPlayerSlots = slots.reduce((count, slot) => count + (slot.gameType === "Doubles" ? 2 : 1), 0);
  const directFixtureMode = Boolean(preferredFixtureId && payload?.fixture?.id === preferredFixtureId);
  const fixtureOpen = Boolean(payload?.fixture && (openedFixtureId === payload.fixture.id || directFixtureMode));
  const weekFixtures = payload?.weekFixtures?.length ? payload.weekFixtures : [];
  const visibleWeekFixtures = inlineFixtureOnly && preferredFixtureId
    ? weekFixtures.filter((fixture) => fixture.id === preferredFixtureId)
    : weekFixtures;
  const fixtureRows = visibleWeekFixtures.length ? visibleWeekFixtures : [{
    id: payload?.fixture?.id ?? "",
    fixtureDate: payload?.fixture?.fixtureDate ?? "",
    homeTeamId: payload?.fixture?.homeTeamId ?? "",
    awayTeamId: payload?.fixture?.awayTeamId ?? "",
    homeTeamName: payload?.fixture?.homeTeamName ?? "Home",
    awayTeamName: payload?.fixture?.awayTeamName ?? "Away",
    status: (payload?.fixture?.status ?? "Scheduled") as "Scheduled" | "Completed",
    matchId: null,
    homeTeamScore: null,
    awayTeamScore: null,
    homeLineupStatus: payload?.fixture?.homeTeamId === activeTeam.teamId ? ownStatus : payload?.opponentStatus?.status ?? null,
    awayLineupStatus: payload?.fixture?.awayTeamId === activeTeam.teamId ? ownStatus : payload?.opponentStatus?.status ?? null,
    completedGames: 0,
    totalGames: 0,
    lineups: [],
    games: []
  }];

  return (
    <Card className={inlineFixtureOnly ? "border-0 bg-transparent shadow-none" : undefined}>
      {!inlineFixtureOnly ? (
        <CardHeader>
          <CardTitle>{payload?.fixture?.fixtureType === "Friendly" ? "Friendly Match" : payload?.fixture?.fixtureType === "Cup" ? "Cup Match" : "Next Matches"}</CardTitle>
          {matchLocked && fixtureDateHasPassed(payload?.fixture?.fixtureDate) ? null : (
            <Badge variant={matchLocked ? "green" : matchReady ? "cyan" : ownStatus === "Published" ? "cyan" : payload?.lineup?.id ? "muted" : "muted"}>
              {matchLocked ? "Completed" : matchReady ? "Score ready" : ownStatus === "Published" ? "Published" : payload?.lineup?.id ? "Picked" : "Plan"}
            </Badge>
          )}
        </CardHeader>
      ) : null}
      <CardContent className={cn("grid gap-3", inlineFixtureOnly && "p-0")}>
        {!payload?.fixture ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            {initialLoading
              ? "Opening team picker..."
              : `No upcoming match is scheduled for ${activeTeam.name}. Completed results are available in Fixtures / Results.`}
          </p>
        ) : (
          <>
            <div className={cn("rounded-xl bg-[#f7f5fa] p-2", inlineFixtureOnly && "bg-transparent p-0")}>
              {!inlineFixtureOnly ? (
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">This week</p>
                  <p className="text-sm font-bold text-[#10233f]">{formatFixtureDate(payload.fixture.fixtureDate)}</p>
                </div>
                <Badge variant="muted">{weekFixtures.length || 1} matches</Badge>
                </div>
              ) : null}
              <div className="grid gap-2">
                {fixtureRows.map((fixture) => {
                  const isOwnFixture = fixture.homeTeamId === activeTeam.teamId || fixture.awayTeamId === activeTeam.teamId;
                  const bothPublished = fixture.homeLineupStatus === "Published" && fixture.awayLineupStatus === "Published";
                  const hasScore = fixture.homeTeamScore !== null && fixture.awayTeamScore !== null;
                  const matchStarted = Boolean(fixture.totalGames > 0);
                  const active = inlineFixtureOnly || fixture.id === openedFixtureId || (directFixtureMode && fixture.id === payload.fixture?.id);
                  const fixtureLocked = fixture.status === "Completed";
                  const canManageFixture = Boolean(payload.canManage && isOwnFixture && !fixtureLocked);
                  const managerActionSide = activeTeam.teamId === fixture.awayTeamId ? "away" : "home";
                  const managedLineupStatus = activeTeam.teamId === fixture.awayTeamId ? fixture.awayLineupStatus : fixture.homeLineupStatus;
                  const managedPublished = managedLineupStatus === "Published";
                  const showLineupStatus = isOwnFixture && !matchStarted && !fixtureLocked && !hasScore;
                  const completedStatusLabel = fixtureDateHasPassed(fixture.fixtureDate) ? "" : "Completed";
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
                      {!inlineFixtureOnly ? (
                        <button
                          type="button"
                          onClick={() => setOpenedFixtureId((current) => current === fixture.id ? "" : fixture.id)}
                          aria-expanded={active}
                          className={cn(
                            "grid w-full gap-2 p-3 text-left transition-colors hover:bg-[#f7f5fa]"
                          )}
                        >
                        <div className="grid gap-2 md:hidden">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                            <FixtureTeamLabel teamName={fixture.homeTeamName} lineupStatus={showLineupStatus ? fixture.homeLineupStatus : undefined} />
                            {hasScore ? (
                              <span className={cn("grid h-8 min-w-12 place-items-center rounded-md px-2 text-sm font-black ring-1", scoreTone(fixture.homeTeamScore ?? 0, fixture.awayTeamScore ?? 0))}>
                                {fixture.homeTeamScore}
                              </span>
                            ) : (
                              <span className="text-xs font-black uppercase text-[#6c5a73]">Home</span>
                            )}
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                            <FixtureTeamLabel teamName={fixture.awayTeamName} lineupStatus={showLineupStatus ? fixture.awayLineupStatus : undefined} />
                            {hasScore ? (
                              <span className={cn("grid h-8 min-w-12 place-items-center rounded-md px-2 text-sm font-black ring-1", scoreTone(fixture.awayTeamScore ?? 0, fixture.homeTeamScore ?? 0))}>
                                {fixture.awayTeamScore}
                              </span>
                            ) : (
                              <span className="text-xs font-black uppercase text-[#6c5a73]">Away</span>
                            )}
                          </div>
                        </div>
                        <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:grid">
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
                          ) : fixtureLocked || hasScore || matchStarted ? (
                            <span className="col-span-2 text-xs font-bold text-[#6c5a73]">
                              {fixtureLocked || hasScore ? completedStatusLabel : "Lineups and frames available"}
                            </span>
                          ) : null}
                          <ChevronDown className={cn("col-start-2 row-start-1 h-4 w-4 justify-self-center text-[#6c5a73] transition-transform", active && "rotate-180")} />
                        </div>
                        </button>
                      ) : null}
                      {active ? (
                        <div className="grid gap-3 border-t border-[#eeeaf2] bg-white p-3">
                          {isOwnFixture && !matchLocked && payload.opponentStatus ? (
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
                          {isOwnFixture && matchReady && payload.canManage && !matchLocked ? (
                            <GeneratedMatchCard
                              payload={payload}
                              onRecord={recordGameWinner}
                              onBreak={(game) => setBreakTarget({ game, fixture: payload.fixture! })}
                              onDeleteBreak={deleteBreak}
                              pendingGameIds={pendingGameIds}
                              pendingBreakIds={pendingBreakIds}
                              locked={matchLocked || !payload.canManage}
                              showWinPercentages={Boolean(activeTeam.hasLeagueChairAccess)}
                            />
                          ) : null}
                          {isOwnFixture && matchReady && (matchLocked || !payload.canManage) ? <ReadOnlyFixtureDetails fixture={fixture} showWinPercentages={Boolean(activeTeam.hasLeagueChairAccess)} /> : null}
                          {isOwnFixture && payload.canManage && matchReady && !matchLocked ? (
                            <div className="grid gap-2 rounded-xl bg-[#f7f5fa] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Lock match</p>
                                  <p className="text-sm font-bold text-[#10233f]">
                                    Confirm completion once all games are correct.
                                  </p>
                                </div>
                                <Badge variant={allGamesScored ? "green" : "muted"}>{allGamesScored ? "Ready" : "Incomplete"}</Badge>
                              </div>
                              <Button onClick={completeMatch} disabled={!allGamesScored || completingMatch}>
                                {completingMatch ? "Completing..." : "Match Completed"}
                              </Button>
                            </div>
                          ) : null}
                          {!isOwnFixture ? <ReadOnlyFixtureDetails fixture={fixture} showWinPercentages={Boolean(activeTeam.hasLeagueChairAccess)} /> : null}
                          {isOwnFixture && !managedPublished && payload.canManage && !matchLocked ? (
                            <>
                              <div className="grid gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5fa] p-3">
                                  <div>
                                    <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Team sheet</p>
                                    <p className="text-sm font-bold text-[#10233f]">
                                      Tap each slot to pick a player for the fixed match order.
                                    </p>
                                  </div>
                                  <Badge variant="muted">{selectedCount}/{requiredPlayerSlots} picked</Badge>
                                </div>
                                {slots.map((slot) => (
                                  <LineupSlotRow
                                    key={slot.slotNumber}
                                    slot={slot}
                                    players={playerOptions}
                                    guestPlayers={guestPlayerOptions}
                                    onPick={(key, label) => setPickerTarget({ slotNumber: slot.slotNumber, key, label })}
                                    onClear={(key) => updateSlot(slot.slotNumber, key, "")}
                                  />
                                ))}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Button variant="secondary" onClick={() => submitLineup("save")} disabled={busy}>
                                  Save draft
                                </Button>
                                <Button onClick={() => submitLineup("publish")} disabled={busy || selectedCount < requiredPlayerSlots}>
                                  {selectedCount < requiredPlayerSlots ? `Pick ${requiredPlayerSlots - selectedCount} more` : "Publish lineup"}
                                </Button>
                              </div>
                              {selectedCount < requiredPlayerSlots ? (
                                <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">
                                  Pick all {requiredPlayerSlots} player slots before publishing. Drafts can still be saved.
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          {isOwnFixture && managedPublished && !matchLocked ? <PublishedLineupSummary title={`${activeTeam.name} published lineup`} slots={payload.lineup?.slots ?? slots} /> : null}
                          {isOwnFixture && payload.opponentLineup && !matchLocked ? <PublishedLineupSummary title={`${payload.opponentLineup.teamName} lineup`} slots={payload.opponentLineup.slots} /> : null}
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
                guestPlayers={guestPlayerOptions}
                slot={slots.find((slot) => slot.slotNumber === pickerTarget.slotNumber)}
                value={slots.find((slot) => slot.slotNumber === pickerTarget.slotNumber)?.[pickerTarget.key] ?? ""}
                unavailablePlayerIds={selectedPlayerIdsExcept(pickerTarget.slotNumber, pickerTarget.key)}
                onSelect={(playerId) => {
                  updateSlot(pickerTarget.slotNumber, pickerTarget.key, playerId);
                  setPickerTarget(null);
                }}
                onSelectGuest={(selection) => {
                  updateGuestSlot(pickerTarget.slotNumber, pickerTarget.key, selection);
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

  async function recordGameWinner(gameId: string, winnerTeamId: string | null) {
    if (!activeTeam.teamId || !payload?.fixture) return;
    if (payload.fixture.status === "Completed") return;
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
      setMessage(winnerTeamId ? "Game result updated." : "Game result reset.");
      window.dispatchEvent(new Event("interclub:refresh-panels"));
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

  async function completeMatch() {
    if (!activeTeam.teamId || !payload?.fixture) return;
    if (payload.fixture.status === "Completed") return;
    const previousPayload = payload;
    setCompletingMatch(true);
    setMessage("");
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          fixtureId: payload.fixture.id,
          action: "completeMatch",
          testManager: testManagerMode,
          testUser: testUserEmail
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not complete match.");
      setPayload(data);
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setMessage("Match completed and locked.");
      onDataRefresh?.();
    } catch (error) {
      setPayload(previousPayload);
      setMessage(error instanceof Error ? error.message : "Could not complete match.");
    } finally {
      setCompletingMatch(false);
    }
  }

  async function recordBreak(gameId: string, playerId: string, breakValue: number) {
    if (!activeTeam.teamId || !payload?.fixture) return;
    if (payload.fixture.status === "Completed") return;
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

  async function deleteBreak(gameId: string, breakId: string) {
    if (!activeTeam.teamId || !payload?.fixture || payload.fixture.status === "Completed") return;
    if (pendingBreakIds.has(breakId)) return;
    setPendingBreakIds((current) => new Set(current).add(breakId));
    setMessage("");
    try {
      const response = await fetch("/api/manager/lineup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: activeTeam.teamId,
          fixtureId: payload.fixture.id,
          action: "deleteBreak",
          gameId,
          breakId,
          testManager: testManagerMode,
          testUser: testUserEmail
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete break.");
      setPayload(data);
      setSlots(data.lineup?.slots?.length ? data.lineup.slots : slots);
      setMessage("Break deleted.");
      onDataRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete break.");
    } finally {
      setPendingBreakIds((current) => {
        const next = new Set(current);
        next.delete(breakId);
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

function applyOptimisticGameWinner(payload: ManagerLineupPayload, gameId: string, winnerTeamId: string | null): ManagerLineupPayload {
  const fixture = payload.fixture;
  if (!fixture) return payload;

  const games = payload.games.map((game) => (
    game.id === gameId ? { ...game, winner_team_id: winnerTeamId } : game
  ));
  const homeTeamScore = games.reduce((total, game) => total + (game.winner_team_id === fixture.homeTeamId ? game.points_awarded : 0), 0);
  const awayTeamScore = games.reduce((total, game) => total + (game.winner_team_id === fixture.awayTeamId ? game.points_awarded : 0), 0);

  return {
    ...payload,
    fixture: {
      ...fixture
    },
    games,
    weekFixtures: payload.weekFixtures.map((weekFixture) => (
      weekFixture.id === fixture.id
        ? {
            ...weekFixture,
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
  return payload.games.length > 0 && payload.games.every((game) => game.winner_team_id);
}

function liveSummaryFromGameChange(activeTeam: TeamContext, previousPayload: ManagerLineupPayload, nextPayload: ManagerLineupPayload): TeamSummaryUpdate | null {
  if (!activeTeam.teamId || !nextPayload.fixture) return null;
  if (nextPayload.fixture.fixtureType === "Friendly") return null;

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
  guestPlayers,
  onPick,
  onClear
}: {
  slot: ManagerLineupSlot;
  players: LineupPlayerOption[];
  guestPlayers: LineupPlayerOption[];
  onPick: (key: "player1Id" | "player2Id", label: string) => void;
  onClear: (key: "player1Id" | "player2Id") => void;
}) {
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
          value={lineupSlotDisplayName(slot, "player1Id", players, guestPlayers)}
          isGuest={Boolean(slot.player1IsGuest)}
          onPick={() => onPick("player1Id", `${slot.label} ${slot.gameType === "Doubles" ? "Player 1" : "Player"}`)}
          onClear={() => onClear("player1Id")}
        />
        {slot.gameType === "Doubles" ? (
          <PlayerSlotButton
            label="Player 2"
            value={lineupSlotDisplayName(slot, "player2Id", players, guestPlayers)}
            isGuest={Boolean(slot.player2IsGuest)}
            onPick={() => onPick("player2Id", `${slot.label} Player 2`)}
            onClear={() => onClear("player2Id")}
          />
        ) : null}
      </div>
    </div>
  );
}

function PlayerSlotButton({ label, value, isGuest = false, onPick, onClear }: { label: string; value: string; isGuest?: boolean; onPick: () => void; onClear: () => void }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-bold uppercase text-[#6c5a73]">{label}</p>
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[#d8d3df] bg-[#f7f5fa] p-2">
        <button
          type="button"
          className="min-h-10 min-w-0 flex-1 rounded-lg bg-white px-3 text-left text-sm font-bold text-[#10233f] shadow-sm transition-colors hover:bg-[#eef7f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
          onClick={onPick}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">{value || "Pick player"}</span>
            {value && isGuest ? <Badge variant="cyan">Guest Player</Badge> : null}
          </span>
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
  guestPlayers,
  slot,
  value,
  unavailablePlayerIds,
  onSelect,
  onSelectGuest,
  onClose
}: {
  target: NonNullable<LineupPickerTarget>;
  players: LineupPlayerOption[];
  guestPlayers: LineupPlayerOption[];
  slot?: ManagerLineupSlot;
  value: string;
  unavailablePlayerIds: Set<string>;
  onSelect: (playerId: string) => void;
  onSelectGuest: (selection: GuestPlayerSelection) => void;
  onClose: () => void;
}) {
  const prefix = lineupPlayerPrefix(target.key);
  const selectedGuestName = String(slot?.[`${prefix}GuestName` as keyof ManagerLineupSlot] ?? "");
  const selectedIsGuest = Boolean(slot?.[`${prefix}IsGuest` as keyof ManagerLineupSlot]);
  const [manualGuestName, setManualGuestName] = useState(selectedGuestName);
  const cleanManualGuestName = manualGuestName.trim().replace(/\s+/g, " ");

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#071426]/50 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Pick player for ${target.label}`}>
      <div className="mx-auto flex max-h-[min(82vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-elevated">
        <div className="flex shrink-0 items-start justify-between gap-3">
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
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
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
              const selected = player.id === value && !selectedIsGuest;
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
            <div className="mt-2 grid gap-2 border-t border-[#eeeaf2] pt-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Guest Player</p>
                <p className="text-xs font-bold text-[#6c5a73]">Use only for players from a lower team in your club. Guest Players do not count in player stats.</p>
              </div>
              {guestPlayers.length ? (
                <div className="grid gap-2">
                  {guestPlayers.map((player) => {
                    const selected = selectedIsGuest && player.id === value;
                    const disabled = Boolean(player.disabledReason) && !selected;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        className={cn(
                          "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]",
                          selected
                            ? "border-[#04f5ff] bg-[#eefbff] text-[#10233f]"
                            : disabled
                              ? "border-[#eeeaf2] bg-[#f7f5fa] text-[#8a7d91] opacity-70"
                              : "border-[#eeeaf2] bg-[#f7f5fa] text-[#10233f] hover:bg-[#eef7f5]"
                        )}
                        onClick={() => {
                          if (!disabled) onSelectGuest({ playerId: player.id });
                        }}
                        disabled={disabled}
                      >
                        <span className="grid min-w-0 gap-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate">{player.name}</span>
                            {player.teamName ? (
                              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 align-super text-[10px] font-black uppercase leading-none text-[#6c5a73] ring-1 ring-[#d8d3df]">
                                {player.teamName}
                              </span>
                            ) : null}
                          </span>
                          {player.disabledReason ? (
                            <span className="text-[10px] font-black uppercase tracking-wide text-[#6c5a73]">
                              {player.disabledReason}
                            </span>
                          ) : null}
                        </span>
                        <Badge variant={selected ? "cyan" : "muted"}>Guest Player</Badge>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">
                  No lower-team players are available for this team.
                </p>
              )}
              <div className="grid gap-2 rounded-xl bg-[#fff7e6] p-2 ring-1 ring-[#f0d8a8]">
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Fallback</p>
                  <p className="text-xs font-bold text-[#6c5a73]">Only use this if the lower-team player is not yet in the system.</p>
                </div>
                <label className="grid gap-1 text-xs font-extrabold uppercase text-[#6c5a73]">
                  Type Guest Player name
                  <input
                    className="min-h-11 rounded-lg border border-[#d8d3df] bg-white px-3 text-sm font-bold normal-case text-[#10233f] outline-none focus:border-[#7bc7d6] focus:ring-2 focus:ring-[#7bc7d6]/30"
                    value={manualGuestName}
                    onChange={(event) => setManualGuestName(event.target.value)}
                    placeholder="Guest player name"
                  />
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={cleanManualGuestName.length < 2}
                  onClick={() => onSelectGuest({ guestName: cleanManualGuestName })}
                >
                  Use typed Guest Player
                </Button>
              </div>
            </div>
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

function guestBadgeLabel(isGuest?: boolean, guestTeamName?: string | null) {
  if (!isGuest) return "";
  return (guestTeamName || "Guest").trim();
}

type GuestTaggedPlayer = {
  name?: string | null;
  isGuest?: boolean;
  guestTeamName?: string | null;
  winPercentage?: number | null;
};

function gameSidePlayers(game: ManagerLineupGame, side: "home" | "away"): GuestTaggedPlayer[] {
  return side === "home"
    ? [
        { name: game.home_player_1_name, isGuest: game.home_player_1_is_guest, guestTeamName: game.home_player_1_guest_team_name, winPercentage: game.home_player_1_win_percentage },
        { name: game.home_player_2_name, isGuest: game.home_player_2_is_guest, guestTeamName: game.home_player_2_guest_team_name, winPercentage: game.home_player_2_win_percentage }
      ]
    : [
        { name: game.away_player_1_name, isGuest: game.away_player_1_is_guest, guestTeamName: game.away_player_1_guest_team_name, winPercentage: game.away_player_1_win_percentage },
        { name: game.away_player_2_name, isGuest: game.away_player_2_is_guest, guestTeamName: game.away_player_2_guest_team_name, winPercentage: game.away_player_2_win_percentage }
      ];
}

function slotPlayers(slot: {
  gameType: "Singles" | "Doubles";
  player1Name?: string | null;
  player2Name?: string | null;
  player1IsGuest?: boolean;
  player2IsGuest?: boolean;
  player1GuestTeamName?: string | null;
  player2GuestTeamName?: string | null;
}): GuestTaggedPlayer[] {
  return [
    { name: slot.player1Name, isGuest: slot.player1IsGuest, guestTeamName: slot.player1GuestTeamName },
    { name: slot.gameType === "Doubles" ? slot.player2Name : "", isGuest: slot.player2IsGuest, guestTeamName: slot.player2GuestTeamName }
  ];
}

function playerNamesText(players: GuestTaggedPlayer[]) {
  return players.map((player) => player.name).filter(Boolean).join(" / ") || "TBC";
}

function PlayerGuestBadge({ isGuest, guestTeamName }: { isGuest?: boolean; guestTeamName?: string | null }) {
  const label = guestBadgeLabel(isGuest, guestTeamName);
  if (!label) return null;
  return <span className="shrink-0 rounded bg-[#eefbff] px-1.5 py-0.5 text-[10px] font-black uppercase text-[#10233f] ring-1 ring-[#04f5ff55]">{label}</span>;
}

function PlayerNameWithGuest({ align, player, showWinPercentage = false }: { align?: "left" | "right"; player: GuestTaggedPlayer; showWinPercentage?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full flex-wrap items-center gap-1", align === "right" ? "justify-end text-right" : "")}>
      <span className="min-w-0 whitespace-normal break-words">{player.name || "TBC"}</span>
      {showWinPercentage && player.winPercentage !== null && player.winPercentage !== undefined ? (
        <span className="shrink-0 text-[10px] font-bold opacity-60">({Math.round(player.winPercentage)}%)</span>
      ) : null}
      <PlayerGuestBadge isGuest={player.isGuest} guestTeamName={player.guestTeamName} />
    </span>
  );
}

function GamePlayerLabel({ align = "left", players, className, showWinPercentages = false }: { align?: "left" | "right"; players: GuestTaggedPlayer[]; className?: string; showWinPercentages?: boolean }) {
  const visiblePlayers = players.filter((player) => player.name);
  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 leading-tight", align === "right" ? "justify-end text-right" : "", className)}>
      {(visiblePlayers.length ? visiblePlayers : [{ name: "TBC" }]).map((player, index) => (
        <Fragment key={`${player.name || "TBC"}-${index}`}>
          {index ? <span className="shrink-0 text-[#6c5a73]">/</span> : null}
          <PlayerNameWithGuest align={align} player={player} showWinPercentage={showWinPercentages} />
        </Fragment>
      ))}
    </p>
  );
}

function ReadOnlyFixtureDetails({
  fixture,
  showWinPercentages = false
}: {
  fixture: {
    games?: ManagerLineupGame[];
    lineups?: FixtureWeekFixture["lineups"];
    status: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamScore?: number | null;
    awayTeamScore?: number | null;
  };
  showWinPercentages?: boolean;
}) {
  const games = fixture.games ?? [];
  const lineups = fixture.lineups ?? [];
  const showPlayerWinPercentages = Boolean(showWinPercentages && fixture.status !== "Completed");

  if (!games.length) {
    if (lineups.length) {
      return <ReadOnlyPublishedLineups lineups={lineups} />;
    }

    if (fixture.status === "Completed" && fixture.homeTeamScore !== null && fixture.homeTeamScore !== undefined && fixture.awayTeamScore !== null && fixture.awayTeamScore !== undefined) {
      return (
        <div className="rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Final score</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <p className={cn("min-w-0 break-words text-sm font-extrabold leading-tight", fixture.homeTeamScore > fixture.awayTeamScore ? "text-[#00a85a]" : "text-[#10233f]")}>
              {fixture.homeTeamName ?? "Home"}
            </p>
            <span className="rounded-lg bg-[#10233f] px-2.5 py-1 text-sm font-black text-white">
              {fixture.homeTeamScore}-{fixture.awayTeamScore}
            </span>
            <p className={cn("min-w-0 break-words text-right text-sm font-extrabold leading-tight", fixture.awayTeamScore > fixture.homeTeamScore ? "text-[#00a85a]" : "text-[#10233f]")}>
              {fixture.awayTeamName ?? "Away"}
            </p>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#6c5a73]">
            Final result recorded.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-[#f7f5fa] p-3">
        <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Match details</p>
        <p className="mt-1 text-sm font-bold text-[#10233f]">
          Live scores and frame details will appear here once scoring starts.
        </p>
      </div>
    );
  }

  const completedGames = games.filter((game) => game.winner_team_id).length;

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-[#eeeaf2]">
      <div className="flex items-center justify-between gap-2 border-b border-[#eeeaf2] bg-[#f7f5fa] px-3 py-2">
        <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Frame details</p>
        <Badge variant={fixture.status === "Completed" ? "green" : completedGames ? "cyan" : "muted"}>
          {fixture.status === "Completed" ? "Final" : completedGames ? `${completedGames}/${games.length} played` : "Published"}
        </Badge>
      </div>
      <div className="divide-y divide-[#eeeaf2]">
        {games.map((game) => {
          const homeWon = game.winner_team_id === fixture.homeTeamId;
          const awayWon = game.winner_team_id === fixture.awayTeamId;
          const homePlayers = gameSidePlayers(game, "home");
          const awayPlayers = gameSidePlayers(game, "away");
          return (
            <div key={game.id} className="grid gap-1.5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase text-[#6c5a73]">
                  Game {game.game_number} · {game.game_type} · {game.points_awarded} {game.points_awarded === 1 ? "pt" : "pts"}
                </p>
                {!game.winner_team_id ? <Badge variant="muted">Awaiting</Badge> : null}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-stretch gap-1.5 text-xs font-extrabold sm:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] sm:gap-2 sm:text-sm">
                <GamePlayerLabel className={cn(homeWon ? "bg-[#e9fff4] text-[#007a45]" : "bg-[#f7f5fa] text-[#10233f]")} players={homePlayers} showWinPercentages={showPlayerWinPercentages} />
                <span className="grid place-items-center text-center text-xs font-black uppercase text-[#6c5a73]">v</span>
                <GamePlayerLabel align="right" className={cn(awayWon ? "bg-[#e9fff4] text-[#007a45]" : "bg-[#f7f5fa] text-[#10233f]")} players={awayPlayers} showWinPercentages={showPlayerWinPercentages} />
              </div>
              {game.breaks?.length ? (
                <div className="flex flex-wrap gap-1">
                  {game.breaks.map((item) => (
                    <span key={item.id} className="rounded-md bg-[#eefbff] px-2 py-0.5 text-[11px] font-extrabold text-[#10233f] ring-1 ring-[#04f5ff55]">
                      {item.playerName} {item.breakValue}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyPublishedLineups({ lineups }: { lineups: NonNullable<FixtureWeekFixture["lineups"]> }) {
  return (
    <div className="grid gap-2">
      {lineups.map((lineup) => (
        <section key={lineup.teamId} className="overflow-hidden rounded-xl bg-white ring-1 ring-[#eeeaf2]">
          <div className="flex items-center justify-between gap-2 border-b border-[#eeeaf2] bg-[#f7f5fa] px-3 py-2">
            <p className="min-w-0 truncate text-xs font-extrabold uppercase text-[#6c5a73]">{lineup.teamName} lineup</p>
            <Badge variant="green">Published</Badge>
          </div>
          <div className="divide-y divide-[#eeeaf2]">
            {lineup.slots.map((slot) => (
              <div key={`${lineup.teamId}-${slot.slotNumber}`} className="grid gap-1 px-3 py-2.5">
                <p className="text-[11px] font-extrabold uppercase text-[#6c5a73]">
                  Game {slot.slotNumber} · {slot.gameType}
                </p>
                <div className="rounded-md bg-[#f7f5fa] px-2 py-1.5 text-sm font-extrabold leading-tight text-[#10233f]">
                  <GamePlayerLabel
                    className="px-0 py-0"
                    players={slotPlayers(slot)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GeneratedMatchCard({
  payload,
  onRecord,
  onBreak,
  onDeleteBreak,
  pendingGameIds,
  pendingBreakIds,
  locked = false,
  showWinPercentages = false
}: {
  payload: ManagerLineupPayload;
  onRecord: (gameId: string, winnerTeamId: string | null) => void;
  onBreak: (game: ManagerLineupGame) => void;
  onDeleteBreak: (gameId: string, breakId: string) => void;
  pendingGameIds: Set<string>;
  pendingBreakIds: Set<string>;
  locked?: boolean;
  showWinPercentages?: boolean;
}) {
  const games = payload.games;
  const fixture = payload.fixture;
  if (!fixture) return null;
  const showPlayerWinPercentages = Boolean(showWinPercentages && fixture.status !== "Completed");

  return (
    <div className="rounded-xl bg-[#10233f] p-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase text-white/60">{locked ? "Final result" : "Result entry"}</p>
        {locked ? <Badge variant="green">Locked</Badge> : null}
      </div>
      <div className="mt-2 grid gap-2">
        {games.map((game) => {
          const breaks = game.breaks ?? [];
          const homePlayers = gameSidePlayers(game, "home");
          const awayPlayers = gameSidePlayers(game, "away");
          const homePlayerText = playerNamesText(homePlayers);
          const awayPlayerText = playerNamesText(awayPlayers);
          const homeSelected = game.winner_team_id === fixture.homeTeamId;
          const awaySelected = game.winner_team_id === fixture.awayTeamId;
          const pending = pendingGameIds.has(game.id);
          return (
            <div key={game.id} className="grid gap-2 rounded-lg bg-white/10 p-2 text-sm font-bold">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase text-white/55">Game {game.game_number} - {game.points_awarded} pts</p>
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 leading-tight">
                  <GamePlayerLabel className="bg-transparent px-0 py-0 text-white" players={homePlayers} showWinPercentages={showPlayerWinPercentages} />
                  <span className="text-white/55">v</span>
                  <GamePlayerLabel align="right" className="bg-transparent px-0 py-0 text-white" players={awayPlayers} showWinPercentages={showPlayerWinPercentages} />
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <Button className="min-h-10 whitespace-normal px-2 py-1 text-xs leading-tight" size="sm" disabled={locked || pending} variant={homeSelected ? "default" : "secondary"} onClick={() => onRecord(game.id, homeSelected ? null : fixture.homeTeamId)}>
                  {pending && homeSelected ? "..." : homePlayerText}
                </Button>
                <Button className="min-h-10 whitespace-normal px-2 py-1 text-xs leading-tight" size="sm" disabled={locked || pending} variant={awaySelected ? "default" : "secondary"} onClick={() => onRecord(game.id, awaySelected ? null : fixture.awayTeamId)}>
                  {pending && awaySelected ? "..." : awayPlayerText}
                </Button>
              </div>
              <div className="rounded-lg bg-[#071426]/35 px-2.5 py-2 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/55">Breaks</span>
                    {breaks.map((item) => (
                      <span key={item.id} className="inline-flex min-w-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-extrabold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7bc7d6]" />
                        <span className="break-words">{item.playerName}</span>
                        <span className="rounded bg-white/15 px-1.5 py-0.5">{item.breakValue}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteBreak(game.id, item.id)}
                          disabled={locked || pendingBreakIds.has(item.id)}
                          className="ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded text-white/65 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Delete ${item.playerName} break of ${item.breakValue}`}
                          title="Delete break"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                    {!breaks.length ? <span className="text-xs font-semibold text-white/45">None</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onBreak(game)}
                    disabled={locked}
                    className="min-h-8 rounded-md bg-white/10 px-2 text-xs font-extrabold text-[#7bc7d6] transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
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
    { id: game.home_player_1_id, name: game.home_player_1_name, countsForStats: game.home_player_1_counts_for_stats !== false },
    { id: game.home_player_2_id, name: game.home_player_2_name ?? "", countsForStats: game.home_player_2_counts_for_stats !== false },
    { id: game.away_player_1_id, name: game.away_player_1_name, countsForStats: game.away_player_1_counts_for_stats !== false },
    { id: game.away_player_2_id, name: game.away_player_2_name ?? "", countsForStats: game.away_player_2_counts_for_stats !== false }
  ].filter((player): player is { id: string; name: string; countsForStats: boolean } => Boolean(player.id && player.name && player.countsForStats));
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

type TeamPlayerStat = {
  personId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  winPercentage: number;
  highestBreak: number | null;
};

function SquadManagementCard({ activeTeam, userCanShare = false }: { activeTeam: TeamContext; userCanShare?: boolean }) {
  const [players, setPlayers] = useState<TeamPlayerStat[]>([]);
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
    fetch(withTestUser(`/api/team/player-stats?teamId=${encodeURIComponent(activeTeam.teamId)}`), { credentials: "same-origin" })
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
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {userCanShare && players.length ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void shareSvgVisual(
                  `${activeTeam.name.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-player-stats.svg`,
                  `${activeTeam.name} ${activeTeam.season} player stats`,
                  buildTeamPlayerStatsShareSvg(activeTeam, players)
                );
              }}
              className="min-h-9 px-3 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Badge variant="muted">{loading ? "Loading" : `${players.length}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="grid grid-cols-[minmax(112px,1fr)_30px_30px_30px_44px_38px] gap-1.5 rounded-xl bg-[#f7f5fa] px-2.5 py-2 text-[10px] font-extrabold uppercase text-[#6c5a73] sm:grid-cols-[minmax(150px,1fr)_44px_44px_44px_58px_54px] sm:gap-2 sm:px-3 sm:text-[11px]">
          <span>Player</span>
          <span className="text-right">P</span>
          <span className="text-right">W</span>
          <span className="text-right">L</span>
          <span className="text-right">Win</span>
          <span className="text-right">Break</span>
        </div>
        {players.map((player) => (
          <div key={player.personId} className="grid min-h-12 grid-cols-[minmax(112px,1fr)_30px_30px_30px_44px_38px] items-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-[13px] font-bold ring-1 ring-[#eeeaf2] sm:grid-cols-[minmax(150px,1fr)_44px_44px_44px_58px_54px] sm:gap-2 sm:px-3 sm:text-sm">
            <span className="min-w-0 whitespace-normal break-normal font-extrabold leading-tight [overflow-wrap:normal]">{player.name}</span>
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

type LeaguePlayerStat = {
  personId: string;
  name: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  winPercentage: number;
  highestBreak: number | null;
  remainingFixtures: number;
  canReachMinimum: boolean;
};

type LeagueBreakLeaderboardRow = {
  id: string;
  breakValue: number;
  fixtureDate: string | null;
  playerName: string;
  teamName: string | null;
  opponentTeamName: string | null;
  venueSide: "H" | "A" | null;
  gameNumber: number | null;
};

function LeaguePlayerStatsCard({ activeTeam, userCanShare = false }: { activeTeam: TeamContext; userCanShare?: boolean }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<LeaguePlayerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ league: activeTeam.league, season: activeTeam.season });
    fetch(withTestUser(`/api/league/player-stats?${params.toString()}`), { credentials: "same-origin" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "League player stats unavailable.");
        setPlayers(data.players ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "League player stats unavailable.");
        setPlayers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam.league, activeTeam.season, open]);

  const eligiblePlayers = players.filter((player) => player.canReachMinimum);
  const belowMinimumPlayers = players.filter((player) => !player.canReachMinimum);

  const sharePlayerStats = () => {
    void shareSvgVisual(
      `${activeTeam.league.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-player-stats.svg`,
      `${activeTeam.league} ${activeTeam.season} player stats`,
      buildLeaguePlayerStatsShareSvg(activeTeam, players)
    );
  };

  return (
    <Card className="xl:col-span-2">
      <div className="flex w-full items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <span className="block text-lg font-extrabold text-[#25002b]">{activeTeam.league} Player Stats</span>
          <span className="mt-1 block text-sm font-semibold text-[#6c5a73]">Eligible players first, then win percentage</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {userCanShare && players.length ? (
            <Button type="button" variant="secondary" size="sm" onClick={sharePlayerStats} className="min-h-9 px-3 text-xs">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-2"
            aria-label={open ? "Close player stats" : "Open player stats"}
            aria-expanded={open}
          >
            <Badge variant="muted">{open ? loading ? "Loading" : `${players.length}` : "Closed"}</Badge>
            <ChevronDown className={cn("h-5 w-5 text-[#6c5a73] transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      {open ? (
        <CardContent className="grid gap-3 border-t border-[#eeeaf2] pt-3">
          <p className="text-sm font-semibold text-[#6c5a73]">
            Players who cannot reach 12 matches are shown below the main table.
          </p>
          <LeaguePlayerStatsRows players={eligiblePlayers} emptyLabel={loading ? "Loading player stats..." : message || "No eligible player stats yet."} />
          {belowMinimumPlayers.length ? (
            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Below 12-match eligibility</p>
                <Badge variant="muted">{belowMinimumPlayers.length}</Badge>
              </div>
              <LeaguePlayerStatsRows players={belowMinimumPlayers} emptyLabel="" />
            </section>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function LeaguePlayerStatsRows({ players, emptyLabel }: { players: LeaguePlayerStat[]; emptyLabel: string }) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(118px,1fr)_42px_42px_42px_44px] gap-1.5 rounded-xl bg-[#f7f5fa] px-2.5 py-2 text-[10px] font-extrabold uppercase text-[#6c5a73] sm:grid-cols-[minmax(180px,1fr)_minmax(120px,0.7fr)_54px_54px_54px_64px_56px] sm:gap-2 sm:px-3 sm:text-[11px]">
        <span>Player</span>
        <span className="hidden sm:block">Team</span>
        <span className="text-right">P</span>
        <span className="text-right">W</span>
        <span className="text-right">L</span>
        <span className="text-right">Win</span>
        <span className="hidden text-right sm:block">Break</span>
      </div>
      {players.map((player) => {
        const colors = teamColors(player.teamName);
        return (
          <div key={`${player.personId}-${player.teamName}`} className={cn(
            "grid min-h-12 grid-cols-[minmax(118px,1fr)_42px_42px_42px_44px] items-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-[13px] font-bold ring-1 ring-[#eeeaf2] sm:grid-cols-[minmax(180px,1fr)_minmax(120px,0.7fr)_54px_54px_54px_64px_56px] sm:gap-2 sm:px-3 sm:text-sm",
            !player.canReachMinimum && "bg-[#fbf9fd] text-[#6c5a73]"
          )}>
            <span className="min-w-0">
              <span className="block truncate font-extrabold leading-tight" style={{ color: colors.primaryColor }}>{player.name}</span>
              <span className="block truncate text-[11px] font-bold sm:hidden" style={{ color: colors.primaryColor }}>{player.teamName}</span>
            </span>
            <span className="hidden min-w-0 truncate font-bold sm:block" style={{ color: colors.primaryColor }}>{player.teamName}</span>
            <span className="text-right">{player.played}</span>
            <span className="text-right text-[#0a6b45]">{player.won}</span>
            <span className="text-right text-[#b42318]">{player.lost}</span>
            <span className="text-right">{player.played ? `${player.winPercentage}%` : "-"}</span>
            <span className="hidden text-right sm:block">{player.highestBreak ?? "-"}</span>
          </div>
        );
      })}
      {!players.length && emptyLabel ? (
        <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">{emptyLabel}</p>
      ) : null}
    </div>
  );
}

function LeagueBreaksCard({ activeTeam }: { activeTeam: TeamContext }) {
  const [breaks, setBreaks] = useState<LeagueBreakLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    setShowRest(false);
    const params = new URLSearchParams({ league: activeTeam.league, season: activeTeam.season, limit: "50" });
    fetch(withTestUser(`/api/league/breaks?${params.toString()}`), { credentials: "same-origin" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "League breaks unavailable.");
        setBreaks(data.breaks ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "League breaks unavailable.");
        setBreaks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam.league, activeTeam.season]);

  let displayedRank = 0;
  let previousBreakValue: number | null = null;
  const rankedBreaks = breaks.map((entry, index) => {
    if (entry.breakValue !== previousBreakValue) {
      displayedRank = index + 1;
      previousBreakValue = entry.breakValue;
    }
    return { entry, rank: displayedRank };
  });
  const topBreaks = rankedBreaks.slice(0, 5);
  const remainingBreaks = rankedBreaks.slice(5);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{activeTeam.league} High Breaks</CardTitle>
        <Badge variant="muted">{loading ? "Loading" : `${breaks.length}`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {topBreaks.map(({ entry, rank }) => {
          const colors = teamColors(entry.teamName ?? activeTeam.name);
          const fixtureLabel = entry.fixtureDate ? formatFixtureDate(entry.fixtureDate) : "Date pending";
          const opponentLabel = entry.opponentTeamName ? `v ${entry.opponentTeamName}` : "Match break";
          return (
            <div key={entry.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
              <div
                className="grid h-12 w-12 place-items-center rounded-xl text-xl font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${colors.primaryColor}, ${colors.accentColor})` }}
                aria-label={`${entry.breakValue} break`}
              >
                {entry.breakValue}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-tight" style={{ color: colors.primaryColor }}>{entry.playerName}</p>
                <p className="truncate text-xs font-bold text-[#6c5a73]">{entry.teamName ?? "Team"} · {opponentLabel}</p>
                <p className="truncate text-[11px] font-semibold text-[#6c5a73]">
                  {fixtureLabel}{entry.gameNumber ? ` · Game ${entry.gameNumber}` : ""}{entry.venueSide ? ` (${entry.venueSide})` : ""}
                </p>
              </div>
              <Badge variant={rank === 1 ? "gold" : "muted"}>#{rank}</Badge>
            </div>
          );
        })}
        {remainingBreaks.length ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-[#eeeaf2]">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 bg-[#f7f5fa] px-3 py-2 text-left text-sm font-extrabold text-[#10233f]"
              onClick={() => setShowRest((current) => !current)}
              aria-expanded={showRest}
            >
              <span>Remaining breaks 30+</span>
              <span className="flex items-center gap-2 text-xs font-black uppercase text-[#6c5a73]">
                {remainingBreaks.length}
                <ChevronDown className={cn("h-4 w-4 transition-transform", showRest && "rotate-180")} />
              </span>
            </button>
            {showRest ? (
              <div className="grid divide-y divide-[#eeeaf2] bg-white">
                <div className="grid grid-cols-[44px_minmax(0,1fr)_52px_52px] gap-2 px-3 py-2 text-[11px] font-black uppercase text-[#6c5a73]">
                  <span>Rank</span>
                  <span>Player</span>
                  <span className="text-right">Break</span>
                  <span className="text-right">Game</span>
                </div>
                {remainingBreaks.map(({ entry, rank }) => {
                  const colors = teamColors(entry.teamName ?? activeTeam.name);
                  const fixtureLabel = entry.fixtureDate ? formatFixtureDate(entry.fixtureDate) : "Date pending";
                  const opponentLabel = entry.opponentTeamName ? `v ${entry.opponentTeamName}` : "Match break";
                  return (
                    <div key={entry.id} className="grid grid-cols-[44px_minmax(0,1fr)_52px_52px] items-center gap-2 px-3 py-2 text-sm font-bold text-[#10233f]">
                      <span className="text-[#6c5a73]">#{rank}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold" style={{ color: colors.primaryColor }}>{entry.playerName}</span>
                        <span className="block truncate text-[11px] font-semibold text-[#6c5a73]">
                          {entry.teamName ?? "Team"} · {opponentLabel} · {fixtureLabel}{entry.venueSide ? ` (${entry.venueSide})` : ""}
                        </span>
                      </span>
                      <span className="text-right font-black">{entry.breakValue}</span>
                      <span className="text-right text-xs text-[#6c5a73]">{entry.gameNumber ? `G${entry.gameNumber}` : "-"}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {!breaks.length ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            {loading ? "Loading high breaks..." : message || "No breaks of 30 or more recorded in this league yet."}
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
  const qualification = qualificationStatus(activeTeam.leaguePosition, leagueTeamCount, activeTeam.league);
  const seasonStatus = seasonStatusFor(activeTeam.season);
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const playoffText = qualification === "final"
    ? `in the ${activeTeam.league} direct final place`
    : qualification === "semi"
      ? `in the ${activeTeam.league} semi-final places`
      : qualification === "prelim"
        ? `in the ${activeTeam.league} preliminary playoff places`
      : `outside the ${activeTeam.league} playoff places`;
  const playoffLine = (() => {
    if (!hasLeagueTable) return `${activeTeam.name} has no league table position yet.`;
    if (seasonStatus === "complete") {
      return `${activeTeam.name} finished ${ordinal(activeTeam.leaguePosition)} and ${playoffText}.`;
    }
    return `${activeTeam.name} is currently ${ordinal(activeTeam.leaguePosition)} and ${playoffText}.`;
  })();

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
          <p className="mt-1 font-black">{playoffLine}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeagueTable({
  activeTeam,
  standingsData,
  matchResults = [],
  presentation = "compact",
  userCanShare = false
}: {
  activeTeam: TeamContext;
  standingsData?: Standing[];
  matchResults?: MatchResult[];
  presentation?: "compact" | "section";
  userCanShare?: boolean;
}) {
  const tableRows = standingsData ?? standings;
  const teamCount = tableRows.length;
  const showDirectFinal = activeTeam.league !== "C League" && teamCount >= 5 && teamCount <= 6;
  const showSemiFinals = teamCount >= 5;
  const showPrelims = activeTeam.league === "C League";
  const sectionMode = presentation === "section";
  const managerCanShare = userCanShare;

  return (
    <Card className={cn("min-w-0 overflow-hidden", sectionMode && "ring-1 ring-[#d9dfea]")}>
      <CardHeader
        className={cn(
          "gap-2",
          sectionMode && "border-b border-[#dce3ee] text-white"
        )}
        style={sectionMode ? { backgroundColor: activeTeam.primaryColor } : undefined}
      >
        <div className="min-w-0">
          <CardTitle className={sectionMode ? "text-xl leading-tight text-white sm:text-2xl" : undefined}>
            {sectionMode ? `${activeTeam.league} Table` : "League Table"}
          </CardTitle>
          {sectionMode ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/75">{activeTeam.season}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {managerCanShare ? (
            <Button
              type="button"
              variant={sectionMode ? "outline" : "secondary"}
              size="sm"
              disabled={!tableRows.length}
              onClick={() => {
                void shareSvgVisual(
                  `${activeTeam.league.toLowerCase().replace(/\s+/g, "-")}-${activeTeam.season.replace("/", "-")}-table.svg`,
                  `${activeTeam.league} ${activeTeam.season} table`,
                  buildLeagueTableShareSvg(activeTeam, tableRows, matchResults)
                );
              }}
              className={cn("min-h-9 px-3 text-xs", sectionMode && "border-white/30 bg-white/15 text-white hover:bg-white/25")}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          {sectionMode ? <Badge variant="soft">{tableRows.length} teams</Badge> : <Badge variant="muted">{activeTeam.league}</Badge>}
          {showDirectFinal ? <Badge variant={sectionMode ? "soft" : "gold"}>Final</Badge> : null}
          {showSemiFinals ? <Badge variant="green">Semi</Badge> : null}
          {showPrelims ? <Badge variant="cyan">Prelim</Badge> : null}
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
                <th className={cn("w-8 px-1 text-right", sectionMode ? "hidden sm:table-cell" : "hidden")}>W</th>
                <th className={cn("w-8 px-1 text-right", sectionMode ? "hidden sm:table-cell" : "hidden")}>L</th>
                <th className={cn("w-14 px-1 text-center", sectionMode ? "hidden 2xl:table-cell" : "hidden")}>Form</th>
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
                const qualification = qualificationStatus(row.position, teamCount, activeTeam.league);
                const positionColors = qualificationPositionColors(qualification);

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
                        className="inline-grid h-8 w-8 place-items-center rounded-lg text-xs font-extrabold"
                        style={{ backgroundColor: positionColors.background, color: positionColors.color }}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-sm font-extrabold leading-tight" style={{ color: primaryColor }} title={row.team}>{row.team}</p>
                          <p className={cn("mt-0.5 text-[10px] font-bold uppercase text-[#6c5a73]", sectionMode ? "2xl:hidden" : "")}>{form}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-t border-[#eeeaf2] px-1 text-right font-bold">{row.played}</td>
                    <td className={cn("border-t border-[#eeeaf2] px-1 text-right font-bold", sectionMode ? "hidden sm:table-cell" : "hidden")}>{row.won}</td>
                    <td className={cn("border-t border-[#eeeaf2] px-1 text-right font-bold", sectionMode ? "hidden sm:table-cell" : "hidden")}>{row.lost}</td>
                    <td className={cn("border-t border-[#eeeaf2] px-1 text-center", sectionMode ? "hidden 2xl:table-cell" : "hidden")}>
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

function personalGameMatchupLabel(game: PlayerGameResult) {
  const opponents = game.opponentNames?.length ? game.opponentNames : [game.opponentName].filter(Boolean);
  if (game.gameType === "Doubles" && game.partnerName && opponents.length) {
    return {
      title: `with ${game.partnerName} v ${opponents.join(" / ")}`,
      detail: "Doubles"
    };
  }
  return {
    title: `v ${game.opponentName}`,
    detail: game.gameType === "Doubles" ? "Doubles" : ""
  };
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
  const myClubItem = configured.find((item) => item.page === "Club");
  const nonClubItems = myClubItem ? configured.filter((item) => item.page !== "Club") : configured;
  const hasOverflow = myClubItem ? nonClubItems.length > 4 : configured.length > 5;
  const primaryItems = myClubItem
    ? nonClubItems.slice(0, hasOverflow ? 3 : 4)
    : configured.slice(0, hasOverflow ? 4 : 5);
  const overflowItems = myClubItem
    ? nonClubItems.slice(primaryItems.length)
    : configured.slice(primaryItems.length);
  const items = hasOverflow
    ? [
        ...primaryItems,
        ...(myClubItem ? [myClubItem] : []),
        { label: "More", page: "Menu" as AppPage, icon: MenuIcon, description: "More options" }
      ]
    : [...primaryItems, ...(myClubItem ? [myClubItem] : [])];
  const morePages: AppPage[] = ["Menu", ...overflowItems.map((item) => item.page), ...(activeTeam.hasLeagueChairAccess ? ["Shop" as AppPage] : [])];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eeeaf2] bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-elevated lg:hidden">
      <div className={cn("mx-auto grid max-w-md gap-1", items.length === 4 ? "grid-cols-4" : "grid-cols-5")}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.page === "Menu"
            ? morePages.includes(activePage)
            : activePage === item.page || (item.page === "Club" && activePage === "Ladder");

          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-bold leading-tight text-[#6c5a73]",
                item.page === "Menu" && "order-last",
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
