alter type public.user_activity_type
add value if not exists 'Advert Click';

comment on table public.user_activity_log is 'Audit log for authenticated user logins, page visits, and advert clicks.';
