'use client';
import {useState} from 'react';
import {PublisherMessageHistory} from '@/components/publisher-message-history';
import {AdminNotificationComposer} from '@/components/admin-notification-composer';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
export function PublisherMessages(){
 const [message,setMessage]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false),[historyRevision,setHistoryRevision]=useState(0);
 return <Card><CardHeader><CardTitle>Send a message</CardTitle><p className="text-sm text-muted-foreground">Choose who should receive your message and how to deliver it.</p></CardHeader><CardContent>{message?<p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-900">{message}</p>:null}<AdminNotificationComposer publisher onMessage={setMessage} onSent={()=>setHistoryRevision(value=>value+1)}/><details className="mt-5 rounded-xl border border-slate-200" onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary className="cursor-pointer p-4 font-extrabold">Sent messages</summary>{historyOpen?<div className="px-4 pb-4"><PublisherMessageHistory key={historyRevision}/></div>:null}</details></CardContent></Card>;
}
