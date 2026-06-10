update public.season
set starts_on = '2025-09-01',
    ends_on = '2026-03-31'
where name = '2025/26';

update public.season
set starts_on = '2026-09-01',
    ends_on = '2027-03-31',
    active = false
where name = '2026/27';
