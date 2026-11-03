import {createHmac,timingSafeEqual} from 'node:crypto';
export function signRoleView(context,sessionId,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({...context,expiresAt:now+3600000})).toString('base64url');
 return payload+'.'+createHmac('sha256',sessionId).update('bbp-role-view:'+payload).digest('base64url');
}
export function readRoleView(token,sessionId,now=Date.now()){
 if(!token||!sessionId)return null;
 try{const [payload,signature,...extra]=token.split('.');if(extra.length)return null;const expected=createHmac('sha256',sessionId).update('bbp-role-view:'+payload).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const value=JSON.parse(Buffer.from(payload,'base64url').toString());return typeof value.personId==='string'&&typeof value.clubId==='string'&&typeof value.role==='string'&&Number.isFinite(value.expiresAt)&&value.expiresAt>now?value:null;}catch{return null;}
}
