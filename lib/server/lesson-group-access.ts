import type {PoolClient} from 'pg';
import {AccessError,requireWorkingCoach,type GolfAccess} from '@/lib/server/golf-access';
/** Club-owned groups: fresh, locked staff grants, independent of the creator or session coach. */
export async function requireGroupManager(client:PoolClient,a:GolfAccess,clubId:string){
 const actor=a.user.personId;
 if(a.platform){if((await client.query('select ao.person_id from app_operator ao join person p on p.id=ao.person_id and p.active join club c on c.id=$2 and c.active where ao.person_id=$1 and ao.active for share of ao,p,c',[actor,clubId])).rowCount)return;throw new AccessError('Active platform administrator access required.');}
 if(a.adminClubIds?.includes(clubId)){
  if((await client.query('select ca.person_id from club_admin ca join club c on c.id=ca.club_id and c.active join person p on p.id=ca.person_id and p.active where ca.club_id=$1 and ca.person_id=$2 and ca.active for share of ca,c,p',[clubId,actor])).rowCount)return;
  if((await client.query('select cm.id from club_membership cm join club c on c.id=cm.club_id and c.active join person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.person_id=$2 and cm.active and cm.is_club_admin for share of cm,c,p',[clubId,actor])).rowCount)return;
  throw new AccessError('Active club administrator access required.');
 }
 requireWorkingCoach(a,clubId);
 if(!a.assignments?.some(r=>r.clubId===clubId&&['Golf Professional','Assistant Professional'].includes(r.role)))throw new AccessError('Club staff access required.');
 if(!(await client.query("select cm.id from club_membership cm join club c on c.id=cm.club_id and c.active join person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.person_id=$2 and cm.active and cm.role in ('Golf Professional','Assistant Professional') for share of cm,c,p",[clubId,actor])).rowCount)throw new AccessError('Active club staff access required.');
}
