create extension if not exists pgcrypto;

create type invitation_status as enum ('Pending', 'Accepted', 'Expired', 'Revoked');
create type membership_role as enum ('Player', 'Manager');
create type fixture_status as enum ('Scheduled', 'Completed', 'Cancelled');
create type game_type as enum ('Singles', 'Doubles');
create type invitation_request_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');
create type user_activity_type as enum ('Login', 'Page Visit', 'Advert Click', 'Match Action');

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

comment on table public.person is 'Human/player identity. Historical imports create person ids for players who appear in matches, even when they do not have app login access.';
comment on table public.user_account is 'Authentication linkage only. Rows are created when a person activates an invitation or completes the approved registration flow, not by historical match imports.';

create table public.app_session (
  id text primary key,
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index app_session_user_account_id_idx on public.app_session (user_account_id);
create index app_session_expires_at_idx on public.app_session (expires_at);

comment on table public.app_session is 'App-owned login sessions. The browser stores only this id in an HTTP-only cookie; Supabase Auth is not used for application login.';

create table public.app_operator (
  person_id uuid primary key references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.app_operator is 'Private backend/operator access for league operations such as invitations, permissions and audit logs. This is not a player or manager role.';

create table public.maintenance_mode (
  singleton boolean primary key default true check (singleton = true),
  enabled boolean not null default false,
  updated_by uuid references public.person(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.maintenance_mode is 'Singleton global switch used to show the maintenance page and restrict sign-in to platform administrators.';

insert into public.maintenance_mode (singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;

create table public.club_admin (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, person_id)
);

comment on table public.club_admin is 'Club-scoped administration permission for club competitions and club-level operations.';

create table public.club (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  venue text,
  address text,
  logo_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  allow_unlimited_lower_team_players boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index club_name_case_insensitive_idx on public.club (lower(name));

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

comment on table public.club_table is 'Snooker tables available for member booking at a club.';

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

comment on table public.club_membership is 'Club-level membership for people who can receive club messages and book club tables without belonging to a league team. Club admin is stored as a club-level capability on this row.';
comment on column public.club_membership.handicap is 'Club-specific handicap for internal club competitions. It is not used for interclub league fixtures, results, standings or player statistics.';
comment on column public.club_membership.is_club_admin is 'Whether this person can administer this club''s members, invites, competitions and table bookings.';

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

comment on table public.person_team_role is 'Season-independent team role assignments attached to a club membership. A person belongs to a club first, then has one or more player or manager roles in that club''s teams.';

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

comment on table public.contact_directory is 'Manager-facing phone directory for league officials and team contacts. The person row remains the source of truth; this table controls match-night directory visibility and labels.';

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

comment on table public.ads is 'Quiet sponsor and banner placements shown to selected app audiences.';
comment on column public.ads.placement is 'Where the ad is rendered in the app.';
comment on column public.ads.audience is 'Which app audience may see the ad.';
comment on column public.ads.image_path is 'Advert image source. Prefer database-stored data:image URLs from the admin upload control.';
comment on column public.ads.affiliate_code is 'Optional affiliate code, used to add the tag parameter to Amazon advert URLs.';

create index ads_active_placement_idx on public.ads (active, placement, audience, sort_order);

create table public.product (
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

create index product_active_sort_idx on public.product (active, sort_order, product_name);

create table public.shop_order (
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

create table public.shop_order_item (
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

create index shop_order_person_created_idx on public.shop_order (person_id, created_at desc);
create index shop_order_item_order_idx on public.shop_order_item (order_id);

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

comment on column public.invitation.invitation_token_hash is 'SHA-256 hash of the one-time activation token sent by email. The raw token is never stored.';
comment on column public.invitation.sent_at is 'When the invitation email was successfully sent by the application email provider.';

create table public.invitation_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  role membership_role not null,
  unique (invitation_id, team_id, role)
);

comment on table public.invitation_membership is 'Team-role grants attached to an account invitation. A single person can be invited as a player in one team and manager in another.';

create table public.invitation_club_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  role text not null default 'Club Member' check (role in ('Club Member', 'Club Admin', 'League Chair')),
  unique (invitation_id, club_id, role)
);

comment on table public.invitation_club_membership is 'Club-level roles attached to an account invitation, used for members who can book tables and receive club messages without a team role.';

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

create index invitation_email_invitation_idx on public.invitation_email(invitation_id);

create table public.password_reset_token (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index password_reset_token_account_idx on public.password_reset_token(user_account_id, created_at desc);
create index password_reset_token_expires_idx on public.password_reset_token(expires_at);

comment on table public.password_reset_token is 'One-time password reset tokens. Only a hash is stored; the raw token exists only in the emailed reset link.';

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

comment on table public.invitation_request is 'Public player-only invite requests. Manager invitations are handled through backend invitation membership management.';

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

create index user_activity_log_auth_user_id_created_at_idx on public.user_activity_log (auth_user_id, created_at desc);
create index user_activity_log_person_id_created_at_idx on public.user_activity_log (person_id, created_at desc);

comment on table public.user_activity_log is 'Audit log for authenticated user logins and page visits.';

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

create unique index table_booking_active_slot_idx
on public.table_booking (table_id, booking_date, start_time)
where cancelled_at is null;

create index table_booking_club_date_idx on public.table_booking (club_id, booking_date, start_time);
create index table_booking_person_date_idx on public.table_booking (person_id, booking_date desc);

comment on table public.table_booking is 'One-hour member snooker table bookings. Active bookings are unique per table, date and start time.';

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
  original_fixture_date timestamptz,
  home_team_id uuid not null references public.team(id) on delete restrict,
  away_team_id uuid not null references public.team(id) on delete restrict,
  status fixture_status not null default 'Scheduled',
  fixture_type text not null default 'League' check (fixture_type in ('League', 'Friendly')),
  check (home_team_id <> away_team_id)
);

comment on column public.fixture.original_fixture_date is 'The first scheduled date, retained when fixture_date changes after a postponement.';

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

comment on table public.fixture_week is 'League fixture round/week grouping. One week can contain multiple matches for the same league and season.';
comment on table public.fixture_week_match is 'Join table linking a fixture week to the matches played in that week.';

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

comment on table public.game is 'Each row is one snooker frame. Singles frames award 1 league point to the frame winner; the doubles frame awards 2 league points to the frame winner.';
comment on column public.game.home_score is 'Snooker points scored by the home side/player(s) in this single frame.';
comment on column public.game.away_score is 'Snooker points scored by the away side/player(s) in this single frame.';
comment on column public.game.points_awarded is 'League points awarded for winning this frame: 1 for singles, 2 for doubles.';

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

create index player_game_result_player_1_id_idx on public.player_game_result (player_1_id);
create index player_game_result_player_2_id_idx on public.player_game_result (player_2_id);
create index player_game_result_season_league_idx on public.player_game_result (season_id, league_id);

comment on table public.player_game_result is 'One imported player-v-player game result. result is from player_1_id perspective: 1 = player_1 won, 0 = player_1 lost.';
comment on column public.player_game_result.game_id is 'Unique imported game id for a single player-v-player result row.';
comment on column public.player_game_result.player_1_id is 'First player in the source row. The result column belongs to this player.';
comment on column public.player_game_result.player_2_id is 'Opponent player in the source row.';
comment on column public.player_game_result.result is 'Player 1 result: 1 means player_1_id won; 0 means player_1_id lost.';

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

create index fixture_lineup_fixture_idx on public.fixture_lineup(fixture_id);
create index fixture_lineup_team_idx on public.fixture_lineup(team_id);

comment on table public.fixture_lineup is 'Manager lineup for a fixture. Draft lineups are private; Published lineups can be paired into generated games.';
comment on table public.fixture_lineup_slot is 'Six ordered lineup slots: singles 1, singles 2, doubles 3, singles 4, singles 5, singles 6.';

create table public.last_man_standing_competition (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete restrict,
  name text not null,
  audience text not null default 'League Chair' check (audience in ('League Chair', 'Everyone')),
  entry_opens_at timestamptz not null,
  entry_closes_at timestamptz not null,
  status text not null default 'Draft' check (status in ('Draft', 'Open', 'In Progress', 'Complete', 'No Winner', 'Archived')),
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_closes_at > entry_opens_at),
  unique (season_id, name)
);

create table public.last_man_standing_round (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  cycle_number integer not null default 1 check (cycle_number > 0),
  round_number integer not null check (round_number > 0),
  name text not null,
  status text not null default 'Planned' check (status in ('Planned', 'Open', 'Locked', 'Needs Review', 'Settled')),
  deciding_round boolean not null default false,
  opened_at timestamptz,
  locked_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, cycle_number, round_number)
);

create table public.last_man_standing_round_schedule (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.last_man_standing_round(id) on delete cascade,
  tier text not null check (tier in ('A', 'B', 'C')),
  league_id uuid not null references public.league(id) on delete restrict,
  fixture_week_id uuid not null references public.fixture_week(id) on delete restrict,
  default_match_date date not null,
  deadline_time time not null default '12:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, tier)
);

create table public.last_man_standing_entry (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete restrict,
  source_role text not null check (source_role in ('Player', 'Manager', 'Club Member')),
  tier text not null check (tier in ('A', 'B', 'C')),
  source_team_id uuid not null references public.team(id) on delete restrict,
  status text not null default 'Entered' check (status in ('Entered', 'Standing', 'Eliminated', 'Withdrawn', 'Winner')),
  entered_at timestamptz not null default now(),
  eliminated_round_id uuid references public.last_man_standing_round(id) on delete set null,
  winner boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (competition_id, person_id)
);

create table public.last_man_standing_team_order_snapshot (
  id uuid primary key default gen_random_uuid(),
  round_schedule_id uuid not null references public.last_man_standing_round_schedule(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete restrict,
  position integer not null check (position > 0),
  captured_at timestamptz not null default now(),
  unique (round_schedule_id, team_id),
  unique (round_schedule_id, position)
);

create table public.last_man_standing_pick (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.last_man_standing_entry(id) on delete cascade,
  round_id uuid not null references public.last_man_standing_round(id) on delete cascade,
  slot_number integer not null check (slot_number in (1, 2)),
  selected_player_id uuid references public.person(id) on delete restrict,
  effective_player_id uuid references public.person(id) on delete restrict,
  source_fixture_id uuid references public.fixture(id) on delete restrict,
  source_game_id uuid references public.game(id) on delete restrict,
  source_lineup_slot_id uuid references public.fixture_lineup_slot(id) on delete restrict,
  state text not null default 'Draft' check (state in ('Draft', 'Locked', 'Automatic', 'Needs Review', 'Settled')),
  automatic_reason text,
  outcome text not null default 'Pending' check (outcome in ('Pending', 'Won', 'Lost', 'No Eligible Pick')),
  table_order_snapshot jsonb not null default '[]'::jsonb,
  deadline_at timestamptz,
  locked_at timestamptz,
  settled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, round_id, slot_number),
  check (
    selected_player_id is null
    or effective_player_id is null
    or selected_player_id = effective_player_id
    or automatic_reason is not null
  )
);

create table public.last_man_standing_event (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.last_man_standing_competition(id) on delete cascade,
  entry_id uuid references public.last_man_standing_entry(id) on delete cascade,
  round_id uuid references public.last_man_standing_round(id) on delete cascade,
  pick_id uuid references public.last_man_standing_pick(id) on delete cascade,
  actor_person_id uuid references public.person(id) on delete set null,
  event_type text not null check (event_type in ('Entry Created', 'Entry Withdrawn', 'Pick Saved', 'Pick Locked', 'Automatic Pick', 'Needs Review', 'Pick Settled', 'Entry Eliminated', 'Winner Declared', 'Round Reopened', 'Entrants Reinstated', 'Admin Override')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index last_man_standing_competition_status_idx
  on public.last_man_standing_competition (status, season_id);
create index last_man_standing_round_status_idx
  on public.last_man_standing_round (competition_id, status, cycle_number, round_number);
create index last_man_standing_entry_active_idx
  on public.last_man_standing_entry (competition_id, status)
  where status in ('Entered', 'Standing');
create index last_man_standing_pick_effective_player_idx
  on public.last_man_standing_pick (effective_player_id, round_id)
  where effective_player_id is not null;
create index last_man_standing_pick_state_idx
  on public.last_man_standing_pick (round_id, state, outcome);
create index last_man_standing_event_competition_idx
  on public.last_man_standing_event (competition_id, created_at desc);

create or replace function public.prevent_last_man_standing_event_change()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Last Man Standing events are immutable';
end;
$$;

create trigger last_man_standing_event_immutable
before update or delete on public.last_man_standing_event
for each row execute function public.prevent_last_man_standing_event_change();

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

comment on table public.break is 'Individual player breaks. Live scoring rows link to a game; historical imports without frame detail link to a season and league with a source key.';
comment on column public.break.game_id is 'Set when the exact frame/game is known.';
comment on column public.break.season_id is 'Set for imported historical breaks when the exact game is unknown.';
comment on column public.break.league_id is 'Set for imported historical breaks when the exact game is unknown.';
comment on column public.break.source_key is 'Stable idempotency key for imported break rows.';

create table public.live_frame_session (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixture(id) on delete cascade,
  game_id uuid not null references public.game(id) on delete cascade,
  status text not null default 'Live' check (status in ('Live', 'Paused', 'Completed', 'Abandoned')),
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  active_team_id uuid references public.team(id) on delete set null,
  active_player_id uuid references public.person(id) on delete set null,
  current_break integer not null default 0 check (current_break >= 0),
  reds_remaining integer not null default 15 check (reds_remaining between 0 and 15),
  phase text not null default 'reds' check (phase in ('reds', 'colours', 'respotted-black')),
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  scorer_person_id uuid references public.person(id) on delete set null,
  lease_expires_at timestamptz,
  started_by uuid references public.person(id) on delete set null,
  updated_by uuid references public.person(id) on delete set null,
  completed_by uuid references public.person(id) on delete set null,
  abandoned_by uuid references public.person(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  superseded_at timestamptz,
  superseded_by uuid references public.person(id) on delete set null
);

create unique index live_frame_session_one_active_game_idx
  on public.live_frame_session (game_id)
  where status in ('Live', 'Paused');

create index live_frame_session_fixture_idx
  on public.live_frame_session (fixture_id, updated_at desc);

create table public.live_frame_event (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_frame_session(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (event_type in ('Start', 'Pot', 'Foul', 'EndVisit', 'SelectPlayer', 'CorrectBalls', 'ResetFrame', 'Undo', 'Takeover', 'Pause', 'Resume', 'Complete', 'Abandon')),
  team_id uuid references public.team(id) on delete set null,
  player_id uuid references public.person(id) on delete set null,
  ball_value integer check (ball_value between 1 and 7),
  points integer check (points >= 0),
  state_before jsonb,
  state_after jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create index live_frame_event_session_idx
  on public.live_frame_event (session_id, sequence_number);

create or replace function public.reject_live_frame_event_mutation()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'Live frame events are immutable';
end;
$$;

create trigger live_frame_event_immutable
before update or delete on public.live_frame_event
for each row execute function public.reject_live_frame_event_mutation();

alter table public.live_frame_session replica identity full;
alter table public.live_frame_event replica identity full;

comment on table public.live_frame_session is 'League Chair live-scoring snapshot. Provisional totals become official only when the frame is completed.';
comment on table public.live_frame_event is 'Immutable ordered audit stream for a League Chair live-scoring session.';

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

create or replace view public.match_points_view as
select
  m.id as match_id,
  f.id as fixture_id,
  f.season_id,
  f.league_id,
  f.home_team_id,
  f.away_team_id,
  case
    when count(g.id) = 0 then m.home_team_score
    else coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.home_team_id), 0)
  end as home_team_points,
  case
    when count(g.id) = 0 then m.away_team_score
    else coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.away_team_id), 0)
  end as away_team_points
from public.match m
join public.fixture f on f.id = m.fixture_id
left join public.game g on g.match_id = m.id
where coalesce(f.fixture_type, 'League') = 'League'
  and (
    f.status = 'Completed'
    or exists (
    select 1
    from public.game active_game
    where active_game.match_id = m.id
      and active_game.winner_team_id is not null
    )
  )
group by m.id, f.id, f.season_id, f.league_id, f.home_team_id, f.away_team_id;

create or replace function public.refresh_match_team_points(match_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  home_points integer;
  away_points integer;
begin
  select
    coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.home_team_id), 0),
    coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.away_team_id), 0)
  into home_points, away_points
  from public.match m
  join public.fixture f on f.id = m.fixture_id
  left join public.game g on g.match_id = m.id
  where m.id = match_uuid
  group by m.id;

  update public.match
  set home_team_score = coalesce(home_points, 0),
      away_team_score = coalesce(away_points, 0)
  where id = match_uuid;
end;
$$;

create or replace function public.refresh_match_team_points_from_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_match_team_points(old.match_id);
    return old;
  end if;

  perform public.refresh_match_team_points(new.match_id);

  if tg_op = 'UPDATE' and old.match_id <> new.match_id then
    perform public.refresh_match_team_points(old.match_id);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_match_team_points_after_game_change on public.game;

create trigger refresh_match_team_points_after_game_change
after insert or update or delete on public.game
for each row execute function public.refresh_match_team_points_from_game();

create or replace view public.league_table_view as
with team_stats as (
  select
    t.id as team_id,
    t.name as team_name,
    t.league_id,
    t.season_id,
    count(mp.match_id) filter (where completed_fixture.status = 'Completed') as matches_played,
    coalesce(sum(case when completed_fixture.status = 'Completed' and mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when completed_fixture.status = 'Completed' and mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_won,
    coalesce(sum(case when completed_fixture.status = 'Completed' and mp.home_team_points < mp.away_team_points and mp.home_team_id = t.id then 1 when completed_fixture.status = 'Completed' and mp.away_team_points < mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_lost,
    coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as points_for,
    coalesce(sum(case when mp.home_team_id = t.id then mp.away_team_points when mp.away_team_id = t.id then mp.home_team_points else 0 end), 0) as points_against,
    coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as league_points
  from public.team t
  left join public.match_points_view mp on mp.home_team_id = t.id or mp.away_team_id = t.id
  left join public.fixture completed_fixture on completed_fixture.id = mp.fixture_id
  where t.active = true
  group by t.id, t.name, t.league_id, t.season_id
),
head_to_head as (
  select
    ts.team_id,
    coalesce(sum(case when mp.home_team_id = ts.team_id then mp.home_team_points when mp.away_team_id = ts.team_id then mp.away_team_points else 0 end), 0) as head_to_head_points
  from team_stats ts
  left join team_stats tied_team
    on tied_team.league_id = ts.league_id
   and tied_team.season_id = ts.season_id
   and tied_team.league_points = ts.league_points
   and tied_team.team_id <> ts.team_id
  left join public.match_points_view mp
    on ((mp.home_team_id = ts.team_id and mp.away_team_id = tied_team.team_id)
     or (mp.away_team_id = ts.team_id and mp.home_team_id = tied_team.team_id))
  group by ts.team_id
)
select
  row_number() over (
    partition by ts.league_id, ts.season_id
    order by
      ts.league_points desc,
      hth.head_to_head_points desc,
      (ts.points_for - ts.points_against) desc,
      ts.matches_won desc,
      ts.team_name asc
  ) as position,
  ts.team_id,
  ts.league_id,
  ts.season_id,
  ts.matches_played,
  ts.matches_won,
  ts.matches_lost,
  ts.points_for,
  ts.points_against,
  ts.league_points
from team_stats ts
join head_to_head hth on hth.team_id = ts.team_id;

create or replace view public.player_statistics as
with appearances as (
  select
    g.id as game_id,
    player_appearance.person_id,
    player_appearance.team_id,
    g.winner_team_id
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  cross join lateral (
    values
      (g.home_player_1_id, f.home_team_id),
      (g.home_player_2_id, f.home_team_id),
      (g.away_player_1_id, f.away_team_id),
      (g.away_player_2_id, f.away_team_id)
  ) as player_appearance(person_id, team_id)
  where g.winner_team_id is not null
    and coalesce(f.fixture_type, 'League') = 'League'
    and player_appearance.person_id is not null
),
break_values as (
  select b.*
  from public.break b
  left join public.game g on g.id = b.game_id
  left join public.match m on m.id = g.match_id
  left join public.fixture f on f.id = m.fixture_id
  where f.id is null or coalesce(f.fixture_type, 'League') = 'League'
)
select
  p.id as person_id,
  count(distinct a.game_id) as games_played,
  count(distinct a.game_id) filter (where a.team_id = a.winner_team_id) as games_won,
  max(b.break_value) as highest_break,
  count(distinct b.id) as total_breaks,
  count(distinct b.id) filter (where b.break_value >= 50) as fifty_plus_breaks,
  count(distinct b.id) filter (where b.break_value >= 100) as century_breaks
from public.person p
left join appearances a on a.person_id = p.id
left join break_values b on b.player_id = p.id
group by p.id;

create or replace view public.player_break_leaderboard_view as
select
  row_number() over (
    partition by coalesce(b.season_id, f.season_id), coalesce(b.league_id, f.league_id)
    order by b.break_value desc, p.last_name, p.first_name, b.recorded_at
  ) as position,
  b.id as break_id,
  coalesce(b.season_id, f.season_id) as season_id,
  s.name as season_name,
  coalesce(b.league_id, f.league_id) as league_id,
  l.name as league_name,
  b.player_id,
  p.first_name,
  p.last_name,
  b.break_value,
  b.game_id,
  b.source_label,
  b.recorded_at
from public.break b
join public.person p on p.id = b.player_id
left join public.game g on g.id = b.game_id
left join public.match m on m.id = g.match_id
left join public.fixture f on f.id = m.fixture_id
left join public.season s on s.id = coalesce(b.season_id, f.season_id)
left join public.league l on l.id = coalesce(b.league_id, f.league_id)
where f.id is null or coalesce(f.fixture_type, 'League') = 'League';

create or replace view public.player_game_result_view
with (security_invoker = true) as
select
  result_source.game_id,
  result_source.season_id,
  s.name as season_name,
  result_source.league_id,
  l.name as league_name,
  result_source.source_fixture_index,
  result_source.source_week,
  result_source.home_team_name,
  result_source.home_team_score,
  result_source.away_team_name,
  result_source.away_team_score,
  result_source.game_number,
  result_source.game_ordinal,
  result_source.is_doubles_partner_row,
  result_source.player_1_id,
  p1.first_name || ' ' || p1.last_name as player_1_name,
  result_source.player_2_id,
  p2.first_name || ' ' || p2.last_name as player_2_name,
  result_source.result,
  case when result_source.result = 1 then result_source.player_1_id else result_source.player_2_id end as winner_player_id,
  case when result_source.result = 1 then result_source.player_2_id else result_source.player_1_id end as loser_player_id,
  case when result_source.result = 1 then p1.first_name || ' ' || p1.last_name else p2.first_name || ' ' || p2.last_name end as winner_name,
  case when result_source.result = 1 then p2.first_name || ' ' || p2.last_name else p1.first_name || ' ' || p1.last_name end as loser_name,
  result_source.source_key
from (
  select
    pgr.game_id,
    pgr.season_id,
    pgr.league_id,
    pgr.source_fixture_index,
    pgr.source_week,
    pgr.home_team_name,
    pgr.home_team_score,
    pgr.away_team_name,
    pgr.away_team_score,
    pgr.game_number,
    pgr.game_ordinal,
    pgr.is_doubles_partner_row,
    pgr.player_1_id,
    pgr.player_2_id,
    pgr.result,
    pgr.source_key
  from public.player_game_result pgr
  union all
  select
    g.id as game_id,
    f.season_id,
    f.league_id,
    null::integer as source_fixture_index,
    coalesce(fw.week_label, to_char(f.fixture_date, 'DD Mon YYYY')) as source_week,
    ht.name as home_team_name,
    m.home_team_score,
    at.name as away_team_name,
    m.away_team_score,
    g.game_number,
    g.game_number as game_ordinal,
    false as is_doubles_partner_row,
    player_pair.player_1_id,
    player_pair.player_2_id,
    case when player_pair.player_1_team_id = g.winner_team_id then 1 else 0 end as result,
    'live-' || g.id::text || '-' || player_pair.player_1_id::text || '-' || player_pair.player_2_id::text as source_key
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  join public.team ht on ht.id = f.home_team_id
  join public.team at on at.id = f.away_team_id
  left join public.fixture_week_match fwm on fwm.match_id = m.id
  left join public.fixture_week fw on fw.id = fwm.week_id
  cross join lateral (
    values
      (g.home_player_1_id, g.away_player_1_id, f.home_team_id),
      (g.home_player_2_id, g.away_player_2_id, f.home_team_id),
      (g.away_player_1_id, g.home_player_1_id, f.away_team_id),
      (g.away_player_2_id, g.home_player_2_id, f.away_team_id)
  ) as player_pair(player_1_id, player_2_id, player_1_team_id)
  where g.winner_team_id is not null
    and coalesce(f.fixture_type, 'League') = 'League'
    and player_pair.player_1_id is not null
    and player_pair.player_2_id is not null
    and not exists (
      select 1
      from public.player_game_result imported
      where imported.game_id = g.id
    )
) result_source
join public.season s on s.id = result_source.season_id
join public.league l on l.id = result_source.league_id
join public.person p1 on p1.id = result_source.player_1_id
join public.person p2 on p2.id = result_source.player_2_id;

create or replace view public.club_team_structure_view as
select
  c.id as club_id,
  c.name as club_name,
  s.id as season_id,
  s.name as season_name,
  count(t.id) as team_count,
  array_agg(t.name order by l.name, t.name) filter (where t.id is not null) as teams,
  array_agg(l.name order by l.name, t.name) filter (where t.id is not null) as leagues
from public.club c
cross join public.season s
left join public.team t on t.club_id = c.id and t.season_id = s.id and t.active = true
left join public.league l on l.id = t.league_id
where c.active = true
group by c.id, c.name, s.id, s.name;

create or replace view public.user_team_context_view
with (security_invoker = true) as
select
  ua.id as auth_user_id,
  p.id as person_id,
  p.first_name,
  p.last_name,
  ua.username,
  ptr.id as membership_id,
  ptr.role,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  c.logo_path,
  c.primary_color,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name,
  c.accent_color
from public.user_account ua
join public.person p on p.id = ua.person_id
join public.club_membership cm on cm.person_id = p.id and cm.active = true
join public.person_team_role ptr on ptr.club_membership_id = cm.id and ptr.active = true
join public.team t
  on t.club_id = cm.club_id
 and t.league_id = ptr.league_id
 and t.name = ptr.team_name
 and t.active = true
join public.club c on c.id = cm.club_id and c.active = true
join public.league l on l.id = t.league_id
join public.season s on s.id = t.season_id
where ua.active = true;

create or replace view public.membership_management_view as
select
  p.id as person_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.active as person_active,
  ptr.id as membership_id,
  ptr.role,
  ptr.joined_date,
  ptr.active as membership_active,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name
from public.person p
left join public.club_membership cm on cm.person_id = p.id
left join public.person_team_role ptr on ptr.club_membership_id = cm.id
left join public.team t
  on t.club_id = cm.club_id
 and t.league_id = ptr.league_id
 and t.name = ptr.team_name
left join public.club c on c.id = cm.club_id
left join public.league l on l.id = t.league_id
left join public.season s on s.id = t.season_id;

comment on view public.membership_management_view is 'Backend management view for people and their club-parented Player and Manager team roles, projected onto available season teams.';

create or replace function public.resolve_login_identifier(login_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when position('@' in login_identifier) > 1 then lower(trim(login_identifier))
    else (
      select lower(p.email)
      from public.user_account ua
      join public.person p on p.id = ua.person_id
      where lower(ua.username) = lower(trim(login_identifier))
        and ua.active = true
        and p.active = true
      limit 1
    )
  end
$$;

create or replace function public.accept_invitation_for_current_user(invitation_code_input text, username_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation_record public.invitation%rowtype;
  target_person_id uuid;
  first_name_input text;
  last_name_input text;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in before activating an invitation.';
  end if;

  if trim(coalesce(username_input, '')) = '' then
    raise exception 'User ID is required.';
  end if;

  select *
  into invitation_record
  from public.invitation
  where invitation_code = trim(invitation_code_input)
  for update;

  if not found then
    raise exception 'Invitation code not found.';
  end if;

  if invitation_record.status <> 'Pending' then
    raise exception 'Invitation is not pending.';
  end if;

  if invitation_record.expires_at <= now() then
    update public.invitation
    set status = 'Expired'
    where id = invitation_record.id;
    raise exception 'Invitation has expired.';
  end if;

  if current_email = '' or lower(invitation_record.email) <> current_email then
    raise exception 'Signed-in email does not match this invitation.';
  end if;

  if not exists (
    select 1
    from public.invitation_membership
    where invitation_id = invitation_record.id
  ) then
    raise exception 'Invitation has no team role attached.';
  end if;

  if exists (
    select 1
    from public.user_account
    where lower(username) = lower(trim(username_input))
      and id <> current_auth_user
  ) then
    raise exception 'User ID is already taken.';
  end if;

  first_name_input := split_part(trim(invitation_record.invited_person_name), ' ', 1);
  last_name_input := nullif(trim(substr(trim(invitation_record.invited_person_name), length(first_name_input) + 1)), '');

  select id
  into target_person_id
  from public.person
  where lower(email) = current_email
  limit 1;

  if target_person_id is null then
    select id
    into target_person_id
    from public.person
    where email is null
      and lower(first_name) = lower(first_name_input)
      and lower(last_name) = lower(coalesce(last_name_input, ''))
    limit 1;
  end if;

  if target_person_id is null then
    insert into public.person (first_name, last_name, email, active)
    values (first_name_input, coalesce(last_name_input, ''), current_email, true)
    returning id into target_person_id;
  else
    update public.person
    set email = coalesce(email, current_email),
        active = true
    where id = target_person_id;
  end if;

  insert into public.user_account (id, person_id, username, last_login, active)
  values (current_auth_user, target_person_id, trim(username_input), now(), true)
  on conflict (id) do update
  set person_id = excluded.person_id,
      username = excluded.username,
      last_login = now(),
      active = true;

  with team_roles as (
    select t.club_id, t.league_id, t.name as team_name, im.role
    from public.invitation_membership im
    join public.team t on t.id = im.team_id
    where im.invitation_id = invitation_record.id
  ),
  club_members as (
    insert into public.club_membership (club_id, person_id, role, active)
    select distinct club_id, target_person_id, 'Club Member', true
    from team_roles
    on conflict (club_id, person_id, role) do update
    set active = true
    returning id, club_id
  )
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select cm.id, target_person_id, tr.club_id, tr.league_id, tr.team_name, tr.role, true
  from team_roles tr
  join club_members cm on cm.club_id = tr.club_id
  on conflict (club_membership_id, league_id, team_name, role) do update
  set active = true;

  insert into public.team_membership (team_id, person_id, role, active)
  select im.team_id, target_person_id, im.role, true
  from public.invitation_membership im
  where im.invitation_id = invitation_record.id
  on conflict (team_id, person_id, role) do update
  set active = true;

  update public.invitation
  set status = 'Accepted',
      accepted_at = now()
  where id = invitation_record.id;

  return target_person_id;
end;
$$;

create or replace function public.accept_pending_invitation_for_current_user(username_input text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation_record public.invitation%rowtype;
  base_username text;
  next_username text;
  suffix_number integer := 1;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in before activating an invitation.';
  end if;

  if current_email = '' then
    return null;
  end if;

  select *
  into invitation_record
  from public.invitation
  where lower(email) = current_email
    and status = 'Pending'
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  if invitation_record.expires_at <= now() then
    update public.invitation
    set status = 'Expired'
    where id = invitation_record.id;
    return null;
  end if;

  base_username := lower(regexp_replace(coalesce(nullif(trim(username_input), ''), split_part(current_email, '@', 1)), '[^a-z0-9_]+', '', 'g'));

  if base_username = '' then
    base_username := 'player';
  end if;

  next_username := base_username;

  while exists (
    select 1
    from public.user_account
    where lower(username) = lower(next_username)
      and id <> current_auth_user
  ) loop
    suffix_number := suffix_number + 1;
    next_username := left(base_username, 20) || '_' || suffix_number::text;
  end loop;

  return public.accept_invitation_for_current_user(invitation_record.invitation_code, next_username);
end;
$$;

create or replace function public.player_invite_team_options()
returns table (
  club_id uuid,
  club_name text,
  team_id uuid,
  team_name text,
  league_name text,
  season_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name as club_name,
    t.id as team_id,
    t.name as team_name,
    l.name as league_name,
    s.name as season_name
  from public.team t
  join public.club c on c.id = t.club_id
  join public.league l on l.id = t.league_id
  join public.season s on s.id = t.season_id
  where t.active = true
    and c.active = true
    and s.active = true
  order by c.name, l.name, t.name;
$$;

create or replace function public.request_player_invitation(
  requested_person_name_input text,
  email_input text,
  team_id_input uuid,
  message_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  target_club_id uuid;
begin
  if trim(coalesce(requested_person_name_input, '')) = '' then
    raise exception 'Name is required.';
  end if;

  if position('@' in coalesce(email_input, '')) <= 1 then
    raise exception 'A valid email is required.';
  end if;

  select club_id
  into target_club_id
  from public.team
  where id = team_id_input
    and active = true;

  if target_club_id is null then
    raise exception 'Team not found.';
  end if;

  insert into public.invitation_request (
    requested_person_name,
    email,
    club_id,
    team_id,
    requested_role,
    message
  )
  values (
    trim(requested_person_name_input),
    lower(trim(email_input)),
    target_club_id,
    team_id_input,
    'Player',
    nullif(trim(coalesce(message_input, '')), '')
  )
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.record_user_login(user_agent_input text default null, metadata_input jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_person_id uuid;
  log_id uuid;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in to record activity.';
  end if;

  select person_id
  into current_person_id
  from public.user_account
  where id = current_auth_user
    and active = true;

  update public.user_account
  set last_login = now()
  where id = current_auth_user;

  insert into public.user_activity_log (
    auth_user_id,
    person_id,
    activity_type,
    page_path,
    page_label,
    user_agent,
    metadata
  )
  values (
    current_auth_user,
    current_person_id,
    'Login',
    null,
    null,
    user_agent_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.record_page_visit(
  page_path_input text,
  page_label_input text default null,
  user_agent_input text default null,
  metadata_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_person_id uuid;
  log_id uuid;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in to record activity.';
  end if;

  select person_id
  into current_person_id
  from public.user_account
  where id = current_auth_user
    and active = true;

  insert into public.user_activity_log (
    auth_user_id,
    person_id,
    activity_type,
    page_path,
    page_label,
    user_agent,
    metadata
  )
  values (
    current_auth_user,
    current_person_id,
    'Page Visit',
    left(trim(coalesce(page_path_input, '/')), 500),
    nullif(left(trim(coalesce(page_label_input, '')), 120), ''),
    user_agent_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.operator_create_invitation(
  email_input text,
  invited_person_name_input text,
  expires_at_input timestamptz,
  memberships_input jsonb
)
returns table (invitation_id uuid, invitation_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_person_id uuid := public.current_person_id();
  new_invitation_id uuid;
  new_code text;
  membership_item jsonb;
  membership_team_id uuid;
  membership_role membership_role;
  invited_club uuid;
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  if position('@' in coalesce(email_input, '')) <= 1 then
    raise exception 'A valid email is required.';
  end if;

  if trim(coalesce(invited_person_name_input, '')) = '' then
    raise exception 'Invited person name is required.';
  end if;

  if jsonb_typeof(memberships_input) <> 'array' or jsonb_array_length(memberships_input) = 0 then
    raise exception 'At least one team role is required.';
  end if;

  select t.club_id
  into invited_club
  from jsonb_array_elements(memberships_input) item
  join public.team t on t.id = (item ->> 'team_id')::uuid
  limit 1;

  loop
    new_code := upper(encode(gen_random_bytes(5), 'hex'));
    exit when not exists (select 1 from public.invitation where invitation_code = new_code);
  end loop;

  insert into public.invitation (
    email,
    invitation_code,
    invited_person_name,
    invited_club_id,
    invited_role,
    expires_at,
    created_by
  )
  values (
    lower(trim(email_input)),
    new_code,
    trim(invited_person_name_input),
    invited_club,
    coalesce((memberships_input -> 0 ->> 'role')::membership_role, 'Player'),
    coalesce(expires_at_input, now() + interval '30 days'),
    operator_person_id
  )
  returning id into new_invitation_id;

  for membership_item in select * from jsonb_array_elements(memberships_input)
  loop
    membership_team_id := (membership_item ->> 'team_id')::uuid;
    membership_role := (membership_item ->> 'role')::membership_role;

    if membership_role not in ('Player', 'Manager') then
      raise exception 'Invalid membership role.';
    end if;

    insert into public.invitation_membership (invitation_id, team_id, role)
    values (new_invitation_id, membership_team_id, membership_role)
    on conflict (invitation_id, team_id, role) do nothing;
  end loop;

  invitation_id := new_invitation_id;
  invitation_code := new_code;
  return next;
end;
$$;

create or replace function public.operator_set_team_membership(
  person_id_input uuid,
  team_id_input uuid,
  role_input membership_role,
  active_input boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_id uuid;
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  with team_scope as (
    select club_id, league_id, name as team_name
    from public.team
    where id = team_id_input
  ),
  club_member as (
    insert into public.club_membership (club_id, person_id, role, active)
    select club_id, person_id_input, 'Club Member', true
    from team_scope
    on conflict (club_id, person_id, role) do update
    set active = true
    returning id, club_id
  )
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select cm.id, person_id_input, ts.club_id, ts.league_id, ts.team_name, role_input, coalesce(active_input, true)
  from team_scope ts
  join club_member cm on cm.club_id = ts.club_id
  on conflict (club_membership_id, league_id, team_name, role) do update
  set active = excluded.active;

  insert into public.team_membership (person_id, team_id, role, active)
  values (person_id_input, team_id_input, role_input, coalesce(active_input, true))
  on conflict (team_id, person_id, role) do update
  set active = excluded.active
  returning id into membership_id;

  return membership_id;
end;
$$;

create or replace function public.operator_update_invitation_request_status(
  request_id_input uuid,
  status_input invitation_request_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  update public.invitation_request
  set status = status_input,
      reviewed_at = now(),
      reviewed_by = public.current_person_id()
  where id = request_id_input;

  return request_id_input;
end;
$$;

alter table public.person enable row level security;
alter table public.user_account enable row level security;
alter table public.app_session enable row level security;
alter table public.app_operator enable row level security;
alter table public.appearance enable row level security;
alter table public.club_admin enable row level security;
alter table public.club enable row level security;
alter table public.club_table enable row level security;
alter table public.season enable row level security;
alter table public.league enable row level security;
alter table public.team enable row level security;
alter table public.team_membership enable row level security;
alter table public.person_team_role enable row level security;
alter table public.club_membership enable row level security;
alter table public.contact_directory enable row level security;
alter table public.invitation enable row level security;
alter table public.invitation_membership enable row level security;
alter table public.invitation_club_membership enable row level security;
alter table public.invitation_email enable row level security;
alter table public.invitation_request enable row level security;
alter table public.password_reset_token enable row level security;
alter table public.fixture enable row level security;
alter table public.fixture_week enable row level security;
alter table public.fixture_week_match enable row level security;
alter table public.match enable row level security;
alter table public.game enable row level security;
alter table public.player_game_result enable row level security;
alter table public.live_frame_session enable row level security;
alter table public.live_frame_event enable row level security;
alter table public.match_lineup enable row level security;
alter table public.fixture_lineup enable row level security;
alter table public.fixture_lineup_slot enable row level security;
alter table public.break enable row level security;
alter table public.user_activity_log enable row level security;
alter table public.table_booking enable row level security;
alter table public.competition enable row level security;
alter table public.competition_round enable row level security;
alter table public.competition_entry enable row level security;
alter table public.competition_match enable row level security;
alter table public.last_man_standing_competition enable row level security;
alter table public.last_man_standing_round enable row level security;
alter table public.last_man_standing_round_schedule enable row level security;
alter table public.last_man_standing_entry enable row level security;
alter table public.last_man_standing_pick enable row level security;
alter table public.last_man_standing_team_order_snapshot enable row level security;
alter table public.last_man_standing_event enable row level security;
alter table public.conversation enable row level security;
alter table public.conversation_participant enable row level security;
alter table public.message enable row level security;

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select person_id from public.user_account where id = auth.uid() and active = true
$$;

create or replace function public.is_app_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_operator ao
    where ao.person_id = public.current_person_id()
      and ao.active = true
  )
$$;

create or replace function public.is_manager_for_team(team_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team target_team
    join public.person_team_role ptr
      on ptr.league_id = target_team.league_id
     and ptr.team_name = target_team.name
    join public.club_membership cm
      on cm.id = ptr.club_membership_id
     and cm.club_id = target_team.club_id
     and cm.active = true
    where target_team.id = team_uuid
      and cm.person_id = public.current_person_id()
      and ptr.role in ('Manager')
      and ptr.active = true
  ) or exists (
    select 1 from public.team_membership tm
    where tm.team_id = team_uuid
      and tm.person_id = public.current_person_id()
      and tm.role in ('Manager')
      and tm.active = true
  )
$$;

create policy "people can read active league people" on public.person for select to authenticated using (active = true);
create policy "operators can read all people" on public.person for select to authenticated using (public.is_app_operator());
create policy "users can read their account" on public.user_account for select to authenticated using (id = auth.uid());
create policy "operators can read user accounts" on public.user_account for select to authenticated using (public.is_app_operator());
create policy "no client session access" on public.app_session for all to authenticated using (false) with check (false);
create policy "operators can read operator markers" on public.app_operator for select to authenticated using (public.is_app_operator() or person_id = public.current_person_id());
create policy "members can read club admins" on public.club_admin for select to authenticated using (active = true);
create policy "operators can read all club admins" on public.club_admin for select to authenticated using (public.is_app_operator());
create policy "authenticated users can read clubs" on public.club for select to authenticated using (active = true);
create policy "authenticated users can read club tables" on public.club_table for select to authenticated using (active = true);
create policy "authenticated users can read seasons" on public.season for select to authenticated using (true);
create policy "authenticated users can read leagues" on public.league for select to authenticated using (true);
create policy "authenticated users can read teams" on public.team for select to authenticated using (active = true);
create policy "members can read memberships" on public.team_membership for select to authenticated using (active = true);
create policy "operators can read all memberships" on public.team_membership for select to authenticated using (public.is_app_operator());
create policy "members can read person team roles" on public.person_team_role for select to authenticated using (active = true);
create policy "operators can read all person team roles" on public.person_team_role for select to authenticated using (public.is_app_operator());
create policy "members can read club memberships" on public.club_membership for select to authenticated using (active = true);
create policy "operators can read all club memberships" on public.club_membership for select to authenticated using (public.is_app_operator());
create policy "managers can read contact directory" on public.contact_directory for select to authenticated using (
  active = true
  and (
    public.is_app_operator()
    or exists (select 1 from public.club_admin ca where ca.person_id = public.current_person_id() and ca.active = true)
    or exists (select 1 from public.club_membership cm where cm.person_id = public.current_person_id() and cm.active = true and cm.is_club_admin = true)
    or exists (select 1 from public.person_team_role ptr where ptr.person_id = public.current_person_id() and ptr.active = true and ptr.role = 'Manager')
  )
);
create policy "operators can read invitations" on public.invitation for select to authenticated using (public.is_app_operator());
create policy "operators can read invitation memberships" on public.invitation_membership for select to authenticated using (public.is_app_operator());
create policy "operators can read invitation club memberships" on public.invitation_club_membership for select to authenticated using (public.is_app_operator());
create policy "operators can read invitation emails" on public.invitation_email for select to authenticated using (public.is_app_operator());
create policy "operators can read invite requests" on public.invitation_request for select to authenticated using (public.is_app_operator());
create policy "members can read fixtures" on public.fixture for select to authenticated using (true);
create policy "members can read matches" on public.match for select to authenticated using (true);
create policy "members can read games" on public.game for select to authenticated using (true);
create policy "members can read player game results" on public.player_game_result for select to authenticated using (true);
create policy "members can read breaks" on public.break for select to authenticated using (true);
create policy "users can read their own activity" on public.user_activity_log for select to authenticated using (auth_user_id = auth.uid());
create policy "operators can read activity" on public.user_activity_log for select to authenticated using (public.is_app_operator());
create policy "members can read table bookings" on public.table_booking for select to authenticated using (cancelled_at is null);
create policy "members can read competitions" on public.competition for select to authenticated using (true);
create policy "members can read competition rounds" on public.competition_round for select to authenticated using (true);
create policy "members can read competition entries" on public.competition_entry for select to authenticated using (true);
create policy "members can read competition matches" on public.competition_match for select to authenticated using (true);

create policy "managers can create fixtures" on public.fixture for insert to authenticated
with check (public.is_manager_for_team(home_team_id) or public.is_manager_for_team(away_team_id));

create policy "managers can enter matches" on public.match for insert to authenticated
with check (
  exists (
    select 1 from public.fixture f
    where f.id = fixture_id
      and (public.is_manager_for_team(f.home_team_id) or public.is_manager_for_team(f.away_team_id))
  )
);

create policy "managers can manage lineups" on public.match_lineup for all to authenticated
using (public.is_manager_for_team(team_id))
with check (public.is_manager_for_team(team_id));

create policy "managers can record breaks" on public.break for insert to authenticated
with check (
  exists (
    select 1
    from public.game g
    join public.match m on m.id = g.match_id
    join public.fixture f on f.id = m.fixture_id
    where g.id = game_id
      and (public.is_manager_for_team(f.home_team_id) or public.is_manager_for_team(f.away_team_id))
  )
);

create policy "participants can read conversations" on public.conversation for select to authenticated
using (
  exists (
    select 1 from public.conversation_participant cp
    where cp.conversation_id = id and cp.person_id = public.current_person_id()
  )
);

create policy "participants can read participant rows" on public.conversation_participant for select to authenticated
using (person_id = public.current_person_id());

create policy "participants can read messages" on public.message for select to authenticated
using (
  exists (
    select 1 from public.conversation_participant cp
    where cp.conversation_id = message.conversation_id and cp.person_id = public.current_person_id()
  )
);

insert into public.league (name, playing_day)
values
  ('A League', 'Thursday'),
  ('B League', 'Thursday'),
  ('C League', 'Monday')
on conflict (name) do update set playing_day = excluded.playing_day;
