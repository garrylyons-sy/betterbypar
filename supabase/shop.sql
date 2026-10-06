create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  description text not null,
  image_path text not null,
  price_euros numeric(8,2) not null check (price_euros >= 0),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_name)
);

comment on table public.product is 'Small shop catalogue for Interclub Snooker products.';
comment on column public.product.image_path is 'Product image path or data URL.';
comment on column public.product.price_euros is 'Display price in euros.';

insert into public.product (product_name, description, image_path, price_euros, active, sort_order)
values (
  'Foul and a Miss Tee',
  'A black Interclub Snooker tee featuring the broken-cue 404 character and a bold match-night slogan. Equal parts snooker humour and quiet protest after the shot goes wrong.',
  '/shop/foul-and-a-miss-tee.png',
  25.00,
  true,
  10
)
on conflict (product_name) do update
set description = excluded.description,
    image_path = excluded.image_path,
    price_euros = excluded.price_euros,
    active = excluded.active,
    sort_order = excluded.sort_order,
    updated_at = now();

create index if not exists product_active_sort_idx on public.product (active, sort_order, product_name);
