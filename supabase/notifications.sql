begin;
create table if not exists public.notification_config (
 singleton boolean primary key default true check(singleton), config jsonb not null,
 updated_by uuid references public.person(id) on delete set null, updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
insert into public.notification_config(singleton,config) values(true,'{"enabled":true,"eligibleRoles":["League Chair"],"enabledTypes":["fixture_change","match_reminder","lineup_reminder","ladder_challenge"],"matchReminderHours":24,"lineupReminderHours":4,"ladderReminderHours":24,"quietStart":"22:00","quietEnd":"08:00"}') on conflict do nothing;
create table if not exists public.notification_preference (
 person_id uuid primary key references public.person(id) on delete cascade, preferences jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.app_notification (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.person(id) on delete cascade,
 type text not null check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge')),
 title text not null,body text not null,href text not null,event_key text not null,
 created_at timestamptz not null default now(),read_at timestamptz,expires_at timestamptz,inbox_visible boolean not null default true,
 unique(person_id,event_key)
);
create index if not exists app_notification_inbox_idx on public.app_notification(person_id,created_at desc);
create table if not exists public.notification_push_subscription (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.person(id) on delete cascade,
 endpoint text not null unique,p256dh text not null,auth text not null,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.notification_push_delivery (
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.app_notification(id) on delete cascade,
 subscription_id uuid not null references public.notification_push_subscription(id) on delete cascade,
 status text not null default 'Pending' check(status in ('Pending','Sending','Sent','Failed','Skipped')),
 attempts integer not null default 0,available_at timestamptz not null default now(),locked_at timestamptz,sent_at timestamptz,last_error text,
 unique(notification_id,subscription_id)
);
create index if not exists notification_push_due_idx on public.notification_push_delivery(status,available_at);
alter table public.notification_config enable row level security;
alter table public.notification_preference enable row level security;
alter table public.app_notification enable row level security;
alter table public.notification_push_subscription enable row level security;
alter table public.notification_push_delivery enable row level security;
revoke all on public.notification_config, public.notification_preference, public.app_notification, public.notification_push_subscription, public.notification_push_delivery from anon, authenticated;
-- Only the application database service accesses these tables. No browser policies.
commit;
