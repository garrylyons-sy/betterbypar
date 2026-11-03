import Link from 'next/link';import {currentUser} from '@/lib/server/auth';import {CoachPractice} from '@/components/coach-practice';
export const dynamic='force-dynamic';export const metadata={title:'Coaching practice — Better By Par'};
export default async function ManagePracticePage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-6xl space-y-5 p-5 md:p-8">{user?<CoachPractice/>:<Link href="/">Sign in to manage practice</Link>}</main>;}
