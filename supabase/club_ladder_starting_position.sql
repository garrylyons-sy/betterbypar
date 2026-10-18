alter table public.club_ladder_entry
  add column if not exists starting_position integer;

update public.club_ladder_entry
set starting_position = position
where starting_position is null;

alter table public.club_ladder_entry
  alter column starting_position set not null;

alter table public.club_ladder_entry
  drop constraint if exists club_ladder_entry_starting_position_check;

alter table public.club_ladder_entry
  add constraint club_ladder_entry_starting_position_check check (starting_position > 0);

comment on column public.club_ladder_entry.starting_position is
  'The player position when they joined or were most recently added to this ladder.';
