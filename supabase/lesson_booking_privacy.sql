-- Member-facing booking availability is private unless the club opts in.
alter table public.club add column if not exists show_lesson_attendee_names boolean not null default false;
