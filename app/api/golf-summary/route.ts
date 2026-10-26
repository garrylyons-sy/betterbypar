import {NextResponse} from 'next/server';
import {dbQuery} from '@/lib/server/db';
import {golfAccess,golfError,AccessError} from '@/lib/server/golf-access';
import {getGolfSummary} from '@/lib/server/golf-ireland';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const access=await golfAccess(request),params=new URL(request.url).searchParams;
  const clubName=params.get('club')??'',requestedPlayer=params.get('playerId');
  const club=(await dbQuery<{id:string;name:string}>(`select c.id,c.name from club c where c.active and ($1='' or c.name=$1)
   and exists(select 1 from club_membership where club_id=c.id and person_id=$2 and active) order by c.name limit 1`,[clubName,access.user.personId])).rows[0];
  if(!club)throw new AccessError('Club access is required to view this golf summary.');
  const players=(await dbQuery<{id:string;name:string;golf_ireland_number:string}>(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name,p.golf_ireland_number from person p
   where public.is_golf_player(p.id,$2) and (p.id=$1 or exists(select 1 from dependants where guardian_person_id=$1 and dependant_person_id=p.id and club_id=$2 and active))
   order by (p.id=$1) desc,p.first_name,p.last_name,p.id`,[access.user.personId,club.id])).rows;
  const selected=requestedPlayer?players.find(p=>p.id===requestedPlayer):players[0];
  if(requestedPlayer&&!selected)throw new AccessError('You can view only your own golf summary or that of an active dependant.');
  const options=players.map(p=>({id:p.id,name:p.name,isSelf:p.id===access.user.personId}));
  if(!selected)return NextResponse.json({players:options,selectedPlayerId:null,summary:null},{headers:{'Cache-Control':'no-store'}});
  let summary;
  try{summary=await getGolfSummary({clubId:club.id,clubName:club.name,playerId:selected.id,playerName:selected.name,golfIrelandNumber:selected.golf_ireland_number});}
  catch{return NextResponse.json({players:options,selectedPlayerId:selected.id,summary:null,error:'Your Golf Ireland data is unavailable right now. Try again later.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  return NextResponse.json({players:options,selectedPlayerId:selected.id,summary},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status,headers:{'Cache-Control':'no-store'}});}
}
