-- Generated from data/golf-course-catalogue.json. Run node scripts/generate-course-seed.mjs.
-- Inserts missing catalogue entries only; preserves later administrator edits.
begin;
insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values('castle-main','Castle Golf Club','Castle Golf Club','Dublin, Ireland','https://stymie.golf/golf-courses/ireland/dublin/rathfarnham/castle-golf-club','2026-11-03') on conflict(slug) do nothing;
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'blue-men','Blue','blue','men',70,70.5,127,6221,'yd','https://stymie.golf/golf-courses/ireland/dublin/rathfarnham/castle-golf-club','2026-11-03' from public.golf_course where slug='castle-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,9,493),
 (2,4,5,432),
 (3,3,17,148),
 (4,4,15,317),
 (5,4,7,376),
 (6,4,1,414),
 (7,3,13,174),
 (8,4,11,346),
 (9,4,3,444),
 (10,3,16,184),
 (11,4,8,399),
 (12,4,10,348),
 (13,3,18,138),
 (14,4,4,390),
 (15,3,14,184),
 (16,5,6,532),
 (17,5,12,498),
 (18,4,2,404)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'white-men','White','white','men',70,69.4,123,5962,'yd','https://stymie.golf/golf-courses/ireland/dublin/rathfarnham/castle-golf-club','2026-11-03' from public.golf_course where slug='castle-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,9,483),
 (2,4,5,419),
 (3,3,17,129),
 (4,4,15,307),
 (5,4,7,361),
 (6,4,1,398),
 (7,3,13,154),
 (8,4,11,324),
 (9,4,3,432),
 (10,3,16,168),
 (11,4,8,389),
 (12,4,10,331),
 (13,3,18,119),
 (14,4,4,377),
 (15,3,14,177),
 (16,5,6,512),
 (17,5,12,484),
 (18,4,2,398)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-men','Red','red','men',70,67,121,5540,'yd','https://stymie.golf/golf-courses/ireland/dublin/rathfarnham/castle-golf-club','2026-11-03' from public.golf_course where slug='castle-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,9,425),
 (2,4,5,357),
 (3,3,17,118),
 (4,4,15,299),
 (5,4,7,317),
 (6,4,1,377),
 (7,3,13,149),
 (8,4,11,303),
 (9,4,3,416),
 (10,3,16,142),
 (11,4,8,329),
 (12,4,10,312),
 (13,3,18,114),
 (14,4,4,366),
 (15,3,14,166),
 (16,5,6,494),
 (17,5,12,463),
 (18,4,2,393)
) as h(number,par,stroke_index,distance);
insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values('grange-love','Grange Golf Club','Love Course','Dublin, Ireland','https://www.grangegolfclub.ie/the_love_course','2026-11-03') on conflict(slug) do nothing;
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'blue-men','Blue','blue','men',68,69.1,125,5829,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-love/','2026-11-03' from public.golf_course where slug='grange-love'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,3,13,136),
 (2,3,17,131),
 (3,4,1,425),
 (4,4,5,409),
 (5,4,15,322),
 (6,3,9,181),
 (7,4,3,408),
 (8,3,7,203),
 (9,4,11,366),
 (10,4,2,424),
 (11,3,8,196),
 (12,4,14,323),
 (13,4,12,320),
 (14,5,18,489),
 (15,3,16,161),
 (16,4,4,416),
 (17,5,10,521),
 (18,4,6,398)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'white-men','White','white','men',68,68.2,123,5618,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-love/','2026-11-03' from public.golf_course where slug='grange-love'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,3,13,127),
 (2,3,17,114),
 (3,4,1,412),
 (4,4,5,398),
 (5,4,15,309),
 (6,3,9,171),
 (7,4,3,404),
 (8,3,7,193),
 (9,4,11,341),
 (10,4,2,414),
 (11,3,8,185),
 (12,4,14,316),
 (13,4,12,312),
 (14,5,18,478),
 (15,3,16,153),
 (16,4,4,400),
 (17,5,10,509),
 (18,4,6,382)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-women','Red','red','women',71,72.1,124,5342,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-love/','2026-11-03' from public.golf_course where slug='grange-love'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,3,16,119),
 (2,3,18,107),
 (3,5,8,404),
 (4,4,2,378),
 (5,4,6,301),
 (6,3,10,159),
 (7,5,12,401),
 (8,3,14,183),
 (9,4,4,336),
 (10,5,9,399),
 (11,3,17,141),
 (12,4,13,293),
 (13,4,3,301),
 (14,5,11,447),
 (15,3,15,146),
 (16,4,1,390),
 (17,5,7,472),
 (18,4,5,365)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-men','Red','red','men',68,66.8,116,5342,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-love/','2026-11-03' from public.golf_course where slug='grange-love'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,3,13,119),
 (2,3,17,107),
 (3,4,1,404),
 (4,4,5,378),
 (5,4,15,301),
 (6,3,9,159),
 (7,4,3,401),
 (8,3,7,183),
 (9,4,11,336),
 (10,4,2,399),
 (11,3,8,141),
 (12,4,14,293),
 (13,4,12,301),
 (14,5,18,447),
 (15,3,16,146),
 (16,4,4,390),
 (17,5,10,472),
 (18,4,6,365)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'white-women','White','white','women',71,74,126,5618,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-love/','2026-11-03' from public.golf_course where slug='grange-love'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,3,16,127),
 (2,3,18,114),
 (3,5,8,412),
 (4,4,2,398),
 (5,4,6,309),
 (6,3,10,171),
 (7,5,12,404),
 (8,3,14,193),
 (9,4,4,341),
 (10,5,9,414),
 (11,3,17,185),
 (12,4,13,316),
 (13,4,3,312),
 (14,5,11,478),
 (15,3,15,153),
 (16,4,1,400),
 (17,5,7,509),
 (18,4,5,382)
) as h(number,par,stroke_index,distance);
insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values('grange-sheahan','Grange Golf Club','Sheahan Course','Dublin, Ireland','https://www.grangegolfclub.ie/the_sheahan_course','2026-11-03') on conflict(slug) do nothing;
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'blue-men','Blue','blue','men',71,72.2,132,6448,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-sheahan/','2026-11-03' from public.golf_course where slug='grange-sheahan'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,5,425),
 (2,4,7,409),
 (3,4,17,322),
 (4,3,13,181),
 (5,4,3,408),
 (6,5,15,474),
 (7,4,1,412),
 (8,3,9,203),
 (9,4,11,366),
 (10,4,2,424),
 (11,3,8,196),
 (12,4,14,323),
 (13,4,12,320),
 (14,5,18,489),
 (15,3,16,161),
 (16,4,4,416),
 (17,5,10,521),
 (18,4,6,398)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'white-men','White','white','men',71,71.1,131,6209,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-sheahan/','2026-11-03' from public.golf_course where slug='grange-sheahan'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,5,412),
 (2,4,7,398),
 (3,4,17,309),
 (4,3,13,171),
 (5,4,3,404),
 (6,5,15,460),
 (7,4,1,372),
 (8,3,9,193),
 (9,4,11,341),
 (10,4,2,414),
 (11,3,8,185),
 (12,4,14,316),
 (13,4,12,312),
 (14,5,18,478),
 (15,3,16,153),
 (16,4,4,400),
 (17,5,10,509),
 (18,4,6,382)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-women','Red','red','women',74,75.2,128,5881,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-sheahan/','2026-11-03' from public.golf_course where slug='grange-sheahan'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,10,404),
 (2,4,4,378),
 (3,4,8,301),
 (4,3,12,159),
 (5,5,18,401),
 (6,5,14,406),
 (7,4,2,359),
 (8,3,16,183),
 (9,4,6,336),
 (10,5,9,399),
 (11,3,17,141),
 (12,4,13,293),
 (13,4,3,301),
 (14,5,11,447),
 (15,3,15,146),
 (16,4,1,390),
 (17,5,7,472),
 (18,4,5,365)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-men','Red','red','men',71,69.4,121,5881,'m','https://golfhandicapcalculator.co/courses/grange-golf-club-sheahan/','2026-11-03' from public.golf_course where slug='grange-sheahan'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,5,404),
 (2,4,7,378),
 (3,4,17,301),
 (4,3,13,159),
 (5,4,3,401),
 (6,5,15,406),
 (7,4,1,359),
 (8,3,9,183),
 (9,4,11,336),
 (10,4,2,399),
 (11,3,8,141),
 (12,4,14,293),
 (13,4,12,301),
 (14,5,18,447),
 (15,3,16,146),
 (16,4,4,390),
 (17,5,10,472),
 (18,4,6,365)
) as h(number,par,stroke_index,distance);
insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values('grange-academy','Grange Golf Club','Academy Course','Dublin, Ireland','https://www.grangegolfclub.ie/academy_course_a4','2026-11-03') on conflict(slug) do nothing;
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'white-unspecified','White','white','unspecified',72,null,null,6012,'m','https://www.grangegolfclub.ie/academy_course_a4','2026-11-03' from public.golf_course where slug='grange-academy'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,7,498),
 (2,3,16,117),
 (3,4,1,372),
 (4,5,13,460),
 (5,4,4,371),
 (6,3,10,186),
 (7,5,8,498),
 (8,3,17,117),
 (9,4,2,372),
 (10,5,14,460),
 (11,4,5,371),
 (12,3,11,186),
 (13,5,9,498),
 (14,3,18,117),
 (15,4,3,372),
 (16,5,15,460),
 (17,4,6,371),
 (18,3,12,186)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-unspecified','Red','red','unspecified',72,null,null,5391,'m','https://www.grangegolfclub.ie/academy_course_a4','2026-11-03' from public.golf_course where slug='grange-academy'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,5,7,398),
 (2,3,16,113),
 (3,4,1,359),
 (4,5,10,406),
 (5,4,4,347),
 (6,3,13,174),
 (7,5,8,398),
 (8,3,17,113),
 (9,4,2,359),
 (10,5,11,406),
 (11,4,5,347),
 (12,3,14,174),
 (13,5,9,398),
 (14,3,18,113),
 (15,4,3,359),
 (16,5,12,406),
 (17,4,6,347),
 (18,3,15,174)
) as h(number,par,stroke_index,distance);
insert into public.golf_course(slug,club_name,name,location,source_url,reviewed_on) values('milltown-main','Milltown Golf Club','Milltown Golf Club','Dublin, Ireland','https://www.milltowngolfclub.ie/hole_9','2026-11-03') on conflict(slug) do nothing;
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'blue-men','Blue','blue','men',71,70.6,121,6230,'m','https://golfhandicapcalculator.co/courses/milltown-golf-club/','2026-11-03' from public.golf_course where slug='milltown-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,18,253),
 (2,4,10,337),
 (3,4,6,349),
 (4,3,16,131),
 (5,5,12,503),
 (6,4,4,363),
 (7,4,8,352),
 (8,4,2,401),
 (9,4,14,348),
 (10,4,5,413),
 (11,4,13,330),
 (12,3,15,150),
 (13,4,7,377),
 (14,5,17,470),
 (15,4,9,358),
 (16,3,11,197),
 (17,4,1,454),
 (18,4,3,444)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'yellow-men','Yellow','yellow','men',71,69,119,5951,'m','https://golfhandicapcalculator.co/courses/milltown-golf-club/','2026-11-03' from public.golf_course where slug='milltown-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,18,240),
 (2,4,10,323),
 (3,4,6,337),
 (4,3,16,120),
 (5,5,12,481),
 (6,4,4,352),
 (7,4,8,330),
 (8,4,2,364),
 (9,4,14,329),
 (10,4,5,401),
 (11,4,13,318),
 (12,3,15,137),
 (13,4,7,370),
 (14,5,17,465),
 (15,4,9,350),
 (16,3,11,186),
 (17,4,1,429),
 (18,4,3,419)
) as h(number,par,stroke_index,distance);
with added as (
 insert into public.golf_course_tee(course_id,slug,name,colour,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on)
 select id,'red-men','Red','red','men',71,67.8,117,5684,'m','https://golfhandicapcalculator.co/courses/milltown-golf-club/','2026-11-03' from public.golf_course where slug='milltown-main'
 on conflict(course_id,slug) do nothing returning id
) insert into public.golf_course_hole(tee_id,number,par,stroke_index,distance)
 select added.id,h.number,h.par,h.stroke_index,h.distance from added cross join (values
 (1,4,18,224),
 (2,4,10,291),
 (3,4,6,327),
 (4,3,16,116),
 (5,5,12,449),
 (6,4,4,344),
 (7,4,8,330),
 (8,4,2,332),
 (9,4,14,279),
 (10,4,5,370),
 (11,4,13,304),
 (12,3,15,126),
 (13,4,7,363),
 (14,5,17,451),
 (15,4,9,337),
 (16,3,11,166),
 (17,4,1,442),
 (18,4,3,433)
) as h(number,par,stroke_index,distance);
commit;
