Create a clean, professional entity relationship diagram for this PostgreSQL/Supabase database.

Use these rules:
- Group tables by domain: Identity & Access, League Structure, Fixtures & Lineups, Results & Stats, Competitions, Contacts, Admin/Audit, Adverts.
- Show primary keys, foreign keys, and main unique constraints.
- Draw relationship lines using crow's-foot notation where possible.
- Make high-volume/event tables visually distinct from reference tables.
- Keep the visual readable: avoid crossing lines where possible, use muted colors, and include a small legend for enums.
- Do not invent tables or fields. Base the diagram only on the SQL below.

ENUMS

```sql
create type invitation_status as enum ('Pending', 'Accepted', 'Expired', 'Revoked');

create type membership_role as enum ('Player', 'Manager');

create type fixture_status as enum ('Scheduled', 'Completed', 'Cancelled');

create type game_type as enum ('Singles', 'Doubles');

create type invitation_request_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');

create type user_activity_type as enum ('Login', 'Page Visit', 'Advert Click');
```

TABLES

```sql
create table public.person (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text unique,
  phone text,
  profile_image text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_account (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person(id) on delete cascade,
  username text unique not null,
  password_hash text,
  google_id text unique,
  last_login timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_session (
  id text primary key,
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.app_operator (
  person_id uuid primary key references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.club_admin (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, person_id)
);

create table public.club (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  venue text,
  address text,
  logo_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true
);

create table public.club_table (
  table_id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_name text not null,
  table_description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, table_name),
  unique (table_id, club_id)
);

create table public.season (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  active boolean not null default false
);

create table public.league (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('A League', 'B League', 'C League')),
  playing_day text not null
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete restrict,
  league_id uuid not null references public.league(id) on delete restrict,
  season_id uuid not null references public.season(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (league_id, season_id, name)
);

create table public.team_membership (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  role membership_role not null,
  joined_date date not null default current_date,
  active boolean not null default true,
  unique (team_id, person_id, role)
);

create table public.club_membership (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  role text not null default 'Club Member' check (role in ('Club Member', 'Club Admin', 'League Chair')),
  joined_date date not null default current_date,
  handicap numeric(6,2),
  is_club_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint club_membership_handicap_range check (handicap is null or (handicap >= -200 and handicap <= 200)),
  unique (club_id, person_id, role)
);

create table public.person_team_role (
  id uuid primary key default gen_random_uuid(),
  club_membership_id uuid not null references public.club_membership(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  team_name text not null,
  role membership_role not null,
  joined_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (person_id, club_id, league_id, team_name, role),
  unique (club_membership_id, league_id, team_name, role)
);

create table public.contact_directory (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person(id) on delete cascade,
  contact_type text not null check (contact_type in ('League Official', 'Team Contact', 'Club Contact')),
  contact_label text not null,
  club_id uuid references public.club(id) on delete cascade,
  league_id uuid references public.league(id) on delete restrict,
  team_name text,
  phone_override text,
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, contact_type, contact_label)
);

create table public.ads (
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

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invitation_code text not null unique,
  invitation_token_hash text unique,
  invited_person_name text not null,
  invited_club_id uuid references public.club(id) on delete set null,
  invited_role membership_role not null,
  phone text,
  invite_administrator boolean not null default false,
  status invitation_status not null default 'Pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.person(id) on delete set null
);

create table public.invitation_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  role membership_role not null,
  unique (invitation_id, team_id, role)
);

create table public.invitation_club_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  role text not null default 'Club Member' check (role in ('Club Member', 'Club Admin', 'League Chair')),
  unique (invitation_id, club_id, role)
);

create table public.invitation_email (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitation(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  status text not null default 'Queued' check (status in ('Queued', 'Sent', 'Failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.password_reset_token (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.invitation_request (
  id uuid primary key default gen_random_uuid(),
  requested_person_name text not null,
  email text not null,
  club_id uuid not null references public.club(id) on delete restrict,
  team_id uuid not null references public.team(id) on delete restrict,
  requested_role membership_role not null default 'Player' check (requested_role = 'Player'),
  status invitation_request_status not null default 'Pending',
  message text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.person(id) on delete set null,
  check (position('@' in email) > 1)
);

create table public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  person_id uuid references public.person(id) on delete set null,
  activity_type user_activity_type not null,
  page_path text,
  page_label text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.table_booking (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_id uuid not null,
  person_id uuid not null references public.person(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.person(id) on delete set null,
  foreign key (table_id, club_id) references public.club_table(table_id, club_id) on delete cascade,
  check (start_time >= time '11:00' and start_time < time '23:00'),
  check (end_time = start_time + interval '1 hour'),
  check (cancelled_at is null or cancelled_by is not null)
);

create table public.competition (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.club(id) on delete cascade,
  managed_by_platform boolean not null default false,
  name text not null,
  competition_type text not null check (competition_type in ('Handicap', 'Scratch')),
  entry_closes_at date not null,
  rules text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Open', 'Drawn', 'In Progress', 'Complete')),
  round_settings_confirmed boolean not null default false,
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (managed_by_platform = true or club_id is not null)
);

create table public.competition_round (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competition(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  name text not null,
  frames_to_play integer not null default 1 check (frames_to_play > 0 and frames_to_play <= 35),
  play_by_date date not null,
  unique (competition_id, round_number)
);

create table public.competition_entry (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competition(id) on delete cascade,
  club_membership_id uuid not null references public.club_membership(id) on delete cascade,
  entered_by uuid references public.person(id) on delete set null,
  entered_at timestamptz not null default now(),
  status text not null default 'Entered' check (status in ('Entered', 'Withdrawn')),
  unique (competition_id, club_membership_id)
);

create table public.competition_match (
  id uuid primary key default gen_random_uuid(),
  competition_round_id uuid not null references public.competition_round(id) on delete cascade,
  match_number integer not null check (match_number > 0),
  player_1_entry_id uuid references public.competition_entry(id) on delete set null,
  player_2_entry_id uuid references public.competition_entry(id) on delete set null,
  player_1_score integer check (player_1_score is null or player_1_score >= 0),
  player_2_score integer check (player_2_score is null or player_2_score >= 0),
  winner_entry_id uuid references public.competition_entry(id) on delete set null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Bye', 'Completed')),
  reported_by uuid references public.person(id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competition_round_id, match_number)
);

create table public.fixture (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  fixture_date timestamptz not null,
  home_team_id uuid not null references public.team(id) on delete restrict,
  away_team_id uuid not null references public.team(id) on delete restrict,
  status fixture_status not null default 'Scheduled',
  fixture_type text not null default 'League' check (fixture_type in ('League', 'Friendly')),
  check (home_team_id <> away_team_id)
);

create table public.match (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixture(id) on delete cascade,
  home_team_score integer not null default 0 check (home_team_score between 0 and 7),
  away_team_score integer not null default 0 check (away_team_score between 0 and 7),
  entered_by uuid references public.person(id) on delete set null,
  entered_at timestamptz not null default now(),
  check (home_team_score + away_team_score <= 7)
);

create table public.fixture_week (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  week_label text not null,
  starts_on date,
  unique (season_id, league_id, week_number)
);

create table public.fixture_week_match (
  week_id uuid not null references public.fixture_week(id) on delete cascade,
  match_id uuid not null references public.match(id) on delete cascade,
  primary key (week_id, match_id),
  unique (match_id)
);

create table public.game (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  game_type game_type not null,
  game_number integer not null check (game_number between 1 and 6),
  home_player_1_id uuid references public.person(id) on delete restrict,
  home_player_2_id uuid references public.person(id) on delete restrict,
  away_player_1_id uuid references public.person(id) on delete restrict,
  away_player_2_id uuid references public.person(id) on delete restrict,
  home_player_1_guest_name text,
  home_player_2_guest_name text,
  away_player_1_guest_name text,
  away_player_2_guest_name text,
  home_player_1_is_guest boolean not null default false,
  home_player_2_is_guest boolean not null default false,
  away_player_1_is_guest boolean not null default false,
  away_player_2_is_guest boolean not null default false,
  home_player_1_counts_for_stats boolean not null default true,
  home_player_2_counts_for_stats boolean not null default true,
  away_player_1_counts_for_stats boolean not null default true,
  away_player_2_counts_for_stats boolean not null default true,
  home_score integer not null default 0,
  away_score integer not null default 0,
  winner_team_id uuid references public.team(id) on delete restrict,
  points_awarded integer not null check (points_awarded in (1, 2)),
  unique (match_id, game_number),
  constraint game_live_order_check check (
    (game_type = 'Singles' and game_number between 1 and 6 and points_awarded = 1)
    or
    (game_type = 'Doubles' and game_number in (2, 3, 4) and points_awarded = 2)
  )
);

create table public.player_game_result (
  game_id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  source_fixture_index integer,
  source_week text,
  home_team_name text,
  home_team_score integer check (home_team_score between 0 and 7),
  away_team_name text,
  away_team_score integer check (away_team_score between 0 and 7),
  game_number integer check (game_number between 1 and 6),
  game_ordinal integer check (game_ordinal between 1 and 7),
  is_doubles_partner_row boolean not null default false,
  player_1_id uuid not null references public.person(id) on delete restrict,
  player_2_id uuid not null references public.person(id) on delete restrict,
  result integer not null check (result in (0, 1)),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  check (player_1_id <> player_2_id)
);

create table public.match_lineup (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  player_id uuid not null references public.person(id) on delete cascade,
  game_number integer not null check (game_number between 1 and 6),
  created_at timestamptz not null default now(),
  unique (match_id, team_id, player_id, game_number)
);

create table public.fixture_lineup (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixture(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  submitted_by uuid references public.person(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (fixture_id, team_id)
);

create table public.fixture_lineup_slot (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.fixture_lineup(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 6),
  game_type game_type not null,
  player_1_id uuid references public.person(id) on delete restrict,
  player_2_id uuid references public.person(id) on delete restrict,
  player_1_guest_name text,
  player_2_guest_name text,
  player_1_is_guest boolean not null default false,
  player_2_is_guest boolean not null default false,
  player_1_counts_for_stats boolean not null default true,
  player_2_counts_for_stats boolean not null default true,
  unique (lineup_id, slot_number),
  check (game_type = 'Doubles' or player_2_id is null),
  check (player_1_id is null or player_1_id <> player_2_id),
  check (
    (slot_number in (2, 3, 4) and game_type = 'Doubles')
    or
    (slot_number between 1 and 6 and game_type = 'Singles')
  )
);

create table public.break (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.game(id) on delete cascade,
  season_id uuid references public.season(id) on delete cascade,
  league_id uuid references public.league(id) on delete restrict,
  player_id uuid not null references public.person(id) on delete cascade,
  break_value integer not null check (break_value between 1 and 147),
  source_label text,
  source_key text unique,
  recorded_at timestamptz not null default now(),
  check (game_id is not null or (season_id is not null and league_id is not null))
);

create table public.conversation (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.person(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_participant (
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, person_id)
);

create table public.message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  sender_person_id uuid not null references public.person(id) on delete cascade,
  message_body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
```
