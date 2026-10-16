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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders })

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { spreadsheetId, serviceAccountKey } = await req.json() as {
      spreadsheetId: string
      serviceAccountKey?: string  // optional — only provided when changing the key
    }

    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: 'Missing spreadsheetId' }), { status: 400, headers: corsHeaders })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // If a new service account key was provided, save/update it in Vault
    let secretId: string | undefined

    if (serviceAccountKey) {
      const { data: existing } = await admin
        .from('sheets_config')
        .select('service_account_secret_id')
        .eq('id', 1)
        .single()

      if (existing?.service_account_secret_id) {
        const { error: updateErr } = await admin.rpc('vault_update_secret', {
          p_id: existing.service_account_secret_id,
          p_secret: serviceAccountKey,
        })
        if (updateErr) {
          await admin.rpc('vault_delete_secret', { p_id: existing.service_account_secret_id })
          const { data: created, error: createErr } = await admin.rpc('vault_create_secret', {
            p_secret: serviceAccountKey,
            p_name: 'sheets_service_account',
            p_description: 'Google Sheets service account JSON key',
          })
          if (createErr) throw createErr
          secretId = created
        } else {
          secretId = existing.service_account_secret_id
        }
      } else {
        const { data: created, error: createErr } = await admin.rpc('vault_create_secret', {
          p_secret: serviceAccountKey,
          p_name: 'sheets_service_account',
          p_description: 'Google Sheets service account JSON key',
        })
        if (createErr) throw createErr
        secretId = created
      }
    }

    // Upsert sheets_config
    const updatePayload: Record<string, unknown> = {
      id: 1,
      spreadsheet_id: spreadsheetId,
      updated_at: new Date().toISOString(),
    }
    if (secretId) updatePayload.service_account_secret_id = secretId

    const { error: upsertErr } = await admin.from('sheets_config').upsert(updatePayload)
    if (upsertErr) throw upsertErr

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
