import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the caller is an authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders })

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { clientId, baseUrl, restApiUrl, apiKey } = await req.json() as {
      clientId: string
      baseUrl: string
      restApiUrl: string
      apiKey: string
    }

    if (!clientId || !baseUrl || !restApiUrl || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
    }

    // Service-role client can read/write vault.secrets
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Check if credentials already exist for this client
    const { data: existing } = await admin
      .from('braze_credentials')
      .select('api_key_secret_id')
      .eq('client_id', clientId)
      .maybeSingle()

    let secretId: string

    if (existing?.api_key_secret_id) {
      // Update the existing Vault secret in-place
      const { error: updateErr } = await admin.rpc('vault_update_secret', {
        p_id: existing.api_key_secret_id,
        p_secret: apiKey,
      })
      if (updateErr) {
        // vault_update_secret may not exist — fall back to delete + create
        await admin.rpc('vault_delete_secret', { p_id: existing.api_key_secret_id }).catch(() => {})
        const { data: created, error: createErr } = await admin.rpc('vault_create_secret', {
          p_secret: apiKey,
          p_name: `braze_key_${clientId}`,
          p_description: 'Braze REST API key',
        })
        if (createErr) throw createErr
        secretId = created
      } else {
        secretId = existing.api_key_secret_id
      }
    } else {
      // Create a new Vault secret
      const { data: created, error: createErr } = await admin.rpc('vault_create_secret', {
        p_secret: apiKey,
        p_name: `braze_key_${clientId}`,
        p_description: 'Braze REST API key',
      })
      if (createErr) throw createErr
      secretId = created
    }

    // Upsert the braze_credentials row (api_key stays in Vault; only the pointer lives here)
    const { error: upsertErr } = await admin
      .from('braze_credentials')
      .upsert({
        client_id: clientId,
        base_url: baseUrl,
        rest_api_url: restApiUrl,
        api_key_secret_id: secretId,
        updated_at: new Date().toISOString(),
      })
    if (upsertErr) throw upsertErr

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
