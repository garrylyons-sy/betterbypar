create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  placement text not null check (placement in ('league-chair-banner')),
  audience text not null check (audience in ('Everyone', 'League Chair')),
  image_path text not null,
  link_url text not null,
  affiliate_code text,
  alt_text text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement, audience, name)
);

comment on table public.ads is 'Quiet sponsor and banner placements shown to selected app audiences.';
comment on column public.ads.placement is 'Where the ad is rendered in the app.';
comment on column public.ads.audience is 'Which app audience may see the ad.';
comment on column public.ads.image_path is 'Advert image source. Prefer database-stored data:image URLs from the admin upload control.';
comment on column public.ads.affiliate_code is 'Optional affiliate code, used to add the tag parameter to Amazon advert URLs.';

create index if not exists ads_active_placement_idx
on public.ads (active, placement, audience, sort_order);
