import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const root=new URL('../public/',import.meta.url);
await mkdir(new URL('brand/',root),{recursive:true});
// Approved logo lockup stays unchanged. Export icons from its isolated symbol.
const symbol=await sharp(fileURLToPath(new URL('brand/better-by-par-symbol.png',root))).trim().resize(368,400,{fit:'inside'}).png().toBuffer();
const mark=`data:image/png;base64,${symbol.toString('base64')}`;
const shield='<path d="m416 382 28 10v24c0 18-12 31-28 39-16-8-28-21-28-39v-24z" fill="none" stroke="white" stroke-width="7" stroke-linejoin="round"/><path d="m402 416 10 10 19-22" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
const wrench='<path d="M438 389a21 21 0 0 0-27 27l-27 27a9 9 0 0 0 13 13l27-27a21 21 0 0 0 27-27l-14 14-13-13z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/>';
function ico(images){
 const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
 images.forEach(({size,data},i)=>{const at=6+16*i;header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12);offset+=data.length;});return Buffer.concat([header,...images.map(i=>i.data)]);
}
for(const [name,badge] of [['platform',''],['admin',shield],['maintenance',wrench]]){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="#fff"/><image href="${mark}" x="72" y="56" width="368" height="400"/>${badge?`<circle cx="416" cy="416" r="72" fill="${name==='admin'?'#061F3E':'#0878E8'}" stroke="white" stroke-width="12"/>${badge}`:''}</svg>`;
 await writeFile(new URL(`brand/${name}.svg`,root),svg);
 const raster=async size=>sharp(Buffer.from(svg)).resize(size,size).png().toBuffer();
 for(const size of [180,192,512])await writeFile(new URL(`brand/${name}-${size}.png`,root),await raster(size));
 const images=await Promise.all([16,32,48,64].map(async size=>({size,data:await raster(size)})));
 await writeFile(new URL(`brand/${name}-favicon.ico`,root),ico(images));
 if(name==='platform'){
  for(const file of ['favicon.ico','favicon-normal.ico'])await writeFile(new URL(file,root),ico(images));
  await writeFile(new URL('app-icon.svg',root),svg);
  for(const size of [192,512])await writeFile(new URL(`icons/icon-${size}.png`,root),await raster(size));
  await writeFile(new URL('icons/apple-touch-icon.png',root),await raster(180));
  // Opaque background and a generous safe area for Android adaptive masks.
  await sharp({create:{width:512,height:512,channels:4,background:'#FFFFFF'}}).composite([{input:await raster(410),left:51,top:51}]).png().toFile(fileURLToPath(new URL('icons/icon-maskable-512.png',root)));
 }
 if(name==='admin'){
  await writeFile(new URL('admin-icon.png',root),await raster(512));
  await writeFile(new URL('admin-icon-180.png',root),await raster(180));
 }
}
console.log('Generated Better By Par platform, admin and maintenance icons, PWA exports and four-size ICO files.');
