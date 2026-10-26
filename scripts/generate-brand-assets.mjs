import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const root=new URL('../public/',import.meta.url);
await mkdir(new URL('brand/',root),{recursive:true});
const flag='<path d="M246 153v173" stroke="#F5F2E8" stroke-width="16" stroke-linecap="round"/><path d="M255 151l91 34-91 36z" fill="#DCC38C"/><ellipse cx="251" cy="337" rx="78" ry="21" fill="none" stroke="#DCC38C" stroke-width="10"/><circle cx="301" cy="308" r="12" fill="#F5F2E8"/>';
const shield='<path d="M256 119l108 39v94c0 74-46 117-108 147-62-30-108-73-108-147v-94z" fill="none" stroke="#DCC38C" stroke-width="15" stroke-linejoin="round"/><path d="M237 199v102m8-100 59 24-59 24" fill="none" stroke="#F5F2E8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="m288 302 15 15 30-34" fill="none" stroke="#DCC38C" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>';
const wrench='<path d="M307 149a66 66 0 0 0-83 85l-82 82a29 29 0 0 0 41 41l82-82a66 66 0 0 0 85-83l-42 42-41-41z" fill="none" stroke="#E9C496" stroke-width="17" stroke-linejoin="round"/><circle cx="165" cy="334" r="7" fill="#F5F2E8"/><path d="M155 176h40m-20-20v40m142 137h34m-17-17v34" stroke="#F5F2E8" stroke-width="9" stroke-linecap="round"/>';
const variants=[['platform','#153F35','#0A2722',flag],['admin','#1B3045','#0A1828',shield],['maintenance','#49392E','#241E1B',wrench]];
function ico(images){
 const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
 images.forEach(({size,data},i)=>{const at=6+16*i;header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12);offset+=data.length;});return Buffer.concat([header,...images.map(i=>i.data)]);
}
for(const [name,light,dark,symbol] of variants){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#bg)"/><rect x="18" y="18" width="476" height="476" rx="96" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="2"/>${symbol}</svg>`;
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
  // Opaque square and generous safe zone for Android adaptive icon masks.
  await sharp({create:{width:512,height:512,channels:4,background:dark}}).composite([{input:await raster(410),left:51,top:51}]).png().toFile(fileURLToPath(new URL('icons/icon-maskable-512.png',root)));
 }
 if(name==='admin'){
  await writeFile(new URL('admin-icon.png',root),await raster(512));
  await writeFile(new URL('admin-icon-180.png',root),await raster(180));
 }
}
console.log('Generated three SVG masters, PNG exports, and four-size ICO files.');
