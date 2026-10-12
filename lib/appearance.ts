import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, Role } from "@/lib/types";

export const appearanceRoles: Role[] = ["Player", "Manager", "Club Member", "Club Admin", "League Chair"];

export const appearancePanelOptions: Array<{ id: AppearancePanelId; label: string; description: string; roles: Role[] }> = [
  { id: "teamStats", label: "Team stats", description: "League position, played, won and points.", roles: ["Player", "Manager"] },
  { id: "leagueTableSnapshot", label: "League table", description: "Full league table on the home page.", roles: ["Player"] },
  { id: "myStats", label: "My stats", description: "Personal win rate and played/won/lost.", roles: ["Player"] },
  { id: "teamRecentForm", label: "Recent team form", description: "Latest team results and form.", roles: ["Player", "Manager"] },
  { id: "personalRecentForm", label: "Recent personal form", description: "Latest individual games.", roles: ["Player"] },
  { id: "individualGames", label: "Individual games", description: "Full personal game list.", roles: ["Player"] },
  { id: "memberActions", label: "Member actions", description: "Bookings and competition entry.", roles: ["Player", "Manager", "Club Member", "Club Admin"] },
  { id: "openCompetitions", label: "Open competitions", description: "Club competitions currently open for entry.", roles: appearanceRoles },
  { id: "myCompetitionMatches", label: "My competition matches", description: "Upcoming or active club competition ties.", roles: appearanceRoles },
  { id: "competitionDraws", label: "Competition draws", description: "Latest club draws and previous rounds.", roles: appearanceRoles },
  { id: "clubCompetitionAdmin", label: "Club competition admin", description: "Club admin competition setup and results.", roles: ["Club Admin"] },
  { id: "clubAccess", label: "Club access", description: "Club-level member summary.", roles: ["Club Member", "Club Admin", "League Chair"] },
  { id: "interclubLeagues", label: "Interclub leagues", description: "Shortcut to league tables and results.", roles: ["Club Admin", "League Chair"] },
  { id: "messages", label: "Messages", description: "Team and club notices.", roles: [] },
  { id: "matchPlanning", label: "Next matches", description: "View matchday status, live scores and manager lineup actions.", roles: ["Player", "Manager"] },
  { id: "seasonComplete", label: "Season complete", description: "Season status and qualification.", roles: ["Manager"] },
  { id: "squadManagement", label: "Squad management", description: "Manager player performance panel.", roles: ["Manager"] },
  { id: "managerSnapshot", label: "Manager snapshot", description: "Team won/lost and playoff line.", roles: ["Manager"] }
];

export const appearanceMenuOptions: Array<{ id: AppearanceMenuId; label: string; description: string; roles: Role[] }> = [
  { id: "Home", label: "Home", description: "Role home dashboard.", roles: appearanceRoles },
  { id: "Fixtures", label: "Fixtures", description: "Fixture and season cards.", roles: ["Player", "Manager", "Club Member", "Club Admin"] },
  { id: "Results", label: "Results", description: "Team and league results.", roles: ["Player", "Manager"] },
  { id: "Table", label: "Tables", description: "League tables.", roles: ["Player", "Manager", "Club Member"] },
  { id: "Club", label: "My Club", description: "Bookings and club competitions.", roles: ["Player", "Manager"] },
  { id: "Bookings", label: "Bookings", description: "Club table bookings.", roles: appearanceRoles },
  { id: "Competitions", label: "Competitions", description: "Club competition entries, draws and results.", roles: appearanceRoles },
  { id: "Friendlies", label: "Friendlies", description: "Private practice matches between two teams.", roles: ["Player", "Manager"] },
  { id: "Contacts", label: "Contacts", description: "League and manager phone directory.", roles: ["Manager", "Club Admin", "League Chair"] },
  { id: "Players", label: "Players", description: "Players and squad views.", roles: ["Player", "Manager"] },
  { id: "Stats", label: "Stats", description: "Stats dashboard.", roles: ["Player", "Manager"] },
  { id: "Messages", label: "Messages", description: "Messages and account access.", roles: [] },
  { id: "Interclub Leagues", label: "Leagues", description: "All interclub tables/results.", roles: ["Player", "Manager", "Club Member", "Club Admin", "League Chair"] },
  { id: "Last Man Standing", label: "Last Man Standing", description: "Pick two players and stay in the competition.", roles: ["League Chair"] }
];

export const defaultAppearanceConfig: AppearanceConfig = {
  Player: {
    role: "Player",
    panels: ["matchPlanning", "myStats", "leagueTableSnapshot", "teamStats", "teamRecentForm", "personalRecentForm", "individualGames"],
    menuItems: ["Home", "Fixtures", "Table", "Friendlies", "Club"]
  },
  Manager: {
    role: "Manager",
    panels: ["matchPlanning", "squadManagement", "seasonComplete", "teamRecentForm", "managerSnapshot"],
    menuItems: ["Home", "Fixtures", "Table", "Contacts", "Friendlies", "Club", "Results"]
  },
  "Club Member": {
    role: "Club Member",
    panels: ["clubAccess", "openCompetitions"],
    menuItems: ["Home", "Fixtures", "Table", "Bookings", "Competitions", "Interclub Leagues"]
  },
  "Club Admin": {
    role: "Club Admin",
    panels: ["clubCompetitionAdmin", "openCompetitions", "interclubLeagues"],
    menuItems: ["Home", "Fixtures", "Table", "Competitions", "Bookings", "Contacts", "Interclub Leagues"]
  },
  "League Chair": {
    role: "League Chair",
    panels: ["interclubLeagues"],
    menuItems: ["Home", "Contacts", "Interclub Leagues"]
  }
};

export function normalizeAppearanceConfig(config?: Partial<AppearanceConfig> | null): AppearanceConfig {
  const normalized = { ...defaultAppearanceConfig } as AppearanceConfig;

  for (const role of appearanceRoles) {
    const roleConfig = config?.[role];
    if (!roleConfig) continue;

    const allowedPanels = new Set(appearancePanelOptions.filter((option) => option.roles.includes(role)).map((option) => option.id));
    const allowedMenus = new Set(appearanceMenuOptions.filter((option) => option.roles.includes(role)).map((option) => option.id));

    let panels = roleConfig.panels?.filter((panel) => allowedPanels.has(panel)) ?? [];
    if (role === "Player" && panels.includes("teamStats") && !panels.includes("matchPlanning")) {
      panels = panels.flatMap((panel) => panel === "teamStats" ? ["matchPlanning", panel] as AppearancePanelId[] : [panel]);
    }
    normalized[role] = {
      role,
      panels: panels.length
        ? panels
        : defaultAppearanceConfig[role].panels,
      menuItems: roleConfig.menuItems?.filter((item) => allowedMenus.has(item))?.length
        ? roleConfig.menuItems.filter((item) => allowedMenus.has(item))
        : defaultAppearanceConfig[role].menuItems
    };
  }

  return normalized;
}
