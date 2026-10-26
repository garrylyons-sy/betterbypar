import { NextResponse } from 'next/server';
import { dbQuery,withTransaction } from '@/lib/server/db';
import { golfAccess,golfError,requirePlayerAccess,golfAudit } from '@/lib/server/golf-access';
export const runtime='nodejs';
export async function GET() {
 try {
  const a=await golfAccess();
  const result=await dbQuery(`select d.id,d.club_id,c.name as club_name,d.dependant_person_id as player_id,d.relationship,p.first_name,p.last_name,p.phone,p.profile_image,p.golf_ireland_number
   from public.dependants d join public.club c on c.id=d.club_id and c.active join public.person p on p.id=d.dependant_person_id and p.active
   where d.guardian_person_id=$1 and d.active and public.is_golf_player(p.id,d.club_id)
   and exists(select 1 from public.club_membership cm where cm.club_id=d.club_id and cm.person_id=$1 and cm.active)
   and exists(select 1 from public.club_membership cm where cm.club_id=d.club_id and cm.person_id=p.id and cm.active)
   order by p.first_name,c.name`,[a.user.personId]);
  return NextResponse.json({dependants:result.rows});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request) {
 try {
  const a=await golfAccess(),b=await request.json();
  const firstName=String(b.firstName??'').trim(),lastName=String(b.lastName??'').trim(),phone=String(b.phone??'').trim();
  if(!firstName||!lastName||firstName.length>100||lastName.length>100||phone.length>40) throw new Error('Enter valid contact details.');
  await withTransaction(async client=>{
   await requirePlayerAccess(client,a.user.personId,String(b.playerId??''),String(b.clubId??''));
   await client.query('update public.person set first_name=$2,last_name=$3,phone=$4 where id=$1',[b.playerId,firstName,lastName,phone||null]);
   await golfAudit(client,a.user.personId,'Player contact details updated by account holder',{playerId:b.playerId,clubId:b.clubId});
  });
  return NextResponse.json({ok:true});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
