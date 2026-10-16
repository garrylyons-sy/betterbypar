update public.appearance
set panel_config = panel_config || '["clubLadder"]'::jsonb,
    updated_at = now()
where active = true
  and jsonb_typeof(panel_config) = 'array'
  and not panel_config @> '["clubLadder"]'::jsonb;
