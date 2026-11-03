-- Club-scoped catalogue; access is exclusively through the app backend.
create table if not exists public.pro_shop_settings (
 club_id uuid primary key references public.club(id) on delete cascade,
 enabled boolean not null default false,
 title text not null default 'Pro shop' check(length(title) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 provider text not null default 'catalogue' check(provider in ('catalogue','shopify')),
 shopify_domain text not null default '' check(shopify_domain='' or shopify_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'),
 updated_at timestamptz not null default now()
);
create table if not exists public.pro_shop_product (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.club(id) on delete cascade,
 title text not null check(length(title) between 1 and 160),description text not null default '' check(length(description)<=3000),category text not null default '' check(length(category)<=80),
 image_url text not null default '' check(length(image_url)<=2048),price numeric(8,2) not null check(price>=0),purchase_url text not null default '' check(length(purchase_url)<=2048),
 available boolean not null default true,active boolean not null default true,sort_order integer not null default 0 check(sort_order between 0 and 9999),updated_at timestamptz not null default now()
);
create index if not exists pro_shop_product_club_idx on public.pro_shop_product(club_id,active,sort_order);
alter table public.pro_shop_settings enable row level security;
alter table public.pro_shop_product enable row level security;
revoke all on public.pro_shop_settings,public.pro_shop_product from public,anon,authenticated;
