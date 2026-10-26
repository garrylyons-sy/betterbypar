import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {processProfilePhoto,parseProfilePhotoUpload,PROFILE_PHOTO_MAX_BYTES,PROFILE_PHOTO_MAX_UPLOAD_BYTES} from '../lib/server/profile-photo.ts';

const image=async(width,height)=>sharp({create:{width,height,channels:3,background:'#227766'}}).jpeg().toBuffer();

test('large profile photos become mobile-sized WebP without changing their aspect ratio',async()=>{
 const input=await image(3000,2000);
 const result=await processProfilePhoto(input);
 const info=await sharp(result).metadata();
 assert.equal(info.format,'webp');assert.equal(info.width,512);assert.equal(info.height,341);
 assert.ok(result.length<=PROFILE_PHOTO_MAX_BYTES);
 assert.equal(info.exif,undefined);assert.equal(info.icc,undefined);
});
test('small images are not upscaled',async()=>{
 const info=await sharp(await processProfilePhoto(await image(64,32))).metadata();
 assert.equal(info.width,64);assert.equal(info.height,32);
});
test('phone orientation is applied before resizing and EXIF is removed',async()=>{
 const input=await sharp(await image(1200,600)).withMetadata({orientation:6}).jpeg().toBuffer();
 const info=await sharp(await processProfilePhoto(input)).metadata();
 assert.equal(info.width,256);assert.equal(info.height,512);assert.equal(info.orientation,undefined);assert.equal(info.exif,undefined);
});
test('noisy photos stay within the stored byte cap',async()=>{
 const input=await sharp(randomBytes(1024*1024*3),{raw:{width:1024,height:1024,channels:3}}).png().toBuffer();
 const result=await processProfilePhoto(input);
 assert.ok(result.length<=PROFILE_PHOTO_MAX_BYTES);assert.equal((await sharp(result).metadata()).width,512);
});
test('unsupported/corrupt images and oversized uploads are rejected',async()=>{
 await assert.rejects(processProfilePhoto(Buffer.from('not a photo')),/valid.*image/i);
 await assert.rejects(processProfilePhoto(Buffer.from('<svg width="100" height="100"></svg>')),/JPEG.*PNG.*WebP/);
 await assert.rejects(processProfilePhoto(Buffer.alloc(PROFILE_PHOTO_MAX_UPLOAD_BYTES+1)),/4 MB/);
});
test('multipart uploads expose only image and optional dependant target',async()=>{
 const form=new FormData();form.set('photo',new File([await image(40,40)],'portrait.jpg',{type:'image/jpeg'}));form.set('playerId','child');form.set('clubId','club');
 const parsed=await parseProfilePhotoUpload(new Request('http://localhost/api/profile/photo',{method:'POST',body:form}));
 assert.equal(parsed.playerId,'child');assert.equal(parsed.clubId,'club');assert.ok(parsed.bytes.length>0);
});
test('a chunked upload cannot bypass the request body limit',async()=>{
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(PROFILE_PHOTO_MAX_UPLOAD_BYTES));c.enqueue(new Uint8Array(70*1024));c.close();}});
 const request=new Request('http://localhost/api/profile/photo',{method:'POST',body,duplex:'half',headers:{'content-type':'multipart/form-data; boundary=test'}});
 await assert.rejects(parseProfilePhotoUpload(request),/too large/i);
});

test('animated WebP is rejected by the server',async()=>{
 const animated=await sharp(randomBytes(16*32*3),{raw:{width:16,height:32,pageHeight:16,channels:3}}).webp({loop:0,delay:[100,100]}).toBuffer();
 assert.equal((await sharp(animated).metadata()).pages,2);
 await assert.rejects(processProfilePhoto(animated),/still photo/);
});
test('an image payload is validated by decoding even when the upload claims to be a JPEG',async()=>{
 const form=new FormData();form.set('photo',new File(['not an image'],'avatar.jpg',{type:'image/jpeg'}));
 const upload=await parseProfilePhotoUpload(new Request('http://localhost/api/profile/photo',{method:'POST',body:form}));
 await assert.rejects(processProfilePhoto(upload.bytes),/valid.*image/i);
});
