import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {AppState} from 'react-native';
import {useSession} from './session';
import {pruneNotificationInbox} from '../../../lib/notification-policy.mjs';
import type {NotificationInbox} from '../../../shared/notification-contracts';
const blank:NotificationInbox={eligible:false,items:[],unreadCount:0};
type InboxContext={inbox:NotificationInbox;loading:boolean;error:string;refresh:()=>Promise<void>;update:(body:unknown,method:'PATCH'|'DELETE')=>Promise<void>};
const Context=createContext<InboxContext>({inbox:blank,loading:false,error:'',refresh:async()=>{},update:async()=>{}});
export function NotificationsProvider({children}:{children:ReactNode}){
 const {request,status,session,origin}=useSession(),[state,setState]=useState<{scope:string;inbox:NotificationInbox;loading:boolean;error:string}>({scope:'',inbox:blank,loading:false,error:''}),revision=useRef(0);
 const scope=status==='ready'?`${origin}:${session?.user.personId}`:'',scopeRef=useRef(scope);useLayoutEffect(()=>{scopeRef.current=scope;},[scope]);
 const refresh=useCallback(async()=>{if(!scope)return;const version=++revision.current;setState(current=>({scope,inbox:current.scope===scope?current.inbox:blank,loading:true,error:''}));try{const next=await request<NotificationInbox>('/api/notifications');if(scopeRef.current===scope&&version===revision.current)setState({scope,inbox:pruneNotificationInbox(next),loading:false,error:''});}catch(reason){if(scopeRef.current===scope&&version===revision.current)setState(current=>({...current,loading:false,error:reason instanceof Error?reason.message:'Could not load your inbox.'}));}},[request,scope]);
 const invalidate=useCallback(()=>{revision.current++;},[]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return refresh();});const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},30000),subscription=AppState.addEventListener('change',next=>{if(next==='active')void refresh();});return()=>{active=false;invalidate();clearInterval(timer);subscription.remove();};},[refresh,invalidate]);
 const update=async(body:unknown,method:'PATCH'|'DELETE')=>{const actingScope=scope;await request('/api/notifications',body,method);if(scopeRef.current===actingScope)await refresh();};
 const current=state.scope===scope&&scope?state:{inbox:blank,loading:!!scope,error:''};
 return <Context.Provider value={{...current,refresh,update}}>{children}</Context.Provider>;
}
export const useNotifications=()=>useContext(Context);
