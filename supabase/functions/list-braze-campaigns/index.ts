import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchAllBrazePages, filterBrazeDrafts, hasMartineeTag } from '../_shared/braze-list.ts'

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
  tags?: string[]
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

    const [allCampaigns, allCanvases] = await Promise.all([
      fetchAllBrazePages(async (page) => {
        const res = await fetch(`${baseUrl}/campaigns/list?page=${page}&include_archived=false&sort_direction=desc`, { headers })
        if (!res.ok) throw new Error(`Braze campaigns/list page ${page}: ${res.status}`)
        const body = await res.json() as { campaigns?: BrazeCampaign[] }
        return body.campaigns ?? []
      }),
      fetchAllBrazePages(async (page) => {
        const res = await fetch(`${baseUrl}/canvas/list?page=${page}&include_archived=false&sort_direction=desc`, { headers })
        if (!res.ok) throw new Error(`Braze canvas/list page ${page}: ${res.status}`)
        const body = await res.json() as { canvases?: BrazeCanvas[] }
        return body.canvases ?? []
      }),
    ])

    // The list endpoints do not expose the `draft` flag. Read each candidate's
    // details and fail the list request if Braze cannot confirm its state.
    const detailsUrl = (id: string, type: 'campaign' | 'canvas') => {
      const endpoint = type === 'campaign' ? 'campaigns/details' : 'canvas/details'
      const queryKey = type === 'campaign' ? 'campaign_id' : 'canvas_id'
      return `${baseUrl}/${endpoint}?${queryKey}=${encodeURIComponent(id)}`
    }

    const taggedCampaigns = allCampaigns.filter((c) => hasMartineeTag(c.tags))
    const [publishedCampaigns, publishedCanvases] = await Promise.all([
      filterBrazeDrafts(taggedCampaigns, (id) => detailsUrl(id, 'campaign'), headers),
      filterBrazeDrafts(allCanvases, (id) => detailsUrl(id, 'canvas'), headers),
    ])

    const campaigns = publishedCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'campaign' as const,
      is_active: c.is_active,
      is_archived: c.is_archived,
      last_edited: c.last_edited,
    }))

    const canvases = publishedCanvases.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'canvas' as const,
      is_active: c.is_active,
      is_archived: c.is_archived,
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
