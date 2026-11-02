import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {AppState,Platform} from 'react-native';
import {apiOrigin,apiPath} from './api-policy.mjs';
import {signOutNative} from './session-policy.mjs';
import {credentialStore} from './storage';
import type {NativeSession,NativeLogin} from '../../../shared/native-contracts';
async function fetchTimed(url:string,options:RequestInit){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
const configured=process.env.EXPO_PUBLIC_API_URL;
const defaultOrigin=configured??(Platform.OS==='android'?'http://10.0.2.2:3500':'http://127.0.0.1:3500');
type Credential={origin:string;token:string;expiresAt:string};
type State={session:NativeSession|null;status:'checking'|'signed-out'|'ready'|'offline';error:string;origin:string;clubId:string};
type Context=State&{club:NativeSession['clubs'][number]|null;setClub:(id:string)=>void;signIn:(identifier:string,password:string,origin:string)=>Promise<void>;signOut:()=>Promise<void>;retry:()=>Promise<void>;refreshSession:()=>Promise<void>;request:<T>(path:string,body?:unknown)=>Promise<T>};
const Session=createContext<Context|null>(null);
export function SessionProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<State>({session:null,status:'checking',error:'',origin:defaultOrigin,clubId:''}),credential=useRef<Credential|null>(null),generation=useRef(0),refreshRevision=useRef(0);
 const raw=useCallback(async<T,>(path:string,body?:unknown,override?:Credential):Promise<T>=>{const c=override??credential.current;if(!c)throw new Error('Sign in to continue.');const response=await fetchTimed(c.origin+apiPath(path),{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok){if(response.status===401&&credential.current?.token===c.token){await credentialStore.clear();credential.current=null;generation.current++;setState(s=>({...s,session:null,status:'signed-out',error:'Your session expired. Sign in again.'}));}throw new Error(data.error??'Request failed.');}return data as T;},[]);
 const bootstrap=useCallback(async()=>{const c=credential.current;if(!c){setState(s=>({...s,status:'signed-out'}));return;}const version=++generation.current;setState(s=>({...s,status:'checking',error:''}));try{const session=await raw<NativeSession>('/api/mobile/session',undefined,c);if(version===generation.current)setState(s=>({...s,session,status:'ready',origin:c.origin,error:'',clubId:session.clubs.some(club=>club.id===s.clubId)?s.clubId:session.clubs[0]?.id??''}));}catch(e){if(version===generation.current)setState(s=>({...s,status:credential.current?'offline':'signed-out',error:e instanceof Error?e.message:'Could not reconnect.'}));}},[raw]);
 // Refresh branding/profile without replacing the active screen or its scroll position.
 const refreshSession=useCallback(async()=>{
  const c=credential.current;if(!c)return;
  const version=generation.current,revision=++refreshRevision.current;
  const session=await raw<NativeSession>('/api/mobile/session',undefined,c);
  if(version===generation.current&&revision===refreshRevision.current&&credential.current?.token===c.token)setState(s=>s.status==='ready'?{...s,session,clubId:session.clubs.some(club=>club.id===s.clubId)?s.clubId:session.clubs[0]?.id??''}:s);
 },[raw]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refreshSession().catch(()=>{});});return()=>subscription.remove();},[refreshSession]);
 useEffect(()=>{let active=true;void credentialStore.read().then(async value=>{if(!active)return;if(value){try{const c=JSON.parse(value) as Credential;c.origin=apiOrigin(c.origin,__DEV__);if(!/^bbpm_[\w-]{43}$/.test(c.token)||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=Date.now()||(configured&&apiOrigin(configured,__DEV__)!==c.origin))throw new Error('Expired');credential.current=c;}catch{await credentialStore.clear();}}if(active)await bootstrap();}).catch(e=>active&&setState(s=>({...s,status:'offline',error:e.message})));return()=>{active=false;};},[bootstrap]);
 const signIn=async(identifier:string,password:string,origin:string)=>{const server=apiOrigin(origin,__DEV__),response=await fetchTimed(server+'/api/mobile/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})}),data=await response.json() as NativeLogin&{error?:string};if(!response.ok)throw new Error(data.error??'Sign-in failed.');const c={origin:server,token:data.token,expiresAt:data.expiresAt};try{await credentialStore.write(JSON.stringify(c));}catch{await raw('/api/mobile/logout',{},c).catch(()=>{});throw new Error('Secure storage is unavailable. Please try again.');}credential.current=c;await bootstrap();};
 const signOut=async()=>{const c=credential.current;await signOutNative({clear:credentialStore.clear,reset:()=>{credential.current=null;generation.current++;setState(s=>({...s,session:null,status:'signed-out',error:'',clubId:''}));},revoke:()=>c?raw('/api/mobile/logout',{},c):Promise.resolve()});};
 return <Session.Provider value={{...state,club:state.session?.clubs.find(c=>c.id===state.clubId)??null,setClub:id=>setState(s=>s.session?.clubs.some(c=>c.id===id)?{...s,clubId:id}:s),signIn,signOut,retry:bootstrap,refreshSession,request:raw}}>{children}</Session.Provider>;
}
export function useSession(){const c=useContext(Session);if(!c)throw new Error('Session provider missing');return c;}
