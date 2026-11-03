import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {dbQuery,withTransaction} from '@/lib/server/db';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const snapshot=(account:{password_hash:string|null;google_id:string|null})=>hash(JSON.stringify([account.password_hash,account.google_id]));
export const googleAttemptFromNext=(next:string|undefined)=>/^\/auth\/mobile-google\?attempt=([A-Za-z0-9_-]{32})$/.exec(next??'')?.[1]??null;
export function mobileGoogleReturn(attempt:string,error?:string,code?:string){const params=new URLSearchParams({attempt,...(error?{error}:{}),...(code?{code}:{})});return `betterbypar://auth-return?${params}`;}
export async function beginMobileGoogle(challenge:unknown){if(typeof challenge!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(challenge))throw new Error('Invalid sign-in challenge.');const attempt=randomBytes(24).toString('base64url');await dbQuery('delete from mobile_google_attempt where expires_at<=now()');await dbQuery('insert into mobile_google_attempt(id,challenge) values($1,$2)',[attempt,challenge]);return attempt;}
export async function authorizeMobileGoogle(attempt:string,accountId:string){
 return withTransaction(async client=>{
  const pending=(await client.query('select id from mobile_google_attempt where id=$1 and expires_at>now() and user_account_id is null for update',[attempt])).rows[0];if(!pending)throw new Error('Google sign-in expired. Start again in the app.');
  const account=(await client.query('select ua.password_hash,ua.google_id from user_account ua join person p on p.id=ua.person_id and p.active where ua.id=$1 and ua.active and ua.google_id is not null for share of ua,p',[accountId])).rows[0];if(!account)throw new Error('Google account is unavailable.');
  const code=randomBytes(32).toString('base64url');await client.query("update mobile_google_attempt set user_account_id=$2,credential_snapshot=$3,code_hash=$4,expires_at=now()+interval '2 minutes' where id=$1",[attempt,accountId,snapshot(account),hash(code)]);return mobileGoogleReturn(attempt,undefined,code);
 });
}
export async function exchangeMobileGoogle(attempt:unknown,code:unknown,verifier:unknown){
 if(typeof attempt!=='string'||! /^[A-Za-z0-9_-]{32}$/.test(attempt)||typeof code!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(code)||typeof verifier!=='string'||! /^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw new Error('Invalid Google sign-in response.');
 return withTransaction(async client=>{
  const pending=(await client.query('select * from mobile_google_attempt where id=$1 and code_hash=$2 and expires_at>now() for update',[attempt,hash(code)])).rows[0];if(!pending)throw new Error('Google sign-in expired or was already used. Start again.');
  const actual=createHash('sha256').update(verifier).digest('base64url'),expected=String(pending.challenge);if(actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw new Error('Google sign-in does not belong to this device.');
  const account=(await client.query('select ua.*,p.first_name,p.last_name,p.email,p.profile_image from user_account ua join person p on p.id=ua.person_id and p.active where ua.id=$1 and ua.active and ua.google_id is not null for share of ua,p',[pending.user_account_id])).rows[0];if(!account||snapshot(account)!==pending.credential_snapshot)throw new Error('Your account changed. Start Google sign-in again.');
  const token=`bbpm_${randomBytes(32).toString('base64url')}`,expiresAt=new Date(Date.now()+30*86400000);await client.query('insert into mobile_session(token_hash,user_account_id,expires_at) values($1,$2,$3)',[hash(token),account.id,expiresAt]);await client.query('delete from mobile_google_attempt where id=$1',[attempt]);
  return {token,expiresAt:expiresAt.toISOString(),user:{accountId:account.id,personId:account.person_id,username:account.username,email:account.email??'',name:`${account.first_name} ${account.last_name}`.trim(),profileImage:account.profile_image??''}};
 });
}
