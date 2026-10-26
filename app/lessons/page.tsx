import { MemberLessons } from '@/components/member-lessons';
import { currentUser } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function LessonsPage(){
 const user=await currentUser();
 return <main className="mx-auto max-w-5xl p-5 md:p-10">{user?<MemberLessons/>:<div><h1 className="text-2xl font-bold">Lessons</h1><a href="/" className="underline">Sign in to book lessons</a></div>}</main>;
}
