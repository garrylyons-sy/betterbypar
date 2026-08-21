-- Allow C League to use three singles and two doubles:
-- game 1 singles, game 2 doubles, game 3 singles, game 4 doubles, game 5 singles.
-- The application chooses the exact pattern per league; these database checks allow
-- the valid slot shapes needed by A/B and C.

alter table public.game
  drop constraint if exists game_live_order_check;

alter table public.game
  add constraint game_live_order_check
  check (
    (game_type = 'Singles' and game_number between 1 and 6 and points_awarded = 1)
    or
    (game_type = 'Doubles' and game_number in (2, 3, 4) and points_awarded = 2)
  );

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.fixture_lineup_slot'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.fixture_lineup_slot drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.fixture_lineup_slot
  add constraint fixture_lineup_slot_number_check check (slot_number between 1 and 6),
  add constraint fixture_lineup_slot_partner_check check (game_type = 'Doubles' or player_2_id is null),
  add constraint fixture_lineup_slot_distinct_players_check check (player_1_id is null or player_1_id <> player_2_id),
  add constraint fixture_lineup_slot_game_type_check check (
    (slot_number in (2, 3, 4) and game_type = 'Doubles')
    or
    (slot_number between 1 and 6 and game_type = 'Singles')
  );

comment on table public.fixture_lineup_slot is 'Ordered lineup slots. A/B use singles 1,2,4,5,6 plus doubles 3; C uses singles 1,3,5 plus doubles 2,4.';
