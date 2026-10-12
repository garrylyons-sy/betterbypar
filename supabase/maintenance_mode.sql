create table if not exists public.maintenance_mode (
  singleton boolean primary key default true check (singleton = true),
  enabled boolean not null default false,
  updated_by uuid references public.person(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.maintenance_mode is 'Singleton global switch used to show the maintenance page and restrict sign-in to platform administrators.';

insert into public.maintenance_mode (singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;

alter table public.maintenance_mode enable row level security;
