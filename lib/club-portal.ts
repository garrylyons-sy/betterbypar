export const clubPortalTabIds = ['clubs','lessons','dependants','challenges','drills'] as const;
export type ClubPortalTab = typeof clubPortalTabIds[number];

export function resolveClubPortalTab(value:string|null):ClubPortalTab {
  return clubPortalTabIds.find(tab=>tab===value)??'clubs';
}
