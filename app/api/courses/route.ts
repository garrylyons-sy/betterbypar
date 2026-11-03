import {NextResponse} from 'next/server';
import {AccessError} from '@/lib/server/golf-access';
import {getCourseCatalogue} from '@/lib/server/course-catalogue';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){try{return NextResponse.json(await getCourseCatalogue(request),{headers});}catch(error){return NextResponse.json({error:error instanceof AccessError?error.message:'Courses could not be loaded. Please try again.'},{status:error instanceof AccessError?error.status:503,headers});}}
