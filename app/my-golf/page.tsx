import Link from 'next/link';
import {MyGolf} from '@/components/my-golf';
import {currentUser} from '@/lib/server/auth';
export const dynamic='force-dynamic';
export const metadata={title:'My Golf — Better By Par'};
export default async function MyGolfPage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-5xl p-4 pb-12 sm:p-8"><Link href="/" className="mb-5 inline-block text-sm font-bold underline">← Home</Link>{user?<MyGolf/>:<p><Link href="/">Sign in to view your rounds</Link></p>}</main>;}
