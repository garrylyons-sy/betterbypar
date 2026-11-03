import type {PoolClient} from 'pg';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,AccessError} from '@/lib/server/golf-access';
import {catalogueCourseName,catalogueSnapshot,applyCatalogueTee} from '@/shared/course-catalogue.mjs';
import type {CatalogueCourse,CatalogueTee,CourseCatalogue} from '@/shared/course-catalogue';
import type {RoundInput} from '@/lib/golf-rounds.mjs';
export async function readCourseCatalogue(client:Pick<PoolClient,'query'>):Promise<CourseCatalogue>{
 const courses=(await client.query<CatalogueCourse>(`select id,slug,club_name as "clubName",name,location,source_url as "sourceUrl",reviewed_on::text as "reviewedOn" from public.golf_course where active order by club_name,name,id`)).rows.map(c=>({...c,tees:[] as CatalogueTee[]}));
 const tees=(await client.query<CatalogueTee&{courseId:string}>(`select t.id,t.course_id as "courseId",t.slug,t.name,t.colour,t.rating_category as "ratingCategory",t.par,t.course_rating::float8 as "courseRating",t.slope_rating as "slopeRating",t.total_distance as "totalDistance",t.distance_unit as "distanceUnit",t.source_url as "sourceUrl",t.reviewed_on::text as "reviewedOn",coalesce(jsonb_agg(jsonb_build_object('number',h.number,'par',h.par,'strokeIndex',h.stroke_index,'distance',h.distance) order by h.number) filter(where h.number is not null),'[]'::jsonb) as holes from public.golf_course_tee t join public.golf_course c on c.id=t.course_id and c.active left join public.golf_course_hole h on h.tee_id=t.id where t.active group by t.id order by t.name,t.rating_category,t.id`)).rows;
 for(const {courseId,...tee} of tees){const course=courses.find(c=>c.id===courseId);if(course){try{catalogueSnapshot(course,tee);course.tees.push(tee);}catch{/* Incomplete scorecards cannot be selected. */}}}
 return {courses:courses.filter(c=>c.tees.length>0)};
}
export async function getCourseCatalogue(request:Request){await golfAccess(request);return withTransaction(readCourseCatalogue);}
export async function resolveRoundCourseDetails(client:Pick<PoolClient,'query'>,data:RoundInput,previous?:RoundInput,imported=false):Promise<RoundInput>{
 if(imported){if(data.courseDetails)throw new AccessError('Imported cards keep their official course details.',400);return {...data,...(previous?.courseDetails!==undefined?{courseDetails:previous.courseDetails}:{})};}
 const supplied=data.courseDetails,old=previous?.courseDetails;
 if(supplied===undefined){if(old&&data.courseName===previous?.courseName&&data.teeName===previous?.teeName)return withCanonicalPars(data,old);return data;}
 if(supplied===null)return data;
 if(old&&supplied.courseId===old.courseId&&supplied.teeId===old.teeId){return withCanonicalPars(data,old);}
 const {courses}=await readCourseCatalogue(client),course=courses.find(c=>c.id===supplied.courseId),tee=course?.tees.find(t=>t.id===supplied.teeId);
 if(!course||!tee)throw new AccessError('Choose an available course and tee from the catalogue.',400);
 if(previous){try{applyCatalogueTee(previous,course,tee);}catch(error){throw new AccessError(error instanceof Error?error.message:'Keep the existing course layout.',400);}}
 const courseDetails=catalogueSnapshot(course,tee);
 return {...data,courseName:catalogueCourseName(course),teeName:tee.name,courseDetails,holes:data.holes.map(h=>({...h,par:courseDetails.holes.find(c=>c.number===h.number)?.par??null}))};
}

function withCanonicalPars(data:RoundInput,courseDetails:NonNullable<RoundInput['courseDetails']>):RoundInput{
 return {...data,courseDetails,holes:data.holes.map(h=>({...h,par:courseDetails.holes.find(reference=>reference.number===h.number)?.par??null}))};
}
