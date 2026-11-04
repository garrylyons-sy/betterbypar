import {cookies} from 'next/headers';
import {dbQuery} from '@/lib/server/db';
import {readRoleView} from './role-view-token.mjs';
import {clubViewRoles,canSwitchRoleView} from '@/shared/admin-role-view.mjs';
import type {AppUser} from './auth';
export const roleViewCookie='bbp_role_view';
export async function roleViewOptions(actorId:string){
 const operator=await dbQuery('select 1 from app_operator ao join person p on p.id=ao.person_id and p.active where ao.person_id=$1 and ao.active',[actorId]);
 if(!operator.rowCount)throw new Error('Platform administrator access required.');
 const clubs=(await dbQuery<{id:string;name:string}>('select id,name from club where active order by name')).rows;
 const people=(await dbQuery<{personId:string;name:string;clubId:string;role:string}>(`select distinct p.id as "personId",concat_ws(' ',p.first_name,p.last_name) as name,c.id as "clubId",roles.role
 from club c join club_membership cm on cm.club_id=c.id and cm.active join person p on p.id=cm.person_id and p.active
 cross join lateral (select 'Player'::text as role where public.is_golf_player(p.id,c.id)
 union select cm.role where cm.role in ('Golf Professional','Assistant Professional')
 union select 'Club Admin' where cm.is_club_admin or exists(select 1 from club_admin ca where ca.club_id=c.id and ca.person_id=p.id and ca.active)) roles
 where c.active
 union select p.id,concat_ws(' ',p.first_name,p.last_name),c.id,'Club Admin' from club_admin ca join person p on p.id=ca.person_id and p.active join club c on c.id=ca.club_id and c.active where ca.active
 order by name,role`)).rows;
 return {clubs,people,canSwitchRole:canSwitchRoleView(people)};
}
export async function resolveRoleView(actor:AppUser,sessionId:string,token:string){
 const context=readRoleView(token,sessionId);if(!context||!clubViewRoles.includes(context.role))throw new Error('Role session expired. Return to Admin and select a role again.');
 const options=await roleViewOptions(actor.personId);
 const selected=options.people.find(p=>p.personId===context.personId&&p.clubId===context.clubId&&p.role===context.role);
 const club=options.clubs.find(c=>c.id===context.clubId);
 if(!selected||!club)throw new Error('This club role is no longer active. Return to Admin.');
 const person=(await dbQuery<{accountId:string|null;email:string|null;profileImage:string|null}>('select ua.id as "accountId",p.email,p.profile_image as "profileImage" from person p left join user_account ua on ua.person_id=p.id and ua.active where p.id=$1 and p.active',[selected.personId])).rows[0];
 if(!person)throw new Error('This person is no longer active.');
 return {...actor,accountId:person.accountId??'',personId:selected.personId,name:selected.name,email:person.email??'',profileImage:person.profileImage??'',actingAs:{actorPersonId:actor.personId,actorName:actor.name,clubId:club.id,clubName:club.name,role:selected.role}} satisfies AppUser;
}
export async function effectiveWebUser(actor:AppUser,sessionId:string){const token=(await cookies()).get(roleViewCookie)?.value;return token?resolveRoleView(actor,sessionId,token):actor;}
// Business guards can also be called by scripts/tests without a request context.
export async function requestRoleView(){
 let store;try{store=await cookies();}catch{return null;}
 const token=store.get(roleViewCookie)?.value;if(!token)return null;
 const context=readRoleView(token,store.get('is_session')?.value);if(!context)throw new Error('Role session expired. Return to Admin.');return context;
}
