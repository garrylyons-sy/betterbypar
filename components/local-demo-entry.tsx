'use client';
import {useState} from 'react';
import {localDemoAccounts,localDemoPassword} from '@/lib/local-demo.mjs';
import {Button} from '@/components/ui/button';
export function LocalDemoEntry(){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function open(account:typeof localDemoAccounts[number]){
  setBusy(account.key);setError('');
  try{
   const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:account.email,password:localDemoPassword,adminIntent:account.role==='Platform Admin'})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Demo sign-in failed.');
   window.sessionStorage.removeItem('interclub:admin-session-data:v1');window.sessionStorage.removeItem('interclub:admin-session-tab:v1');
   window.location.assign(account.destination);
  }catch(e){setError((e as Error).message);setBusy('');}
 }
 return <div className="grid gap-5"><header><a href="/demo/brand" className="float-right text-sm font-semibold underline underline-offset-4">Preview icons & splash →</a><p className="text-sm font-bold uppercase text-[#1b8a72]">Local demo</p><h1 className="mt-2 text-3xl font-extrabold">Better By Par</h1><p className="mt-3 text-[#6c5a73]">Explore with fictional golf clubs and users. Changes stay in this computer’s demo database. Outgoing email, Google sign-in and push delivery are disabled.</p></header>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
 <div className="grid gap-4 md:grid-cols-2">{localDemoAccounts.map(account=><section key={account.key} className="grid gap-3 rounded-2xl border bg-white p-5"><h2 className="text-lg font-extrabold">{account.role}</h2><p className="text-sm">{account.name} · {account.email}</p><Button disabled={Boolean(busy)} onClick={()=>open(account)}>{busy===account.key?'Signing in…':`Open as ${account.role}`}</Button></section>)}</div>
 <p className="text-sm text-[#6c5a73]">The parent manages Casey Parker, a junior without a login. Try the club administrator for branding, either professional for lessons, and the member for a profile photo or lesson booking. Return here to switch roles.</p>
 </div>;
}
