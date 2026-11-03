/** Check originals before native image decoding; the server independently validates encoded bytes. */
export function validateProfilePhotoAsset(asset){
 if(!asset?.uri||(asset.type&&asset.type!=='image'))throw new Error('Choose a still photo.');
 if(!Number.isFinite(asset.width)||!Number.isFinite(asset.height)||asset.width<=0||asset.height<=0||asset.width*asset.height>64_000_000)throw new Error('This photo is too large to process. Choose a smaller image.');
 if(asset.fileSize>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');
}
export function profilePhotoResize(width,height){return Math.max(width,height)<=1024?null:width>=height?{width:1024,height:null}:{width:null,height:1024};}
