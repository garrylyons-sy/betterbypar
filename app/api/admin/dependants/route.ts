import { NextResponse } from 'next/server';
import { dbQuery,withTransaction } from '@/lib/server/db';
import { golfAccess,golfError,requireClubAdmin,golfAudit,AccessError } from '@/lib/server/golf-access';
export const runtime='nodejs';
export async function GET(request:Request) {
 try {
  const a=await golfAccess(request);
  if(!a.platform&&!a.adminClubIds.length) throw new AccessError('Administrator access required.');
  const result=await dbQuery(`select d.*,c.name as club_name,concat_ws(' ',g.first_name,g.last_name) as guardian_name,concat_ws(' ',p.first_name,p.last_name) as player_name
    from public.dependants d join public.club c on c.id=d.club_id join public.person g on g.id=d.guardian_person_id join public.person p on p.id=d.dependant_person_id
    where $1::boolean or d.club_id=any($2::uuid[]) order by d.active desc,p.first_name,g.first_name`,[a.platform,a.adminClubIds]);
  return NextResponse.json({dependants:result.rows});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request) {
 try {
  const a=await golfAccess(request),b=await request.json();
  const clubId=String(b.clubId??''),guardianId=String(b.guardianId??''),playerId=String(b.playerId??''),relationship=String(b.relationship??'');
  requireClubAdmin(a,clubId);
  if(guardianId===playerId||!guardianId||!playerId) throw new Error('Select two different people.');
  if(!['Parent','Guardian','Carer'].includes(relationship)) throw new Error('Select a relationship.');
  const result=await withTransaction(async client=>{
    const eligible=await client.query(`select distinct cm.person_id from public.club_membership cm join public.person p on p.id=cm.person_id and p.active join public.club c on c.id=cm.club_id and c.active where cm.club_id=$1 and cm.person_id=any($2::uuid[]) and cm.active`,[clubId,[guardianId,playerId]]);
    if(eligible.rowCount!==2) throw new Error('Both people must be active members of this club.');
    if(!(await client.query('select public.is_golf_player($1,$2) as eligible',[playerId,clubId])).rows[0].eligible)throw new Error('The dependant must be a registered player with a Golf Ireland number.');
    const row=await client.query(`insert into public.dependants(club_id,guardian_person_id,dependant_person_id,relationship,created_by) values($1,$2,$3,$4,$5)
      on conflict(club_id,guardian_person_id,dependant_person_id) do update set active=true,relationship=excluded.relationship,updated_at=now() returning *`,[clubId,guardianId,playerId,relationship,a.user.personId]);
    await golfAudit(client,a.user.personId,'Dependant relationship granted',{clubId,guardianId,playerId,relationship});return row.rows[0];
  });
  return NextResponse.json({dependant:result},{status:201});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request) {
 try {
  const a=await golfAccess(request),b=await request.json();
  await withTransaction(async client=>{
    const existing=await client.query('select * from public.dependants where id=$1 for update',[String(b.id??'')]);
    if(!existing.rowCount) throw new Error('Relationship not found.');
    requireClubAdmin(a,existing.rows[0].club_id);
    await client.query('update public.dependants set active=false,updated_at=now() where id=$1',[b.id]);
    await golfAudit(client,a.user.personId,'Dependant relationship revoked',{relationshipId:b.id});
  });
  return NextResponse.json({ok:true});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
