import {NextResponse} from 'next/server';
import {dbQuery} from '@/lib/server/db';
import {AccessError,golfAccess,golfError} from '@/lib/server/golf-access';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const access=await golfAccess(request),clubId=new URL(request.url).searchParams.get('clubId');
  if(!clubId||!access.assignments.some(a=>a.clubId===clubId))throw new AccessError('Active club membership required.');
  const result=await dbQuery(`select b.id,b.player_person_id,b.status,s.club_id,s.title,(select name from lesson_location where id=s.location_id) as location_name,s.starts_at,s.ends_at,s.group_id,g.name as group_name,
   concat_ws(' ',p.first_name,p.last_name) as player_name,concat_ws(' ',pro.first_name,pro.last_name) as professional_name,count(*) over()::int as total
   from public.lesson_booking b join public.lesson_slot s on s.id=b.slot_id
   join public.club c on c.id=s.club_id and c.active
   join public.person p on p.id=b.player_person_id and p.active
   join public.person pro on pro.id=s.professional_person_id and pro.active
   left join public.lesson_group g on g.id=s.group_id
   where s.club_id=$2 and s.active and b.status='Booked' and s.ends_at>now()
   and (s.group_id is null or g.active)
   and public.is_golf_player(p.id,s.club_id)
   and exists(select 1 from public.club_membership cm where cm.person_id=pro.id and cm.club_id=s.club_id and cm.active and cm.role in ('Golf Professional','Assistant Professional'))
   and (b.player_person_id=$1 or exists(select 1 from public.dependants d where d.guardian_person_id=$1 and d.dependant_person_id=b.player_person_id and d.club_id=s.club_id and d.active))
   order by s.starts_at,b.id limit 3`,[access.user.personId,clubId]);
  return NextResponse.json({actorId:access.user.personId,bookings:result.rows,total:result.rows[0]?.total??0},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status,headers:{'Cache-Control':'no-store'}});}
}
