-- Fix get_sheets_service_account: use fully-qualified table name with empty search_path
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
  from public.sheets_config
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
