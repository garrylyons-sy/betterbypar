create table if not exists public.system_settings (
  singleton boolean primary key default true check (singleton = true),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_by uuid references public.person(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.system_settings enable row level security;
revoke all on public.system_settings from anon, authenticated;
insert into public.system_settings (singleton) values (true) on conflict (singleton) do nothing;
