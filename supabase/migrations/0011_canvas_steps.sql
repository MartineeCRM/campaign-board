alter table campaigns
  add column if not exists canvas_steps jsonb not null default '[]'::jsonb
  check (jsonb_typeof(canvas_steps) = 'array');
