import {redirectProfessional} from '@/lib/server/professional-page';
import Link from 'next/link';
import {MyGolf} from '@/components/my-golf';
import {currentUser} from '@/lib/server/auth';
export const dynamic='force-dynamic';
export const metadata={title:'My Golf — Better By Par'};
export default async function MyGolfPage({searchParams}:{searchParams?:Promise<{clubId?:string|string[]}>}){const user=await currentUser();if(user){const params=await searchParams;await redirectProfessional(typeof params?.clubId==='string'?params.clubId:undefined);}return <main className="mx-auto min-h-screen max-w-5xl p-4 pb-12 sm:p-8">{user?<MyGolf/>:<p><Link href="/">Sign in to view your rounds</Link></p>}</main>;}
