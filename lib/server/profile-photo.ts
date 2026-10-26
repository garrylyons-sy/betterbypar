import sharp from 'sharp';

export const PROFILE_PHOTO_MAX_BYTES = 150 * 1024;
export const PROFILE_PHOTO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const maxBodyBytes = PROFILE_PHOTO_MAX_UPLOAD_BYTES + 64 * 1024;
const maxPixels = 64_000_000;
const photoError = (message:string,status=400) => Object.assign(new Error(message),{status});

/** Decode and encode afresh: input bytes and camera metadata are never persisted. */
export async function processProfilePhoto(input:Buffer):Promise<Buffer> {
  if (!input.length) throw photoError('Choose a valid image.');
  if (input.length > PROFILE_PHOTO_MAX_UPLOAD_BYTES) throw photoError('Photo uploads must be 4 MB or smaller.',413);
  try {
    const metadata = await sharp(input,{limitInputPixels:maxPixels,failOn:'warning'}).metadata();
    if (!metadata.format || !['jpeg','png','webp'].includes(metadata.format)) {
      throw photoError('Choose a JPEG, PNG or WebP image.');
    }
    if ((metadata.pages ?? 1) > 1) throw photoError('Choose a still photo; animated images are not supported.');
    for (const [size,quality] of [[512,80],[512,65],[512,50],[384,65],[256,65]]) {
      const result = await sharp(input,{limitInputPixels:maxPixels,failOn:'warning'})
        .rotate()
        .resize({width:size,height:size,fit:'inside',withoutEnlargement:true})
        .webp({quality,alphaQuality:quality,effort:4})
        .toBuffer();
      if (result.length <= PROFILE_PHOTO_MAX_BYTES) return result;
    }
    throw photoError('This photo could not be compressed sufficiently. Choose another image.');
  } catch(error) {
    if ((error as {status?:number})?.status) throw error;
    throw photoError('Choose a valid JPEG, PNG or WebP image within the supported image size.');
  }
}

/** Bound the whole multipart request, including uploads without Content-Length. */
export async function parseProfilePhotoUpload(request:Request) {
  const type=request.headers.get('content-type')??'';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) throw photoError('Upload the photo as form data.',415);
  const declared=Number(request.headers.get('content-length')??0);
  if (declared>maxBodyBytes) throw photoError('Photo upload is too large.',413);
  const reader=request.body?.getReader();
  if (!reader) throw photoError('Choose a photo.');
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBodyBytes){await reader.cancel();throw photoError('Photo upload is too large.',413);}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  let form:FormData;
  try{form=await new Response(new Uint8Array(Buffer.concat(chunks)),{headers:{'content-type':type}}).formData();}
  catch{throw photoError('The photo upload could not be read.');}
  if ([...form.keys()].some(key=>!['photo','playerId','clubId'].includes(key))) throw photoError('Unexpected photo upload fields.');
  if (form.getAll('photo').length!==1) throw photoError('Choose one photo.');
  const photo=form.get('photo');
  if (!(photo instanceof File) || photo.size===0) throw photoError('Choose a valid image.');
  if(photo.size>PROFILE_PHOTO_MAX_UPLOAD_BYTES)throw photoError('Photo uploads must be 4 MB or smaller.',413);
  const playerId=form.get('playerId'),clubId=form.get('clubId');
  if ((playerId!==null&&typeof playerId!=='string')||(clubId!==null&&typeof clubId!=='string'))throw photoError('Invalid player selection.');
  return {bytes:Buffer.from(await photo.arrayBuffer()),playerId:String(playerId??'').trim(),clubId:String(clubId??'').trim()};
}
