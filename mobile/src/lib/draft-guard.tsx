import {createContext,useCallback,useContext,useEffect,useMemo,useRef,type ReactNode} from 'react';
import {Alert} from 'react-native';
type Guard={register:(key:string,dirty:boolean)=>void;run:(action:()=>void)=>void};
const Context=createContext<Guard>({register:()=>{},run:action=>action()});
export function DraftGuardProvider({children}:{children:ReactNode}){
 const drafts=useRef(new Set<string>()),prompting=useRef(false);
 const register=useCallback((key:string,dirty:boolean)=>{if(dirty)drafts.current.add(key);else drafts.current.delete(key);},[]);
 const run=useCallback((action:()=>void)=>{
  if(!drafts.current.size){action();return;}
  if(prompting.current)return;prompting.current=true;
  Alert.alert('Unsaved changes','Continuing will discard your unsaved golf or notification details.',[
   {text:'Keep editing',style:'cancel',onPress:()=>{prompting.current=false;}},
   {text:'Discard changes',style:'destructive',onPress:()=>{prompting.current=false;drafts.current.clear();action();}}
  ],{cancelable:true,onDismiss:()=>{prompting.current=false;}});
 },[]);
 const value=useMemo(()=>({register,run}),[register,run]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useDraftGuard=()=>useContext(Context);
export function useDraftRegistration(key:string,dirty:boolean){const {register}=useDraftGuard();useEffect(()=>{register(key,dirty);return()=>register(key,false);},[key,dirty,register]);}
