import { MemberDependants } from '@/components/member-dependants';
import { currentUser } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function FamilyPage(){
 const user=await currentUser();
 return <main className="mx-auto max-w-5xl p-5 md:p-10">{user?<MemberDependants/>:<div><h1 className="text-2xl font-bold">My dependants</h1><a href="/" className="underline">Sign in to manage dependants</a></div>}</main>;
}
