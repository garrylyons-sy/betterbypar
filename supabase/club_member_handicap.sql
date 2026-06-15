alter table public.club_membership
add column if not exists handicap numeric(6,2);

alter table public.club_membership
drop constraint if exists club_membership_handicap_range;

alter table public.club_membership
add constraint club_membership_handicap_range
check (handicap is null or (handicap >= -200 and handicap <= 200));

comment on column public.club_membership.handicap is 'Club-specific handicap for internal club competitions. It is not used for interclub league fixtures, results, standings or player statistics.';
