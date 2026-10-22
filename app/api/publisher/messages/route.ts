import {NextResponse} from 'next/server';
import {loadPublisherHistory,loadPublisherMessage} from '@/lib/server/publisher-history';
import {currentUser} from '@/lib/server/auth';
import {requirePublisher,loadPublisherPeople} from '@/lib/server/publisher';
import {AnnouncementError,loadAnnouncementOptions,previewAnnouncement,sendAnnouncement} from '@/lib/server/notification-announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function authorize(){
 const user=await currentUser();
 if(!user)throw new AnnouncementError('Sign in required.',401);
 await requirePublisher(user.personId);
 return user;
}
function failure(error:unknown){
 if(error instanceof AnnouncementError)return NextResponse.json({error:error.message},{status:error.status});
 if(error instanceof Error&&!('code' in error)&&/^(Title|Message|Choose valid|Choose a valid|Select a club)/.test(error.message))return NextResponse.json({error:error.message},{status:400});
 console.error('publisher-message',error);
 return NextResponse.json({error:'The message could not be processed. Please try again.'},{status:500});
}
export async function GET(request:Request){
 try{const user=await authorize();const params=request?new URL(request.url).searchParams:new URLSearchParams();
 const view=params.get('view');
 if(view==='history')return NextResponse.json(await loadPublisherHistory(user.personId,params.get('page')??'1'),{headers:{'Cache-Control':'no-store'}});
 if(view==='detail')return NextResponse.json({announcement:await loadPublisherMessage(user.personId,params.get('id')??'',params.get('recipientPage')??'1')},{headers:{'Cache-Control':'no-store'}});
 if(view)return NextResponse.json({error:'Choose a valid message view.'},{status:400});
 const [options,people]=await Promise.all([loadAnnouncementOptions(),loadPublisherPeople()]);return NextResponse.json({...options,people},{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
 const user=await authorize();
 let input;try{input=await request.json();}catch{return NextResponse.json({error:'Invalid message request.'},{status:400});}
 if(!input||!['preview','send'].includes(input.action))return NextResponse.json({error:'Choose preview or send.'},{status:400});
 if(input.action==='preview')return NextResponse.json({preview:await previewAnnouncement(input)},{headers:{'Cache-Control':'no-store'}});
 return NextResponse.json(await sendAnnouncement(user.personId,input,client=>requirePublisher(user.personId,client)));
 }catch(error){return failure(error);}
}
