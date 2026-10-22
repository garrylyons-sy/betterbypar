export function youtubeVideoId(input) {
 const invalid=()=>{throw new Error('Choose a valid HTTPS YouTube video or livestream link.');};
 if(typeof input!=='string'||input.length>2048)return invalid();
 let url;try{url=new URL(input.trim());}catch{return invalid();}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return invalid();
 const host=url.hostname.toLowerCase();let id;
 if(host==='youtu.be'&&/^\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split('/')[1];
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)){
  if(url.pathname==='/watch')id=url.searchParams.get('v');
  else if(/^\/(live|embed)\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split('/')[2];
 }
 if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))return invalid();
 return id;
}
export function validateLiveDraft(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.fixtureId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.fixtureId))throw new Error('Choose a valid match.');
 if(input.notifyViewers!==undefined&&typeof input.notifyViewers!=='boolean')throw new Error('Choose a valid viewer notification option.');
 return {fixtureId:input.fixtureId,videoId:youtubeVideoId(input.youtubeUrl),notifyViewers:input.notifyViewers===true};
}
