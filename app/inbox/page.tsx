import Link from 'next/link';
import {currentUser} from '@/lib/server/auth';
import {InboxPage} from '@/components/inbox-page';
export const dynamic='force-dynamic';
export const metadata={title:'Inbox — Better By Par'};
export default async function Inbox(){const user=await currentUser();return <main className="mx-auto max-w-3xl p-4 md:p-8">{user?<InboxPage/>:<div><h1 className="text-2xl font-extrabold">Inbox</h1><Link href="/">Sign in to view your inbox</Link></div>}</main>;}
