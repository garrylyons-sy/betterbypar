/** Only server-confirmed administrators can change their active club appearance. */
export function selectedClubId(session,requested=''){
 const clubs=session?.clubs??[];
 const fallback=clubs.some(c=>c.id===session?.defaultClubId)?session.defaultClubId:clubs[0]?.id??'';
 return session?.canSwitchClub===true&&clubs.some(c=>c.id===requested)?requested:fallback;
}
