import Link from 'next/link';import {currentUser} from '@/lib/server/auth';import {CoachRounds} from '@/components/coach-rounds';
export const dynamic='force-dynamic';export const metadata={title:'Player rounds — Better By Par'};
export default async function Page(){return <main className="mx-auto min-h-screen max-w-6xl space-y-5 p-5 md:p-8"><Link href="/lessons/manage" className="inline-block py-2 text-sm font-bold underline">← Lesson diary</Link>{await currentUser()?<CoachRounds/>:<Link href="/">Sign in to review player rounds</Link>}</main>;}
