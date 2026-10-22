import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {MessageAccessError,loadRecipientMessage,recordMessageOpened} from '@/lib/server/notification-messages';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function respond(request:Request,opened:boolean){
 try{
 const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
 const id=new URL(request.url).searchParams.get('id')??'';
 const result=opened?await recordMessageOpened(user.personId,id):await loadRecipientMessage(user.personId,id);
 return NextResponse.json(opened?result:{message:result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof MessageAccessError)return NextResponse.json({error:error.message},{status:error.status});console.error('notification-message',error);return NextResponse.json({error:'Could not load or update this message.'},{status:500});}
}
export async function GET(request:Request){return respond(request,false);}
export async function POST(request:Request){return respond(request,true);}
