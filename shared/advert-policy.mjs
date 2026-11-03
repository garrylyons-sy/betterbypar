// The same policy protects web rendering, native Linking and campaign writes.
export function safeAdvertLink(value) {
 if(typeof value!=='string'||!value||value!==value.trim()||/[\u0000-\u0020\\]/.test(value))return null;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?value:null;}catch{return null;}
}
export function safeAdvertImage(value) {
 if(typeof value!=='string'||!value||value!==value.trim()||/[\u0000-\u001f\\]/.test(value))return null;
 if(value.startsWith('/')&&!value.startsWith('//'))return value;
 if(value.length<=5_600_000&&/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;
 return safeAdvertLink(value);
}
export function advertImageUrl(value,origin){const safe=safeAdvertImage(value);return safe?.startsWith('/')?new URL(safe,origin).toString():safe;}
