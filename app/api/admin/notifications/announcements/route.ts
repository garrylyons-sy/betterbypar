import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {isPlatformOperator} from '@/lib/server/maintenance';
import {AnnouncementError,loadAnnouncementOptions,loadAnnouncementHistory,loadAnnouncementDetail,previewAnnouncement,sendAnnouncement} from '@/lib/server/notification-announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function authorize(){
 const user=await currentUser();
 if(!user)return {error:NextResponse.json({error:'Not signed in.'},{status:401})};
 if(!await isPlatformOperator(user.personId))return {error:NextResponse.json({error:'Platform administrator access required.'},{status:403})};
 return {user};
}
function failure(error:unknown){
 if(error instanceof AnnouncementError)return NextResponse.json({error:error.message},{status:error.status});
 return NextResponse.json({error:'Announcements could not be processed. Check the announcements database migration has been applied.'},{status:500});
}
export async function GET(request:Request){
 try{const access=await authorize();if(access.error)return access.error;
 const params=new URL(request.url).searchParams;
 const view=params.get('view');
 const data=view==='history'?await loadAnnouncementHistory(params.get('page')??'1'):view==='detail'?{announcement:await loadAnnouncementDetail(params.get('id')??'')}:!view?await loadAnnouncementOptions():null;
 if(!data)return NextResponse.json({error:'Choose a valid announcement view.'},{status:400});
 return NextResponse.json(view?data:{...data,senderName:access.user!.name||'Better By Par'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
 const access=await authorize();if(access.error)return access.error;
 let input;try{input=await request.json();}catch{return NextResponse.json({error:'Invalid announcement request.'},{status:400});}
 if(!input||!['preview','send'].includes(input.action))return NextResponse.json({error:'Choose preview or send.'},{status:400});
 try{
 if(input.action==='preview')return NextResponse.json({preview:await previewAnnouncement(input)},{headers:{'Cache-Control':'no-store'}});
 return NextResponse.json(await sendAnnouncement(access.user!.personId,input));
 }catch(error){
 // Pure draft validation produces ordinary errors; database errors must retain 500.
 if(error instanceof Error&&!('code' in error)&&!(error instanceof AnnouncementError)&&/^(Title|Message|Choose valid|Choose a valid|Select a club)/.test(error.message))return NextResponse.json({error:error.message},{status:400});
 throw error;
 }
 }catch(error){return failure(error);}
}
