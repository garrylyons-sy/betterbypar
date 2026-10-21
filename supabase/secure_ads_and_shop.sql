-- These tables are accessed through the app's authenticated server routes.
-- Direct access through Supabase's anon/authenticated Data API roles is unused.
begin;

alter table public.ads enable row level security;
alter table public.product enable row level security;
alter table public.shop_order enable row level security;
alter table public.shop_order_item enable row level security;

revoke all privileges on table
  public.ads,
  public.product,
  public.shop_order,
  public.shop_order_item
from public, anon, authenticated;

commit;
