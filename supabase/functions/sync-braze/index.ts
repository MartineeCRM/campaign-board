import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Braze API response types ---

interface CampaignVariantStats {
  sent?: number
  total_opens?: number
  unique_opens?: number
  body_clicks?: number
  unique_clicks?: number
  bounces?: number
}

interface CampaignDataPoint {
  time: string
  messages: Record<string, CampaignVariantStats[]>
  conversions?: number
}

interface CanvasTotalStats {
  entries?: number
  conversions?: number
  revenue?: number
}

interface CanvasDataPoint {
  time: string
  total_stats: CanvasTotalStats
}

interface CanvasDataSeriesResponse {
  message: string
  data: { name: string; stats: CanvasDataPoint[] }
}

// --- Aggregation helpers ---

function aggregateCampaignSeries(data: CampaignDataPoint[]) {
  let sent = 0, opens = 0, clicks = 0, convs = 0
  for (const point of data) {
    for (const variants of Object.values(point.messages)) {
      for (const v of variants) {
        sent += v.sent ?? 0
        opens += v.total_opens ?? v.unique_opens ?? 0
        clicks += v.body_clicks ?? v.unique_clicks ?? 0
      }
    }
    convs += point.conversions ?? 0
  }
  return { sent, opens, clicks, convs }
}

function aggregateCanvasSeries(stats: CanvasDataPoint[]) {
  let sent = 0, convs = 0
  for (const point of stats) {
    sent += point.total_stats.entries ?? 0
    convs += point.total_stats.conversions ?? 0
  }
  return { sent, opens: 0, clicks: 0, convs }
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Auth check
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

    // Create a sync_runs record
    const { data: runRow, error: runCreateErr } = await admin
      .from('sync_runs')
      .insert({ client_id: clientId, status: 'running' })
      .select('id')
      .single()
    if (runCreateErr) throw runCreateErr
    const runId = runRow.id

    const finishRun = async (status: 'success' | 'error', errorMessage?: string) => {
      await admin
        .from('sync_runs')
        .update({ status, finished_at: new Date().toISOString(), error_message: errorMessage ?? null })
        .eq('id', runId)
    }

    try {
      // Read braze credentials + decrypt API key from Vault
      const { data: creds, error: credsErr } = await admin
        .from('braze_credentials')
        .select('rest_api_url, api_key_secret_id')
        .eq('client_id', clientId)
        .single()
      if (credsErr || !creds) throw new Error('Braze 인증정보가 없습니다. 먼저 설정을 완료하세요.')

      const { data: secretRow, error: vaultErr } = await admin
        .from('vault.decrypted_secrets')
        .select('decrypted_secret')
        .eq('id', creds.api_key_secret_id)
        .single()
      if (vaultErr || !secretRow?.decrypted_secret) throw new Error('Vault 시크릿 복호화 실패')

      const apiKey: string = secretRow.decrypted_secret
      const baseUrl = creds.rest_api_url.replace(/\/$/, '')

      // Fetch all campaigns for this client that have a braze_id
      const { data: linkedCampaigns, error: fetchErr } = await admin
        .from('campaigns')
        .select('id, braze_id, braze_type, node_id')
        .not('braze_id', 'is', null)
        .in(
          'node_id',
          // subquery equivalent: get node_ids for this client
          (await admin
            .from('funnel_nodes')
            .select('id')
            .in(
              'stage_id',
              (await admin.from('stages').select('id').eq('client_id', clientId)).data?.map((r) => r.id) ?? []
            )
          ).data?.map((r) => r.id) ?? []
        )
      if (fetchErr) throw fetchErr
      if (!linkedCampaigns || linkedCampaigns.length === 0) {
        await finishRun('success')
        return new Response(JSON.stringify({ ok: true, synced: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const today = new Date().toISOString().slice(0, 10)
      let synced = 0

      for (const campaign of linkedCampaigns) {
        try {
          const brazeId = campaign.braze_id as string
          const brazeType = (campaign.braze_type ?? 'campaign') as 'campaign' | 'canvas'

          let stats: { sent: number; opens: number; clicks: number; convs: number }

          if (brazeType === 'canvas') {
            const url = `${baseUrl}/canvas/data_series?canvas_id=${encodeURIComponent(brazeId)}&length=30&unit=day&include_variant_breakdown=false`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
            if (!res.ok) throw new Error(`Braze canvas/data_series ${res.status}`)
            const body = await res.json() as CanvasDataSeriesResponse
            stats = aggregateCanvasSeries(body.data?.stats ?? [])
          } else {
            const url = `${baseUrl}/campaigns/data_series?campaign_id=${encodeURIComponent(brazeId)}&length=30&unit=day`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
            if (!res.ok) throw new Error(`Braze campaigns/data_series ${res.status}`)
            const body = await res.json() as { message: string; data: CampaignDataPoint[] }
            stats = aggregateCampaignSeries(body.data ?? [])
          }

          const now = new Date().toISOString()

          // Update the campaigns row
          await admin
            .from('campaigns')
            .update({
              sent: stats.sent,
              opens: stats.opens,
              clicks: stats.clicks,
              convs: stats.convs,
              last_synced_at: now,
            })
            .eq('id', campaign.id)

          // Upsert today's daily metrics row
          await admin
            .from('campaign_metrics_daily')
            .upsert(
              { campaign_id: campaign.id, date: today, sent: stats.sent, opens: stats.opens, clicks: stats.clicks, convs: stats.convs },
              { onConflict: 'campaign_id,date' }
            )

          synced++
        } catch (campaignErr) {
          // Log but don't abort the whole sync for one bad campaign
          console.error(`Failed to sync campaign ${campaign.id}:`, campaignErr)
        }
      }

      await finishRun('success')
      return new Response(JSON.stringify({ ok: true, synced }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await finishRun('error', message)
      throw err
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
