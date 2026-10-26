import Link from 'next/link';import {currentUser} from '@/lib/server/auth';import {PlayerPractice} from '@/components/player-practice';
export const dynamic='force-dynamic';export const metadata={title:'My practice — Better By Par'};
export default async function PracticePage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-6xl space-y-5 p-5 md:p-8"><Link href="/my-golf" className="inline-block py-2 text-sm font-bold underline">← My Golf</Link>{user?<PlayerPractice/>:<Link href="/">Sign in to view your practice</Link>}</main>;}
