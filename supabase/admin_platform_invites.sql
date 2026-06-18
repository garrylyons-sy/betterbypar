alter table public.invitation
  add column if not exists phone text,
  add column if not exists invite_administrator boolean not null default false;

create table if not exists public.invitation_club_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  role text not null default 'Club Member' check (role in ('Club Member', 'Club Admin')),
  unique (invitation_id, club_id, role)
);

comment on table public.invitation_club_membership is 'Club-level roles attached to an account invitation, used for members who can book tables and receive club messages without a team role.';

create table if not exists public.invitation_email (
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

create index if not exists invitation_email_invitation_idx on public.invitation_email(invitation_id);

insert into public.app_operator (person_id, active)
select id, true
from public.person
where lower(email) = 'garlyons@gmail.com'
on conflict (person_id) do update set active = true;
