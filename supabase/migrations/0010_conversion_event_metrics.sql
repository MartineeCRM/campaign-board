alter table clients
  add column if not exists conversion_event_index smallint not null default 0
  check (conversion_event_index between 0 and 4);

alter table campaigns
  add column if not exists conversion_counts jsonb not null default '[]'::jsonb;

update campaigns
set conversion_counts = jsonb_build_array(convs)
where conversion_counts = '[]'::jsonb;

alter table campaign_metrics_daily
  add column if not exists conversion_counts jsonb not null default '[]'::jsonb;

update campaign_metrics_daily
set conversion_counts = jsonb_build_array(convs)
where conversion_counts = '[]'::jsonb;
