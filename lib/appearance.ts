import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, Role } from "@/lib/types";

export const appearanceRoles: Role[] = ["Player", "Manager", "Assistant Manager", "Club Member"];

export const appearancePanelOptions: Array<{ id: AppearancePanelId; label: string; description: string; roles: Role[] }> = [
  { id: "teamStats", label: "Team stats", description: "League position, played, won and points.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "myStats", label: "My stats", description: "Personal win rate and played/won/lost.", roles: ["Player"] },
  { id: "teamRecentForm", label: "Recent team form", description: "Latest team results and form.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "personalRecentForm", label: "Recent personal form", description: "Latest individual games.", roles: ["Player"] },
  { id: "individualGames", label: "Individual games", description: "Full personal game list.", roles: ["Player"] },
  { id: "memberActions", label: "Member actions", description: "Bookings and competition entry.", roles: ["Player", "Manager", "Assistant Manager", "Club Member"] },
  { id: "clubAccess", label: "Club access", description: "Club-level member summary.", roles: ["Club Member"] },
  { id: "interclubLeagues", label: "Interclub leagues", description: "Shortcut to league tables and results.", roles: ["Club Member"] },
  { id: "messages", label: "Messages", description: "Team and club notices.", roles: ["Manager", "Assistant Manager", "Club Member"] },
  { id: "managerActions", label: "Manager actions", description: "Enter result, message team and bookings.", roles: ["Manager"] },
  { id: "seasonComplete", label: "Season complete", description: "Season status and qualification.", roles: ["Manager", "Assistant Manager"] },
  { id: "squadManagement", label: "Squad management", description: "Manager player performance panel.", roles: ["Manager"] },
  { id: "managerSnapshot", label: "Manager snapshot", description: "Team won/lost and playoff line.", roles: ["Manager", "Assistant Manager"] },
  { id: "assistantHub", label: "Assistant hub", description: "Assistant manager quick actions.", roles: ["Assistant Manager"] }
];

export const appearanceMenuOptions: Array<{ id: AppearanceMenuId; label: string; description: string; roles: Role[] }> = [
  { id: "Home", label: "Home", description: "Role home dashboard.", roles: appearanceRoles },
  { id: "Fixtures", label: "Fixtures", description: "Fixture and season cards.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "Results", label: "Results", description: "Team and league results.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "Table", label: "Table", description: "League table.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "Bookings", label: "Bookings", description: "Club table bookings.", roles: appearanceRoles },
  { id: "Players", label: "Players", description: "Players and squad views.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "Stats", label: "Stats", description: "Stats dashboard.", roles: ["Player", "Manager", "Assistant Manager"] },
  { id: "Messages", label: "Messages", description: "Messages and account access.", roles: appearanceRoles },
  { id: "Interclub Leagues", label: "Leagues", description: "All interclub tables/results.", roles: appearanceRoles }
];

export const defaultAppearanceConfig: AppearanceConfig = {
  Player: {
    role: "Player",
    panels: ["teamStats", "myStats", "teamRecentForm", "personalRecentForm", "individualGames", "memberActions"],
    menuItems: ["Home", "Fixtures", "Table", "Bookings", "Results", "Players", "Stats", "Messages", "Interclub Leagues"]
  },
  Manager: {
    role: "Manager",
    panels: ["managerActions", "seasonComplete", "teamRecentForm", "squadManagement", "managerSnapshot", "memberActions"],
    menuItems: ["Home", "Fixtures", "Table", "Bookings", "Results", "Players", "Stats", "Messages", "Interclub Leagues"]
  },
  "Assistant Manager": {
    role: "Assistant Manager",
    panels: ["assistantHub", "seasonComplete", "managerSnapshot", "messages"],
    menuItems: ["Home", "Fixtures", "Table", "Bookings", "Results", "Players", "Stats", "Messages", "Interclub Leagues"]
  },
  "Club Member": {
    role: "Club Member",
    panels: ["clubAccess", "memberActions", "interclubLeagues", "messages"],
    menuItems: ["Home", "Bookings", "Messages", "Interclub Leagues"]
  }
};

export function normalizeAppearanceConfig(config?: Partial<AppearanceConfig> | null): AppearanceConfig {
  const normalized = { ...defaultAppearanceConfig } as AppearanceConfig;

  for (const role of appearanceRoles) {
    const roleConfig = config?.[role];
    if (!roleConfig) continue;

    const allowedPanels = new Set(appearancePanelOptions.filter((option) => option.roles.includes(role)).map((option) => option.id));
    const allowedMenus = new Set(appearanceMenuOptions.filter((option) => option.roles.includes(role)).map((option) => option.id));

    normalized[role] = {
      role,
      panels: roleConfig.panels?.filter((panel) => allowedPanels.has(panel))?.length
        ? roleConfig.panels.filter((panel) => allowedPanels.has(panel))
        : defaultAppearanceConfig[role].panels,
      menuItems: roleConfig.menuItems?.filter((item) => allowedMenus.has(item))?.length
        ? roleConfig.menuItems.filter((item) => allowedMenus.has(item))
        : defaultAppearanceConfig[role].menuItems
    };
  }

  return normalized;
}
