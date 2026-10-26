import {dbQuery} from '@/lib/server/db';
import {currentUser} from '@/lib/server/auth';
import {ProfilePhotoEditor} from '@/components/profile-photo-editor';
export const dynamic='force-dynamic';
export default async function ProfilePage(){
 const user=await currentUser();
 const registration=user?(await dbQuery('select is_golf_player,golf_ireland_number,public.is_golf_coach(id) as coaching from person where id=$1',[user.personId])).rows[0]:null;
 return <main className="mx-auto grid max-w-3xl gap-5 p-5 md:p-10"><nav className="flex flex-wrap gap-4 font-bold underline"><a href="/">Home</a><a href="/family">My dependants</a><a href="/lessons">Lessons</a></nav><h1 className="text-3xl font-extrabold">My profile</h1>{user?<><p className="font-bold">{user.name}</p>{registration?.is_golf_player&&<p>Golf Ireland number: <strong>{registration.golf_ireland_number}</strong></p>}{registration?.coaching&&<p>Professional account · non-player</p>}<ProfilePhotoEditor initialImage={user.profileImage} name={user.name}/></>:<a href="/" className="underline">Sign in to update your profile photo</a>}</main>;
}
