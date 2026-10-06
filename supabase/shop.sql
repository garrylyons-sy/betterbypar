create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  description text not null,
  image_path text not null,
  price_euros numeric(8,2) not null check (price_euros >= 0),
  option_name text,
  option_values text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_name)
);

comment on table public.product is 'Small shop catalogue for Interclub Snooker products.';
comment on column public.product.image_path is 'Product image path or data URL.';
comment on column public.product.price_euros is 'Display price in euros.';
comment on column public.product.option_name is 'Optional product option label, for example Size.';
comment on column public.product.option_values is 'Selectable product option values, for example t-shirt sizes.';

alter table public.product add column if not exists option_name text;
alter table public.product add column if not exists option_values text[] not null default '{}';

create table if not exists public.shop_order (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person(id) on delete restrict,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Cancelled', 'Fulfilled')),
  total_euros numeric(8,2) not null check (total_euros >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_item (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_order(id) on delete cascade,
  product_id uuid not null references public.product(id) on delete restrict,
  product_name text not null,
  selected_option text,
  quantity integer not null check (quantity > 0),
  unit_price_euros numeric(8,2) not null check (unit_price_euros >= 0),
  line_total_euros numeric(8,2) not null check (line_total_euros >= 0),
  created_at timestamptz not null default now()
);

comment on table public.shop_order is 'Pending shop checkout records for League Chair-only products.';
comment on table public.shop_order_item is 'Line items for shop checkout records.';

insert into public.product (product_name, description, image_path, price_euros, option_name, option_values, active, sort_order)
values (
  'Foul and a Miss Tee',
  'A black Interclub Snooker tee featuring the broken-cue 404 character and a bold match-night slogan. Equal parts snooker humour and quiet protest after the shot goes wrong.',
  '/shop/foul-and-a-miss-tee.png',
  25.00,
  'Size',
  ARRAY['S', 'M', 'L', 'XL', 'XXL'],
  true,
  10
)
on conflict (product_name) do update
set description = excluded.description,
    image_path = excluded.image_path,
    price_euros = excluded.price_euros,
    option_name = excluded.option_name,
    option_values = excluded.option_values,
    active = excluded.active,
    sort_order = excluded.sort_order,
    updated_at = now();

create index if not exists product_active_sort_idx on public.product (active, sort_order, product_name);
create index if not exists shop_order_person_created_idx on public.shop_order (person_id, created_at desc);
create index if not exists shop_order_item_order_idx on public.shop_order_item (order_id);
