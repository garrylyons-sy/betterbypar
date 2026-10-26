import { AdminLessons } from '@/components/admin-lessons';
import { currentUser } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function ManageLessonsPage(){
 const user=await currentUser();
 return <main className="mx-auto grid max-w-6xl gap-5 p-5 md:p-10"><nav className="flex flex-wrap gap-4 text-sm font-bold underline"><a href="/lessons">Back to Lessons</a><a href="/rounds/coaching">Player rounds</a><a href="/practice/manage">Challenges & drills</a></nav>{user?<AdminLessons/>:<a href="/">Sign in to manage lessons</a>}</main>;
}
