import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function courseSeedSql(catalogue){
 const literal=value=>value==null?'null':typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`;
 const rows=values=>values.map(literal).join(',');
 const statements=['-- Generated from data/golf-course-catalogue.json. Run node scripts/generate-course-seed.mjs.','-- Inserts missing catalogue entries only; preserves later administrator edits.','begin;'];
 for(const c of catalogue.courses){
  statements.push(`insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values(${rows([c.slug,c.clubName,c.name,c.location,c.sourceUrl,c.reviewedOn])}) on conflict(slug) do nothing;`);
  for(const t of c.tees){
   statements.push(`with added as (\n insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)\n select id,${rows([t.slug,t.name,t.colour,t.ratingCategory,t.par,t.courseRating,t.slopeRating,t.totalDistance,t.distanceUnit,t.sourceUrl,t.reviewedOn])} from public.golf_course where slug=${literal(c.slug)}\n on conflict(course_id,slug) do nothing returning id\n) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)\n select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values\n ${t.holes.map(h=>`(${rows([h.number,h.par,h.strokeIndex,h.distance])})`).join(',\n ')}\n) as h(number,par,stroke_index,distance);`);
  }
 }
 return statements.concat('commit;','').join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const data=JSON.parse(readFileSync(new URL('../data/golf-course-catalogue.json',import.meta.url),'utf8'));
 writeFileSync(new URL('../supabase/golf_course_catalogue_seed.sql',import.meta.url),courseSeedSql(data));
 console.log(`Generated ${data.courses.length} layouts and ${data.courses.reduce((n,c)=>n+c.tees.length,0)} tee scorecards.`);
}
