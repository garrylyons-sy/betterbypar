import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import {apiOrigin} from './api-policy.mjs';
import type {NativeLogin} from '../../../shared/native-contracts';
const key='betterbypar.google-pending';
type Pending={origin:string;attempt:string;verifier:string;createdAt:number};
let pendingWork:Promise<unknown>=Promise.resolve();
function serializePending<T>(action:()=>Promise<T>):Promise<T>{const task=pendingWork.then(action);pendingWork=task.catch(()=>{});return task;}
export const clearGoogleSignIn=(attempt?:string)=>serializePending(async()=>{if(attempt){const stored=await SecureStore.getItemAsync(key);if(!stored||JSON.parse(stored).attempt!==attempt)return;}await SecureStore.deleteItemAsync(key);});
async function post<T>(origin:string,path:string,body:unknown):Promise<T>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error??'Google sign-in is unavailable.');return data;}finally{clearTimeout(timeout);}}
export async function beginGoogleSignIn(configuredOrigin:string,isCurrent:()=>boolean=()=>true){
 const origin=apiOrigin(configuredOrigin,__DEV__),bytes=await Crypto.getRandomBytesAsync(32),verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const challenge=(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const result=await post<{attempt:string;url:string}>(origin,'/api/mobile/google/start',{challenge});const destination=new URL(result.url);
 if(destination.origin!==origin||destination.pathname!=='/auth/google'||! /^[A-Za-z0-9_-]{32}$/.test(result.attempt))throw new Error('Invalid Google sign-in destination.');
 if(!isCurrent())throw new Error('This sign-in was cancelled.');
 await serializePending(async()=>{if(!isCurrent())throw new Error('This sign-in was cancelled.');await SecureStore.setItemAsync(key,JSON.stringify({origin,attempt:result.attempt,verifier,createdAt:Date.now()} satisfies Pending),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});});
 try{if(!isCurrent())throw new Error('This sign-in was cancelled.');await Linking.openURL(destination.toString());}catch(reason){await clearGoogleSignIn(result.attempt);throw reason;}
}
let completing:Promise<{origin:string;login:NativeLogin}>|null=null;
export function completeGoogleSignIn(attempt:string,code:string,error:string){
 if(completing)return completing;
 completing=(async()=>{const raw=await SecureStore.getItemAsync(key);if(!raw)throw new Error('Start Google sign-in from the login screen first.');const pending=JSON.parse(raw) as Pending;
 if(pending.attempt!==attempt)throw new Error('This Google sign-in belongs to another request.');
 try{if(Date.now()-pending.createdAt>10*60000)throw new Error('Google sign-in expired. Please try again.');if(error)throw new Error(error.slice(0,300));const origin=apiOrigin(pending.origin,__DEV__),login=await post<NativeLogin>(origin,'/api/mobile/google/exchange',{attempt,code,verifier:pending.verifier});return {origin,login};}finally{await clearGoogleSignIn(pending.attempt);}
 })().finally(()=>{completing=null;});return completing;
}

export function requestPasswordReset(origin:string,identifier:string){return post<{message:string}>(apiOrigin(origin,__DEV__),'/api/password/forgot',{identifier:identifier.trim()});}
