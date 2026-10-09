begin;

alter table public.live_frame_event
  drop constraint if exists live_frame_event_event_type_check;

alter table public.live_frame_event
  add constraint live_frame_event_event_type_check
  check (event_type in (
    'Start', 'Pot', 'Foul', 'EndVisit', 'SelectPlayer', 'CorrectBalls',
    'ResetFrame', 'Undo', 'Takeover', 'Pause', 'Resume', 'Complete', 'Abandon'
  ));

commit;
