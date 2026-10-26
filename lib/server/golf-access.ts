import type { PoolClient } from 'pg';
import { currentUser } from '@/lib/server/auth';
import { dbQuery } from '@/lib/server/db';
import { canManageLessons, hasActivePlayers, canActForPlayer } from '@/lib/golf-policy';
export class AccessError extends Error { constructor(message: string, public status = 403) { super(message); } }
export async function golfAccess(request?: Request) {
  const user = await currentUser();
  if (!user) throw new AccessError('Sign in to continue.',401);
  const [operator, admins, memberships] = await Promise.all([
    dbQuery('select 1 from public.app_operator where person_id=$1 and active',[user.personId]),
    dbQuery<{club_id:string}>(`select club_id from public.club_admin where person_id=$1 and active union select club_id from public.club_membership where person_id=$1 and active and is_club_admin`,[user.personId]),
    dbQuery<{club_id:string;role:string}>(`select cm.club_id,cm.role from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.person_id=$1 and cm.active`,[user.personId])
  ]);
  const clubScope = request ? new URL(request.url).searchParams.get('scope') === 'club' : false;
  const adminClubIds = admins.rows.map(r=>r.club_id);
  return {user, platform:Boolean(operator.rowCount) && !clubScope, adminClubIds, assignments:memberships.rows.filter(r=>!clubScope || adminClubIds.includes(r.club_id)).map(r=>({clubId:r.club_id,role:r.role,active:true}))};
}
export type GolfAccess = Awaited<ReturnType<typeof golfAccess>>;
export function requireClubAdmin(access: GolfAccess, clubId: string) {
  if (!access.platform && !access.adminClubIds.includes(clubId)) throw new AccessError('Club administrator access required.');
}
export function requireLessonsManager(access: GolfAccess, clubId: string) {
  if (!canManageLessons(access.platform,access.adminClubIds,access.assignments,clubId)) throw new AccessError('Professional or club administrator access required.');
}
export async function requirePlayerAccess(client: PoolClient, actorId: string, playerId: string, clubId: string) {
  // Lock the grant and memberships so revocation cannot race a booking.
  const members = await client.query(`select cm.person_id from public.club_membership cm join public.person p on p.id=cm.person_id and p.active
    join public.club c on c.id=cm.club_id and c.active where cm.club_id=$1 and cm.person_id=any($2::uuid[]) and cm.active for share of cm,p,c`,[clubId,[actorId,playerId]]);
  if (!hasActivePlayers(members.rows.map(r=>r.person_id),actorId,playerId)) throw new AccessError('Active club membership is required for both the player and account holder.');
  if(!(await client.query('select public.is_golf_player($1,$2) as eligible',[playerId,clubId])).rows[0].eligible)throw new AccessError('Choose a registered player with a Golf Ireland number. Professionals and assistants cannot be players.');
  if (actorId===playerId) return;
  const grant = await client.query(`select guardian_person_id as "guardianId",dependant_person_id as "playerId",club_id as "clubId",active from public.dependants where club_id=$1 and guardian_person_id=$2 and dependant_person_id=$3 and active for share`,[clubId,actorId,playerId]);
  if (!canActForPlayer(actorId,playerId,clubId,grant.rows)) throw new AccessError('You do not have an active guardian relationship for this player.');
}
export function golfError(error: unknown) {
  const code = (error as {code?:string})?.code;
  if (code==='P0001' && /No places remain/i.test((error as Error).message)) return {error:(error as Error).message,status:409};
  if (code==='23505' || code==='23P01') return {error:'This time is already booked or overlaps another lesson.',status:409};
  return {error:error instanceof Error?error.message:'Request could not be completed.',status:error instanceof AccessError?error.status:400};
}
export async function golfAudit(client: PoolClient, actorId: string, label: string, metadata: Record<string,unknown>) {
  await client.query(`insert into public.user_activity_log(person_id,activity_type,page_path,page_label,metadata) values($1,'Page Visit','/admin',$2,$3::jsonb)`,[actorId,label,JSON.stringify(metadata)]);
}
