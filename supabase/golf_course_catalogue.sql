-- Catalogue access is mediated by authenticated application endpoints.
create table if not exists public.golf_course (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(length(slug) between 1 and 160),
 club_name text not null check(length(club_name) between 1 and 160),
 name text not null check(length(name) between 1 and 160),
 location text not null default '',
 source_url text not null check(source_url ~ '^https?://'),
 reviewed_on date not null,
 active boolean not null default true
);
create table if not exists public.golf_course_tee (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.golf_course(id) on delete cascade,
 slug text not null check(length(slug) between 1 and 160),
 name text not null check(length(name) between 1 and 80),
 colour text not null default '',
 rating_category text not null check(rating_category in ('men','women','unisex','unspecified')),
 par integer not null check(par between 54 and 108),
 course_rating numeric check(course_rating between 40 and 100),
 slope_rating integer check(slope_rating between 55 and 155),
 total_distance integer check(total_distance between 1 and 20000),
 distance_unit text not null check(distance_unit in ('m','yd')),
 source_url text not null check(source_url ~ '^https?://'),
 reviewed_on date not null,
 active boolean not null default true,
 unique(course_id,slug)
);
create table if not exists public.golf_course_hole (
 tee_id uuid not null references public.golf_course_tee(id) on delete cascade,
 number integer not null check(number between 1 and 18),
 par integer not null check(par between 3 and 6),
 stroke_index integer check(stroke_index between 1 and 18),
 distance integer check(distance between 1 and 1500),
 primary key(tee_id,number)
);
alter table public.golf_course enable row level security;
alter table public.golf_course_tee enable row level security;
alter table public.golf_course_hole enable row level security;
revoke all on public.golf_course,public.golf_course_tee,public.golf_course_hole from public,anon,authenticated;
