alter table campaigns
  add column if not exists wow_drops jsonb not null default '{}'::jsonb;
