import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {LiveStreamError,listLiveStreams,listVideoFixtures,makeFixtureLive,endLiveStream} from '@/lib/server/livestreams';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(error:unknown){
 if(error instanceof LiveStreamError)return NextResponse.json({error:error.message},{status:error.status,headers});
 console.error('livestream',error);return NextResponse.json({error:'Unable to load or update the live stream. Please try again.'},{status:500,headers});
}
export async function GET(request:Request){
 try{
  const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401,headers});
  const params=new URL(request.url).searchParams,view=params.get('view');
  if(view&&view!=='fixtures')throw new LiveStreamError('Choose a valid view.',400);
  const data=view==='fixtures'?await listVideoFixtures(user.personId,params.get('q')??'',params.get('page')??'1'):await listLiveStreams(user.personId);
  return NextResponse.json(data,{headers});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401,headers});
  let body;try{body=await request.json();}catch{throw new LiveStreamError('Invalid request.',400);}
  if(!body||!['make-live','end'].includes(body.action))throw new LiveStreamError('Choose Make live or End live.',400);
  const data=body.action==='make-live'?await makeFixtureLive(user.personId,body):await endLiveStream(user.personId,body.id);
  return NextResponse.json(data,{headers});
 }catch(error){return failure(error);}
}
