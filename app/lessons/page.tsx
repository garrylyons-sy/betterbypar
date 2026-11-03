import {redirectProfessional} from '@/lib/server/professional-page';
import { MemberLessons } from '@/components/member-lessons';
import { currentUser } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function LessonsPage({searchParams}:{searchParams?:Promise<{clubId?:string|string[]}>}){
 const user=await currentUser();if(user){const params=await searchParams;await redirectProfessional(typeof params?.clubId==='string'?params.clubId:undefined);}
 return <main className="mx-auto max-w-5xl p-5 md:p-10">{user?<MemberLessons/>:<div><h1 className="text-2xl font-bold">Lessons</h1><a href="/" className="underline">Sign in to book lessons</a></div>}</main>;
}
