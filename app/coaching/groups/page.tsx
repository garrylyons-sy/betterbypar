import {AdminLessonGroups} from '@/components/admin-lesson-groups';
import {currentUser} from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function CoachingGroupsPage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-8"><h1 className="mb-5 text-2xl font-extrabold">Lesson groups</h1>{user?<AdminLessonGroups/>:<a href="/">Sign in to manage lesson groups</a>}</main>;}
