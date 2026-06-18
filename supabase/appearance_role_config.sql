-- Role-based dashboard and navigation appearance configuration.

create table if not exists public.appearance (
  id uuid primary key default gen_random_uuid(),
  role_type text not null unique check (role_type in ('Player', 'Manager', 'Assistant Manager', 'Club Member', 'Club Admin')),
  panel_config jsonb not null default '[]'::jsonb,
  menu_config jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.person(id) on delete set null,
  check (jsonb_typeof(panel_config) = 'array'),
  check (jsonb_typeof(menu_config) = 'array')
);

comment on table public.appearance is 'Role-based configuration for which home panels and menu options are shown, and in what order.';
comment on column public.appearance.role_type is 'Application role this appearance row applies to.';
comment on column public.appearance.panel_config is 'Ordered array of panel identifiers for the role home screen.';
comment on column public.appearance.menu_config is 'Ordered array of menu/page identifiers visible to that role.';

create index if not exists appearance_active_idx on public.appearance (active);

insert into public.appearance (role_type, panel_config, menu_config)
values
  (
    'Player',
    '["teamStats","myStats","teamRecentForm","personalRecentForm","individualGames","memberActions"]'::jsonb,
    '["Home","Fixtures","Table","Bookings","Results","Players","Stats","Messages","Interclub Leagues"]'::jsonb
  ),
  (
    'Manager',
    '["managerActions","seasonComplete","teamRecentForm","squadManagement","managerSnapshot","memberActions"]'::jsonb,
    '["Home","Fixtures","Table","Bookings","Results","Players","Stats","Messages","Interclub Leagues"]'::jsonb
  ),
  (
    'Assistant Manager',
    '["assistantHub","seasonComplete","managerSnapshot","messages"]'::jsonb,
    '["Home","Fixtures","Table","Bookings","Results","Players","Stats","Messages","Interclub Leagues"]'::jsonb
  ),
  (
    'Club Member',
    '["openCompetitions","messages"]'::jsonb,
    '["Home","Bookings","Competitions","Messages"]'::jsonb
  ),
  (
    'Club Admin',
    '["clubCompetitionAdmin","openCompetitions","interclubLeagues","messages"]'::jsonb,
    '["Home","Bookings","Competitions","Messages","Interclub Leagues"]'::jsonb
  )
on conflict (role_type) do nothing;
