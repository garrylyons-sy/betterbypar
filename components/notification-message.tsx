'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Message={id:string;announcementId:string;title:string;body:string;createdAt:string;availableUntil:string};
export function NotificationMessage({announcementId,onOpened}:{announcementId:string;onOpened:()=>void}){
 const [message,setMessage]=useState<Message|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [receiptError,setReceiptError]=useState(''),[receiptRevision,setReceiptRevision]=useState(0);
 const openedCallback=useRef(onOpened);openedCallback.current=onOpened;
 const acknowledged=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();setMessage(null);setError('');acknowledged.current=false;
  void fetch(`/api/notifications/message?id=${encodeURIComponent(announcementId)}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
   .then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||'Could not load this message.');if(!controller.signal.aborted)setMessage(payload.message);})
   .catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});
  return ()=>controller.abort();
 },[announcementId,revision]);
 useEffect(()=>{
  if(!message)return;
  let pending=false,active=true;
  const acknowledge=async()=>{
   if(document.visibilityState!=='visible'||acknowledged.current||pending||Date.now()>=new Date(message.availableUntil).getTime())return;
   pending=true;setReceiptError('');
   try{
    const response=await fetch(`/api/notifications/message?id=${encodeURIComponent(message.announcementId)}`,{method:'POST',credentials:'same-origin',keepalive:true});
    if(!response.ok)throw Error('Read status could not be saved.');
    acknowledged.current=true;
    if(active)openedCallback.current();
   }catch{if(active)setReceiptError('Read status could not be saved. Please retry.');}
   finally{pending=false;}
  };
  void acknowledge();document.addEventListener('visibilitychange',acknowledge);
  return ()=>{active=false;document.removeEventListener('visibilitychange',acknowledge);};
 },[message,receiptRevision]);
 useEffect(()=>{
  if(!message)return;
  let timer:ReturnType<typeof setTimeout>;
  const expire=()=>{const remaining=new Date(message.availableUntil).getTime()-Date.now();if(remaining<=0){setMessage(null);setError('This message has expired.');}else timer=setTimeout(expire,Math.min(2_147_483_647,remaining));};
  expire();return ()=>clearTimeout(timer);
 },[message]);
 if(error)return <div role="alert" className="grid gap-3 text-sm"><p>{error}</p><Button type="button" variant="outline" onClick={()=>setRevision(value=>value+1)}>Retry</Button></div>;
 if(!message)return <p role="status" className="text-sm text-slate-600">Loading message…</p>;
 return <article className="grid gap-3"><h3 className="break-words text-lg font-extrabold">{message.title}</h3><time dateTime={message.createdAt} className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString('en-IE',{dateStyle:'medium',timeStyle:'short'})}</time><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{message.body}</p>{receiptError?<p role="alert" className="text-xs text-red-700">{receiptError} <button type="button" className="min-h-10 underline" onClick={()=>setReceiptRevision(value=>value+1)}>Retry read status</button></p>:null}</article>;
}
