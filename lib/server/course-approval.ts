import type {GolfAccess} from './golf-access';
import {AccessError,golfAudit} from './golf-access';
import {withTransaction} from './db';
import {readCourseCatalogue} from './course-catalogue';
import {catalogueSnapshot} from '@/shared/course-catalogue.mjs';
import type {CatalogueCourse,CatalogueTee} from '@/shared/course-catalogue';
function admin(access:GolfAccess){if(!access.platform)throw new AccessError('Platform administrator access required.');}
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new AccessError('Complete the course, club, tee and source details.',400);return v.trim();};
export function publicationInput(body:Record<string,unknown>,id:string){
 const sourceUrl=text(body.sourceUrl,2000);if(!/^https?:\/\//.test(sourceUrl))throw new AccessError('Enter a public HTTP or HTTPS scorecard source.',400);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin'}).format(new Date());
 const course:CatalogueCourse={id,slug:`submitted-${id}`,clubName:text(body.clubName,160),name:text(body.courseName,160),location:typeof body.location==='string'?body.location.trim().slice(0,200):'',sourceUrl,reviewedOn:today,tees:[]};
 const holes=Array.isArray(body.pars)?body.pars.map((par,i)=>({number:i+1,par,strokeIndex:null,distance:null})):[];
 const tee={id,slug:'reviewed',name:text(body.teeName,80),colour:'',ratingCategory:body.ratingCategory,par:holes.reduce((sum,h)=>sum+(typeof h.par==='number'?h.par:0),0),courseRating:body.courseRating??null,slopeRating:body.slopeRating??null,totalDistance:null,distanceUnit:'m',sourceUrl,reviewedOn:today,holes} as CatalogueTee;
 try{catalogueSnapshot(course,tee);}catch{throw new AccessError('Provide 18 valid hole pars (3–6), a rating category and valid optional ratings. Do not invent missing values.',400);}
 return {course,tee};
}
export async function courseApprovalQueue(access:GolfAccess){admin(access);return withTransaction(async client=>({submissions:(await client.query(`select s.id,s.course_name as "courseName",s.tee_name as "teeName",s.snapshot,s.created_at as "createdAt",s.status,s.review_note as "reviewNote",concat_ws(' ',p.first_name,p.last_name) as "submittedBy",c.name as "clubName" from golf_course_submission s join person p on p.id=s.submitted_by join club c on c.id=s.club_id order by (s.status='pending') desc,s.created_at desc limit 200`)).rows,...await readCourseCatalogue(client)}));}
export async function reviewManualCourse(access:GolfAccess,body:Record<string,unknown>){
 admin(access);if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)||!['approve','reject'].includes(String(body.action)))throw new AccessError('Choose a course submission and decision.',400);
 const note=typeof body.note==='string'?body.note.trim():'';if(note.length>2000)throw new AccessError('Review note is too long.',400);
 return withTransaction(async client=>{
  const submission=(await client.query('select id,status from golf_course_submission where id=$1 for update',[body.id])).rows[0];
  if(!submission)throw new AccessError('Course submission not found.',404);if(submission.status!=='pending')throw new AccessError('This course has already been reviewed. Refresh the queue.',409);
  let publishedId:string|null=null;
  if(body.action==='approve'){
   if(body.existingTeeId){
    const {courses}=await readCourseCatalogue(client),existing=courses.find(c=>c.tees.some(t=>t.id===body.existingTeeId));if(!existing)throw new AccessError('Choose an active published course and tee.',400);publishedId=existing.id;
   }else{
    const {course,tee}=publicationInput(body,body.id as string);
    publishedId=(await client.query(`insert into golf_course(slug,club_name,name,location,source_url,reviewed_on) values($1,$2,$3,$4,$5,$6) returning id`,[course.slug,course.clubName,course.name,course.location,course.sourceUrl,course.reviewedOn])).rows[0].id;
    const teeId=(await client.query(`insert into golf_course_tee(course_id,slug,name,rating_category,par,course_rating,slope_rating,distance_unit,source_url,reviewed_on) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,[publishedId,tee.slug,tee.name,tee.ratingCategory,tee.par,tee.courseRating,tee.slopeRating,tee.distanceUnit,tee.sourceUrl,tee.reviewedOn])).rows[0].id;
    for(const hole of tee.holes)await client.query('insert into golf_course_hole(tee_id,number,par) values($1,$2,$3)',[teeId,hole.number,hole.par]);
   }
  }
  const status=body.action==='approve'?'approved':'rejected';
  await client.query('update golf_course_submission set status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4,published_course_id=$5,updated_at=now() where id=$1',[body.id,status,access.user.personId,note,publishedId]);
  await golfAudit(client,access.user.personId,`Manual course ${status}`,{submissionId:body.id,publishedCourseId:publishedId,note});
  return {ok:true,status};
 });
}
