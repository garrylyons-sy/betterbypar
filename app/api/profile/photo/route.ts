import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {withTransaction} from '@/lib/server/db';
import {processProfilePhoto,parseProfilePhotoUpload} from '@/lib/server/profile-photo';
import {storeProfilePhoto} from '@/lib/server/profile-photo-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const errorResponse=(error:unknown)=>NextResponse.json(
  {error:error instanceof Error?error.message:'The photo could not be saved.'},
  {status:[400,403,413,415].includes((error as {status?:number})?.status??0)?(error as {status:number}).status:400}
);

export async function GET(){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in to view your profile.'},{status:401});
  return NextResponse.json({name:user.name,profileImage:user.profileImage},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
  try{
    const user=await currentUser();
    if(!user)return NextResponse.json({error:'Sign in to update your profile photo.'},{status:401});
    const upload=await parseProfilePhotoUpload(request);
    const playerId=upload.playerId||user.personId;
    if(playerId!==user.personId&&!upload.clubId)throw new Error('Select the dependant’s club.');
    const photo=await processProfilePhoto(upload.bytes);
    const dataUri=`data:image/webp;base64,${photo.toString('base64')}`;
    const saved=await withTransaction(client=>storeProfilePhoto(client,user.personId,playerId,playerId===user.personId?null:upload.clubId,dataUri));
    return NextResponse.json({profileImage:saved.profile_image,bytes:photo.length},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error);}
}

export async function DELETE(request:Request){
  try{
    const user=await currentUser();
    if(!user)return NextResponse.json({error:'Sign in to update your profile photo.'},{status:401});
    // Removal accepts a tiny optional target object, never image bytes.
    const reader=request.body?.getReader();
    let text='';
    if(reader){
      const decoder=new TextDecoder();let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();throw Object.assign(new Error('Invalid photo removal request.'),{status:413});}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
    }
    const body=text?JSON.parse(text):{};
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!['playerId','clubId'].includes(key)))throw new Error('Invalid photo removal request.');
    const playerId=String(body.playerId??'').trim()||user.personId;
    const clubId=String(body.clubId??'').trim();
    if(playerId!==user.personId&&!clubId)throw new Error('Select the dependant’s club.');
    await withTransaction(client=>storeProfilePhoto(client,user.personId,playerId,playerId===user.personId?null:clubId,null));
    return NextResponse.json({profileImage:null},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error);}
}
