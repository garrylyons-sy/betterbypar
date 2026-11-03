export function apiOrigin(value,development=false){let url;try{url=new URL(value);}catch{throw new Error('Configure a valid backend URL.');}if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use only the backend origin, without a path or credentials.');const host=url.hostname,local=host==='localhost'||host==='127.0.0.1'||host==='[::1]'||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);if(url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&local))throw new Error('Use HTTPS, or a local network address in development.');return url.origin;}
export function apiPath(value){if(typeof value!=='string'||!value.startsWith('/api/')||value.includes('\\')||value.includes('#'))throw new Error('Invalid API destination.');return value;}

export function apiRequestOptions(body,method=body===undefined?'GET':'POST'){
 if(!['GET','POST','PATCH','DELETE'].includes(method))throw new Error('Unsupported API method.');
 if(method==='GET'&&body!==undefined)throw new Error('GET requests cannot send a body.');
 const multipart=typeof FormData!=='undefined'&&body instanceof FormData;
 return {method,...(body===undefined?{}:multipart?{body}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})};
}

export function defaultApiOrigin(configured,development=false){return apiOrigin(configured?.trim()||'https://www.betterbypar.com',development);}
