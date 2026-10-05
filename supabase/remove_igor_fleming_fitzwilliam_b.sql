update public.team_membership tm
   set active = false
  from public.person p,
       public.team t
 where tm.person_id = p.id
   and tm.team_id = t.id
   and lower(p.first_name) = 'igor'
   and lower(p.last_name) = 'fleming'
   and t.name = 'Fitzwilliam B'
   and tm.active = true;
