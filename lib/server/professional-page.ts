import {redirect} from 'next/navigation';
import {golfAccess} from '@/lib/server/golf-access';
import {isProfessional} from '@/shared/golf-capabilities.mjs';
// golfAccess applies an administrator's selected role before inspecting memberships.
export async function redirectProfessional(requestedClubId?:string){const access=await golfAccess();const assignments=access.assignments.filter(assignment=>!requestedClubId||assignment.clubId===requestedClubId);if(!access.platform&&isProfessional(assignments.map(assignment=>assignment.role)))redirect('/lessons/manage'+(requestedClubId?`?clubId=${encodeURIComponent(requestedClubId)}`:''));}
