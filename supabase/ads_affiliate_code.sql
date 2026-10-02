alter table public.ads
add column if not exists affiliate_code text;

comment on column public.ads.image_path is 'Advert image source. Prefer database-stored data:image URLs from the admin upload control.';
comment on column public.ads.affiliate_code is 'Optional affiliate code, used to add the tag parameter to Amazon advert URLs.';
