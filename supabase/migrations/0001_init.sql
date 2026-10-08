-- Campaign Funnel Board — initial schema.
-- Single master account (Supabase Auth), so RLS just gates on
-- "authenticated" vs anonymous — there is no per-row ownership model.

create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  color text not null,
  position int not null,
  created_at timestamptz not null default now()
);
create index stages_client_id_idx on stages(client_id);

create table funnel_nodes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stages(id) on delete cascade,
  label text not null,
  sub text not null default '',
  line text not null default 'solid' check (line in ('solid', 'dashed', 'dotted')),
  position int not null,
  created_at timestamptz not null default now()
);
create index funnel_nodes_stage_id_idx on funnel_nodes(stage_id);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references funnel_nodes(id) on delete cascade,
  -- Braze campaign or canvas id this card is synced from. Null for a card
  -- added manually in the board (not every card has to come from Braze).
  braze_id text,
  braze_type text check (braze_type in ('campaign', 'canvas')),
  name text not null,
  channel text not null default 'Push',
  status text not null default 'experiment' check (status in ('alwayson', 'experiment', 'stopped')),
  pos text not null default 'top' check (pos in ('top', 'bottom')),
  x double precision not null default 0,
  y double precision not null default 0,
  period text not null default '',
  img text,
  delivery text not null default '',
  trigger_desc text not null default '',
  audience text not null default '',
  conv_event text not null default '',
  cap text not null default '',
  link text not null default '',
  sent bigint not null default 0,
  opens bigint not null default 0,
  clicks bigint not null default 0,
  convs bigint not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaigns_node_id_idx on campaigns(node_id);
create index campaigns_braze_id_idx on campaigns(braze_id) where braze_id is not null;

-- One row per campaign per calendar day — the history that WoW (week-over-
-- week) trend comparisons are computed from. Upserted by the sync job
-- (on-demand refresh and the nightly batch both write "today"'s row).
create table campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  date date not null,
  sent bigint not null default 0,
  opens bigint not null default 0,
  clicks bigint not null default 0,
  convs bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, date)
);
create index campaign_metrics_daily_campaign_id_idx on campaign_metrics_daily(campaign_id, date desc);

-- Per-client Braze credentials. The API key itself is never stored in this
-- table — only a pointer to a Supabase Vault secret, which only the
-- service role (used inside Edge Functions, never the browser) can decrypt.
create table braze_credentials (
  client_id uuid primary key references clients(id) on delete cascade,
  base_url text not null,
  rest_api_url text not null,
  api_key_secret_id uuid not null references vault.secrets(id),
  updated_at timestamptz not null default now()
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  error_message text
);
create index sync_runs_client_id_idx on sync_runs(client_id, started_at desc);

-- RLS: single master account, so every table just requires an authenticated
-- session. The anon role (no session) gets no access at all — no policy
-- means default deny.
alter table clients enable row level security;
alter table stages enable row level security;
alter table funnel_nodes enable row level security;
alter table campaigns enable row level security;
alter table campaign_metrics_daily enable row level security;
alter table braze_credentials enable row level security;
alter table sync_runs enable row level security;

create policy "authenticated full access" on clients for all to authenticated using (true) with check (true);
create policy "authenticated full access" on stages for all to authenticated using (true) with check (true);
create policy "authenticated full access" on funnel_nodes for all to authenticated using (true) with check (true);
create policy "authenticated full access" on campaigns for all to authenticated using (true) with check (true);
create policy "authenticated full access" on campaign_metrics_daily for all to authenticated using (true) with check (true);
create policy "authenticated full access" on sync_runs for all to authenticated using (true) with check (true);

-- braze_credentials: authenticated users may see THAT a client has
-- credentials configured (base_url, rest_api_url, updated_at) but the
-- actual key material lives in vault.secrets, which this role cannot read
-- regardless — vault.decrypted_secrets requires service_role.
create policy "authenticated full access" on braze_credentials for all to authenticated using (true) with check (true);
