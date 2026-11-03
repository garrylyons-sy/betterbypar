import {ProfessionalHome} from '@/components/professional-home';
import {currentUser} from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function CoachingPlayersPage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-5xl p-4 sm:p-8">{user?<ProfessionalHome playersView/>:<a href="/">Sign in to view club players</a>}</main>;}
