-- Google Sheets integration
-- sheets_config: singleton row, stores spreadsheet_id + vault secret reference for service account key

create table if not exists sheets_config (
  id int primary key default 1 check (id = 1),
  spreadsheet_id text not null default '',
  service_account_secret_id uuid,
  updated_at timestamptz default now()
);

insert into sheets_config (id, spreadsheet_id) values (1, '') on conflict do nothing;

-- Per-client: which tab in the spreadsheet maps to this client
alter table clients add column if not exists sheets_tab text;

-- RPC: decrypt and return the Sheets service account JSON key
create or replace function get_sheets_service_account()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_secret    text;
begin
  select service_account_secret_id into v_secret_id
  from sheets_config
  where id = 1;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_secret;
end;
$$;
