import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BrazeCampaign {
  id: string
  name: string
  is_active: boolean
  is_archived: boolean
  last_edited: string
}

interface BrazeCanvas {
  id: string
  name: string
  is_active: boolean
  is_archived: boolean
  last_edited: string
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

    const { clientId } = await req.json() as { clientId: string }
    if (!clientId) return new Response(JSON.stringify({ error: 'Missing clientId' }), { status: 400, headers: corsHeaders })

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: creds, error: credsErr } = await admin
      .from('braze_credentials')
      .select('rest_api_url')
      .eq('client_id', clientId)
      .single()
    if (credsErr || !creds) throw new Error('Braze 인증정보가 없습니다. 먼저 설정을 완료하세요.')

    const { data: apiKey, error: vaultErr } = await admin.rpc('get_braze_api_key', { p_client_id: clientId })
    if (vaultErr || !apiKey) throw new Error('API Key 복호화 실패')

    const baseUrl = creds.rest_api_url.replace(/\/$/, '')
    const headers = { Authorization: `Bearer ${apiKey}` }

    // Fetch campaigns and canvases in parallel (page 0, up to 100 each)
    const [campaignsRes, canvasesRes] = await Promise.all([
      fetch(`${baseUrl}/campaigns/list?page=0&include_archived=false&sort_direction=desc`, { headers }),
      fetch(`${baseUrl}/canvas/list?page=0&include_archived=false&sort_direction=desc`, { headers }),
    ])

    if (!campaignsRes.ok) throw new Error(`Braze campaigns/list ${campaignsRes.status}`)
    if (!canvasesRes.ok) throw new Error(`Braze canvas/list ${canvasesRes.status}`)

    const campaignsBody = await campaignsRes.json() as { campaigns?: BrazeCampaign[]; message?: string }
    const canvasesBody = await canvasesRes.json() as { canvases?: BrazeCanvas[]; message?: string }

    const campaigns = (campaignsBody.campaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: 'campaign' as const,
      last_edited: c.last_edited,
    }))

    const canvases = (canvasesBody.canvases ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: 'canvas' as const,
      last_edited: c.last_edited,
    }))

    return new Response(
      JSON.stringify({ campaigns, canvases }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
