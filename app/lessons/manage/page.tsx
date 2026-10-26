import { AdminLessons } from '@/components/admin-lessons';
import { currentUser } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function ManageLessonsPage(){
 const user=await currentUser();
 return <main className="mx-auto grid max-w-6xl gap-5 p-5 md:p-10"><a className="font-bold underline" href="/lessons">Back to Lessons</a>{user?<AdminLessons/>:<a href="/">Sign in to manage lessons</a>}</main>;
}
