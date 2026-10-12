-- Vault helper functions callable via Supabase RPC (service_role only).
--
-- PostgREST can only call functions in the public (or exposed) schema.
-- vault.decrypted_secrets lives in the vault schema and cannot be queried
-- directly via supabase-js .from(). These wrappers let Edge Functions call
-- vault operations safely through RPC.

-- Decrypt and return the Braze API key for a given client.
-- Used by the sync-braze Edge Function.
create or replace function get_braze_api_key(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_secret    text;
begin
  select api_key_secret_id into v_secret_id
  from public.braze_credentials
  where client_id = p_client_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_secret;
end;
$$;

-- Wrappers for vault.create_secret / vault.update_secret / delete.
-- vault schema functions are not reachable via PostgREST without these.

create or replace function vault_create_secret(
  p_secret      text,
  p_name        text default null,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return vault.create_secret(p_secret, p_name, p_description);
end;
$$;

create or replace function vault_update_secret(
  p_id     uuid,
  p_secret text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(p_id, p_secret);
end;
$$;

create or replace function vault_delete_secret(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = p_id;
end;
$$;
