import Link from 'next/link';import {currentUser} from '@/lib/server/auth';import {CoachRounds} from '@/components/coach-rounds';
export const dynamic='force-dynamic';export const metadata={title:'Round review — Better By Par'};
export default async function Page(){return <main className="mx-auto min-h-screen max-w-6xl space-y-5 p-5 md:p-8">{await currentUser()?<CoachRounds coach={false}/>:<Link href="/">Sign in to read your round discussion</Link>}</main>;}
