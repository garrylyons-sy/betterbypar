'use client';
import {useState} from 'react';
import {AdminNotificationComposer} from '@/components/admin-notification-composer';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
export function PublisherMessages(){
 const [message,setMessage]=useState('');
 return <Card><CardHeader><CardTitle>Send a message</CardTitle><p className="text-sm text-muted-foreground">Choose who should receive your message and how to deliver it.</p></CardHeader><CardContent>{message?<p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-900">{message}</p>:null}<AdminNotificationComposer publisher onMessage={setMessage}/></CardContent></Card>;
}
