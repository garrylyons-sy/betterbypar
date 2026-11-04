import {dbQuery} from '@/lib/server/db';
/** Derive authority from active appointments, never from the selected club. */
export async function clubSelectionAccess(user:{personId:string;actingAs?:{clubId:string;role:string}}){
 if(user.actingAs)return {canSwitchClub:false,defaultClubId:user.actingAs.clubId};
 const row=(await dbQuery<{canSwitchClub:boolean;defaultClubId:string|null}>(`select p.player_club_id as "defaultClubId",
 exists(select 1 from app_operator where person_id=p.id and active)
 or exists(select 1 from club_admin a join club c on c.id=a.club_id and c.active where a.person_id=p.id and a.active)
 or exists(select 1 from club_membership m join club c on c.id=m.club_id and c.active where m.person_id=p.id and m.active and m.is_club_admin) as "canSwitchClub"
 from person p where p.id=$1 and p.active`,[user.personId])).rows[0];
 return {canSwitchClub:row?.canSwitchClub===true,defaultClubId:row?.defaultClubId??null};
}
