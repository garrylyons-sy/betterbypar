import {NextResponse} from 'next/server';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,requireClubAdmin,golfAudit} from '@/lib/server/golf-access';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const access=await golfAccess(request),clubId=new URL(request.url).searchParams.get('clubId')??'';
  requireClubAdmin(access,clubId);
  const result=await dbQuery('select id,show_lesson_attendee_names from public.club where id=$1 and active',[clubId]);
  if(!result.rows[0])throw new Error('Club not found.');
  return NextResponse.json({settings:result.rows[0]},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request){
 try{
  const access=await golfAccess(request),body=await request.json(),clubId=String(body.clubId??'');
  requireClubAdmin(access,clubId);
  if(typeof body.showAttendeeNames!=='boolean')throw new Error('Choose whether attendee names are shown.');
  const settings=await withTransaction(async client=>{
   const result=await client.query('update public.club set show_lesson_attendee_names=$2,updated_at=now() where id=$1 and active returning id,show_lesson_attendee_names',[clubId,body.showAttendeeNames]);
   if(!result.rows[0])throw new Error('Club not found.');
   await golfAudit(client,access.user.personId,'Lesson booking privacy updated',{clubId,showAttendeeNames:body.showAttendeeNames});
   return result.rows[0];
  });
  return NextResponse.json({settings});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
