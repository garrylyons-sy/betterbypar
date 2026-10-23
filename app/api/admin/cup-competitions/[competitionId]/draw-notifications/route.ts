import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {cupDrawSendOptions,previewCupDrawSend,sendCupDrawNotification} from '@/lib/server/cup-draw-resend';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{competitionId:string}>};
async function admin(){
 const user=await currentUser();
 if(!user)return {error:NextResponse.json({error:'Sign in required.'},{status:401})};
 const operator=await dbQuery('select 1 from public.app_operator where person_id=$1 and active limit 1',[user.personId]);
 if(!operator.rowCount)return {error:NextResponse.json({error:'Administrator access required.'},{status:403})};
 return {user};
}
export async function GET(request:Request,{params}:Context){
 try{
  const auth=await admin();if(auth.error)return auth.error;
  const {competitionId}=await params,attemptId=new URL(request.url).searchParams.get('attemptId')??'';
  const options=await withTransaction(client=>cupDrawSendOptions(client,competitionId,attemptId));
  return NextResponse.json(options,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not load draw notification.'},{status:400});}
}
export async function POST(request:Request,{params}:Context){
 try{
  const auth=await admin();if(auth.error)return auth.error;
  const body=await request.json();
  if(!body||!['preview','send'].includes(body.action)||typeof body.attemptId!=='string')throw new Error('Choose a valid draw notification action.');
  const {competitionId}=await params;
  if(body.action==='preview'){
   const preview=await withTransaction(client=>previewCupDrawSend(client,competitionId,body.attemptId,body.audience));
   const {recipients:_,audience:__,...visible}=preview;
   return NextResponse.json({preview:visible},{headers:{'Cache-Control':'no-store'}});
  }
  const result=await withTransaction(client=>sendCupDrawNotification(client,competitionId,body.attemptId,auth.user!.personId,body));
  if(result.summary.push&&!result.duplicate)scheduleNotificationPush();
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not send draw notification.'},{status:400});}
}
