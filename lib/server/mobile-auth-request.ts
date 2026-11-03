export async function readMobileAuthBody(request:Request){
 if(process.env.NODE_ENV==='production'&&(request.headers.get('x-forwarded-proto')??new URL(request.url).protocol.replace(':',''))!=='https')throw new Error('Secure HTTPS sign-in is required.');
 if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Send JSON sign-in details.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Sign-in details required.');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>4096)throw new Error('Sign-in request too large.');chunks.push(item.value);}}finally{await reader.cancel();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;
}
