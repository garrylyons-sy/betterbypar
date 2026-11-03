const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=()=>{throw new Error('Invalid course catalogue details.');};
const str=(v,n=200)=>typeof v==='string'&&v.length<=n?v:fail();
const num=(v,min,max,integer=false,nullable=false)=>v===null&&nullable?null:typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v))?v:fail();
export const catalogueCourseName=c=>c.name&&c.name!==c.clubName?`${c.clubName} — ${c.name}`:c.clubName;
export function normalizeCourseDetails(value){
 if(value==null)return null;const v=value;
 if(typeof v!=='object'||!uuid(v.courseId)||!uuid(v.teeId)||v.ratedHoleCount!==18||!['men','women','unisex','unspecified'].includes(v.ratingCategory)||!['m','yd'].includes(v.distanceUnit))fail();
 if(!Array.isArray(v.holes)||v.holes.length!==18)fail();
 const holes=v.holes.map(h=>({number:num(h?.number,1,18,true),par:num(h?.par,3,6,true),strokeIndex:num(h?.strokeIndex,1,18,true,true),distance:num(h?.distance,1,1500,true,true)})).sort((a,b)=>a.number-b.number);
 if(holes.some((h,i)=>h.number!==i+1))fail();
 const par=num(v.par,54,108,true);if(holes.reduce((sum,h)=>sum+h.par,0)!==par)fail();
 const sourceUrl=str(v.sourceUrl,2000);try{if(!['http:','https:'].includes(new URL(sourceUrl).protocol))fail();}catch{fail();}
 const reviewedOn=str(v.reviewedOn,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn)||!Number.isFinite(Date.parse(reviewedOn))||new Date(reviewedOn).toISOString().slice(0,10)!==reviewedOn)fail();
 return {courseId:v.courseId,teeId:v.teeId,clubName:str(v.clubName,160),courseName:str(v.courseName,160),teeName:str(v.teeName,80),ratingCategory:v.ratingCategory,par,courseRating:num(v.courseRating,40,100,false,true),slopeRating:num(v.slopeRating,55,155,true,true),totalDistance:num(v.totalDistance,1,20000,true,true),distanceUnit:v.distanceUnit,sourceUrl,reviewedOn,ratedHoleCount:18,holes};
}
export function catalogueSnapshot(course,tee){return normalizeCourseDetails({courseId:course.id,teeId:tee.id,clubName:course.clubName,courseName:course.name,teeName:tee.name,ratingCategory:tee.ratingCategory,par:tee.par,courseRating:tee.courseRating,slopeRating:tee.slopeRating,totalDistance:tee.totalDistance,distanceUnit:tee.distanceUnit,sourceUrl:tee.sourceUrl||course.sourceUrl,reviewedOn:tee.reviewedOn||course.reviewedOn,ratedHoleCount:18,holes:tee.holes});}
export function applyCatalogueTee(round,course,tee){
 if(round.imported||round.source&&round.source!=='manual')throw new Error('Imported cards keep their official course details.');
 if(round.holes.some(h=>h.status!=='not_played'||h.strokes!=null||h.putts!=null||h.penalties!=null||h.shots?.length))throw new Error('The card has already started. Keep its course layout.');
 const courseDetails=catalogueSnapshot(course,tee);
 return {...round,courseName:catalogueCourseName(course),teeName:tee.name,courseDetails,holes:round.holes.map(h=>({...h,par:courseDetails.holes.find(c=>c.number===h.number)?.par??null}))};
}
