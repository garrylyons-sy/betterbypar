create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  placement text not null check (placement in ('league-chair-banner')),
  audience text not null check (audience in ('League Chair')),
  image_path text not null,
  link_url text not null,
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

create index if not exists ads_active_placement_idx
on public.ads (active, placement, audience, sort_order);

insert into public.ads (name, placement, audience, image_path, link_url, alt_text, active, sort_order)
values (
  'The Billiard Company',
  'league-chair-banner',
  'League Chair',
  '/sponsors/the-billiard-company-animated-banner.gif',
  'https://www.thebilliardcompany.ie/',
  'The Billiard Company - world class table sports',
  true,
  10
)
on conflict (placement, audience, name) do update
set image_path = excluded.image_path,
    link_url = excluded.link_url,
    alt_text = excluded.alt_text,
    active = true,
    sort_order = excluded.sort_order,
    updated_at = now();
