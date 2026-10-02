-- Role-based dashboard and navigation appearance configuration.

create table if not exists public.appearance (
  id uuid primary key default gen_random_uuid(),
  role_type text not null unique check (role_type in ('Player', 'Manager', 'Club Member', 'Club Admin', 'League Chair')),
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
    '["matchPlanning","myStats","leagueTableSnapshot","teamStats","teamRecentForm","personalRecentForm","individualGames"]'::jsonb,
    '["Home","Fixtures","Table","Club"]'::jsonb
  ),
  (
    'Manager',
    '["matchPlanning","squadManagement","managerActions","seasonComplete","teamRecentForm","managerSnapshot"]'::jsonb,
    '["Home","Fixtures","Table","Club","Results"]'::jsonb
  ),
  (
    'Club Member',
    '["openCompetitions"]'::jsonb,
    '["Home","Bookings","Competitions"]'::jsonb
  ),
  (
    'Club Admin',
    '["clubCompetitionAdmin","openCompetitions","interclubLeagues"]'::jsonb,
    '["Home","Competitions","Bookings","Interclub Leagues"]'::jsonb
  ),
  (
    'League Chair',
    '["interclubLeagues"]'::jsonb,
    '["Home","Contacts","Interclub Leagues"]'::jsonb
  )
on conflict (role_type) do nothing;
