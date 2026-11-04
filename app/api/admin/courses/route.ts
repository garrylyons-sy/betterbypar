import {NextResponse} from 'next/server';
import {golfAccess,golfError} from '@/lib/server/golf-access';
import {courseApprovalQueue,reviewManualCourse} from '@/lib/server/course-approval';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){try{return NextResponse.json(await courseApprovalQueue(await golfAccess(request)),{headers});}catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status,headers});}}
export async function PATCH(request:Request){try{const access=await golfAccess(request);return NextResponse.json(await reviewManualCourse(access,await request.json()),{headers});}catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status,headers});}}
