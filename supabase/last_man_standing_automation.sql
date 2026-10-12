alter table public.last_man_standing_competition
  add column if not exists processing_time time not null default '19:30';

comment on column public.last_man_standing_competition.processing_time is
  'Europe/Dublin match-day time after which published lineups are checked and automatic picks are resolved.';
