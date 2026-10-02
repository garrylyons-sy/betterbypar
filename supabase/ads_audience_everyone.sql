do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.ads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%audience%'
  loop
    execute format('alter table public.ads drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.ads
add constraint ads_audience_check
check (audience in ('Everyone', 'League Chair'));
