update public.appearance
set panel_config = '["lastManStanding"]'::jsonb || panel_config,
    updated_at = now()
where active = true
  and jsonb_typeof(panel_config) = 'array'
  and not panel_config @> '["lastManStanding"]'::jsonb
  and not exists (
    select 1
    from jsonb_array_elements_text(panel_config) panel(value)
    where panel.value = 'lastManStanding'
  );
