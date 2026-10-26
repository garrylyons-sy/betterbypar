/** Reduce mobile originals before sending; the server independently enforces its own limits. */
export async function prepareProfilePhoto(file:File):Promise<Blob> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if(file.size>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
  catch{throw new Error('This photo could not be opened. Choose another JPEG, PNG or WebP image.');}
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>64_000_000)throw new Error('This photo is too large to process. Choose a smaller image.');
    const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Photo processing is unavailable in this browser.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
    if(!blob||blob.size>4*1024*1024)throw new Error('This photo could not be made small enough. Choose another image.');
    return blob;
  }finally{bitmap.close();}
}
