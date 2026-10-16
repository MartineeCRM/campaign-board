import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { inspectCanvasPayload, mapCampaignPayload, mapCanvasPayload, mapCanvasSteps } from '../_shared/braze-metrics.ts'
import { getWowDrops, type DailyMetricCounts } from '../_shared/wow.ts'
import { dailyMetricRow, describeSyncError } from '../_shared/sync-rows.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Braze API response types ---

interface CampaignDataPoint {
  time: string
  messages?: unknown
  conversions?: number
}

interface CanvasDataSeriesResponse {
  message: string
  data?: { name?: string; stats?: unknown[] }
}

// --- Channel mapping ---

type LocalChannel = 'Push' | 'Kakao' | 'Email' | 'In-app' | 'SMS' | 'Banner' | 'Webhook'

function brazeChannelToLocal(channels: string[]): LocalChannel {
  const ch = channels.map((c) => c.toLowerCase())
  if (ch.some((c) => c.includes('sms'))) return 'SMS'
  if (ch.some((c) => c.includes('email'))) return 'Email'
  if (ch.some((c) => c.includes('content_card'))) return 'Banner'
  if (ch.some((c) => c.includes('in_app'))) return 'In-app'
  if (ch.some((c) => c.includes('webhook'))) return 'Webhook'
  return 'Push'
}

// --- Aggregation helpers ---

function aggregateCampaignSeries(data: CampaignDataPoint[], iamClickCount: 'first' | 'both' = 'first') {
  const daily = data.map((point) => ({ date: point.time.slice(0, 10), metrics: mapCampaignPayload(point, iamClickCount) }))
  const totals = daily.reduce((sum, point) => ({
    sent: sum.sent + point.metrics.sent,
    opens: sum.opens + point.metrics.opens,
    clicks: sum.clicks + point.metrics.clicks,
    convs: sum.convs + point.metrics.convs,
    conversionCounts: addConversionCounts(sum.conversionCounts, point.metrics.conversionCounts),
  }), { sent: 0, opens: 0, clicks: 0, convs: 0, conversionCounts: [0] })
  return { ...totals, daily }
}

function aggregateCanvasSeries(stats: Array<Record<string, unknown>>, iamClickCount: 'first' | 'both') {
  const daily = stats.map((point) => ({
    date: typeof point.time === 'string' ? point.time.slice(0, 10) : '',
    metrics: mapCanvasPayload(point, iamClickCount),
  })).filter((point) => point.date)
  const totals = daily.reduce((sum, point) => ({
    sent: sum.sent + point.metrics.sent,
    opens: sum.opens + point.metrics.opens,
    clicks: sum.clicks + point.metrics.clicks,
    convs: sum.convs + point.metrics.convs,
    conversionCounts: addConversionCounts(sum.conversionCounts, point.metrics.conversionCounts),
  }), { sent: 0, opens: 0, clicks: 0, convs: 0, conversionCounts: [0] })
  return { ...totals, daily }
}

function addConversionCounts(a: number[], b: number[]): number[] {
  return Array.from({ length: Math.max(a.length, b.length, 1) }, (_, index) => (a[index] ?? 0) + (b[index] ?? 0))
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

    const { data: clientConfig, error: clientConfigError } = await admin
      .from('clients')
      .select('iam_click_count')
      .eq('id', clientId)
      .single()
    if (clientConfigError) throw clientConfigError
    const iamClickCount = clientConfig?.iam_click_count === 'both' ? 'both' : 'first'

    // Create a sync_runs record
    const { data: runRow, error: runCreateErr } = await admin
      .from('sync_runs')
      .insert({ client_id: clientId, status: 'running' })
      .select('id')
      .single()
    if (runCreateErr) throw runCreateErr
    const runId = runRow.id

    const finishRun = async (status: 'success' | 'partial' | 'error', errorMessage?: string) => {
      await admin
        .from('sync_runs')
        .update({ status, finished_at: new Date().toISOString(), error_message: errorMessage ?? null })
        .eq('id', runId)
    }

    try {
      // Read braze credentials (REST URL) and decrypt API key via RPC.
      // vault.decrypted_secrets is in the vault schema and cannot be queried
      // directly via supabase-js .from() — use get_braze_api_key() instead.
      const { data: creds, error: credsErr } = await admin
        .from('braze_credentials')
        .select('rest_api_url')
        .eq('client_id', clientId)
        .single()
      if (credsErr || !creds) throw new Error('Braze 인증정보가 없습니다. 먼저 설정을 완료하세요.')

      const { data: apiKey, error: vaultErr } = await admin.rpc('get_braze_api_key', {
        p_client_id: clientId,
      })
      if (vaultErr || !apiKey) throw new Error('Vault 시크릿 복호화 실패 — Braze 설정을 다시 저장해보세요.')

      const baseUrl = creds.rest_api_url.replace(/\/$/, '')

      // Fetch all campaigns for this client that have a braze_id
      const { data: linkedCampaigns, error: fetchErr } = await admin
        .from('campaigns')
        .select('id, name, braze_id, braze_type, node_id, canvas_steps')
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

      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const endingDate = yesterday.toISOString().slice(0, 10)
      const endingAt = `${endingDate}T23:59:59Z`
      let synced = 0
      const campaignFailures: string[] = []

      for (const campaign of linkedCampaigns) {
        try {
          const brazeId = campaign.braze_id as string
          const brazeType = (campaign.braze_type ?? 'campaign') as 'campaign' | 'canvas'

          let stats: ReturnType<typeof aggregateCampaignSeries>
          let canvasPoints: Array<Record<string, unknown>> = []
          let canvasSteps: ReturnType<typeof mapCanvasSteps> | null = null

          if (brazeType === 'canvas') {
            const url = `${baseUrl}/canvas/data_series?canvas_id=${encodeURIComponent(brazeId)}&length=14&ending_at=${encodeURIComponent(endingAt)}&include_variant_breakdown=false&include_step_breakdown=true`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
            if (!res.ok) throw new Error(`Braze canvas/data_series ${res.status}`)
            const body = await res.json() as CanvasDataSeriesResponse
            canvasPoints = Array.isArray(body.data?.stats) ? body.data.stats as Array<Record<string, unknown>> : []
            stats = aggregateCanvasSeries(canvasPoints, iamClickCount)
            const shape = inspectCanvasPayload(canvasPoints)
            if (stats.sent > 0 && stats.opens === 0) {
              console.warn(JSON.stringify({ event: 'canvas_metrics_missing_opens', brazeId, ...shape }))
            }
          } else {
            const url = `${baseUrl}/campaigns/data_series?campaign_id=${encodeURIComponent(brazeId)}&length=30`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
            if (!res.ok) throw new Error(`Braze campaigns/data_series ${res.status}`)
            const body = await res.json() as { message: string; data: CampaignDataPoint[] }
            if (!Array.isArray(body.data)) throw new Error('Braze campaigns/data_series response is missing data[]')
            stats = aggregateCampaignSeries(body.data, iamClickCount)
          }

          const now = new Date().toISOString()

          // Fetch campaign/canvas details to get channel and active status
          let channel: LocalChannel | null = null
          let brazeIsActive: boolean | null = null
          try {
            if (brazeType === 'canvas') {
              const detailUrl = `${baseUrl}/canvas/details?canvas_id=${encodeURIComponent(brazeId)}`
              const detailRes = await fetch(detailUrl, { headers: { Authorization: `Bearer ${apiKey}` } })
              if (detailRes.ok) {
                const detail = await detailRes.json() as { enabled?: boolean; channels?: string[]; steps?: unknown[] }
                if (detail.channels?.length) channel = brazeChannelToLocal(detail.channels)
                if (typeof detail.enabled === 'boolean') brazeIsActive = detail.enabled
                canvasSteps = mapCanvasSteps(detail, canvasPoints, iamClickCount)
              }
            } else {
              const detailUrl = `${baseUrl}/campaigns/details?campaign_id=${encodeURIComponent(brazeId)}`
              const detailRes = await fetch(detailUrl, { headers: { Authorization: `Bearer ${apiKey}` } })
              if (detailRes.ok) {
                const detail = await detailRes.json() as { enabled?: boolean; channels?: string[] }
                if (detail.channels?.length) channel = brazeChannelToLocal(detail.channels)
                if (typeof detail.enabled === 'boolean') brazeIsActive = detail.enabled
              }
            }
          } catch {
            // Details fetch failure is non-fatal — metrics still get updated
          }

          if (brazeType === 'canvas' && canvasSteps === null) {
            const previous = Array.isArray(campaign.canvas_steps) ? campaign.canvas_steps as Array<{ id?: string; name?: string; channel?: string }> : []
            canvasSteps = mapCanvasSteps(null, canvasPoints, iamClickCount).map((step) => {
              const saved = previous.find((item) => item.id === step.id)
              return { ...step, name: saved?.name || step.name, channel: saved?.channel || step.channel }
            })
          }

          // Update the campaigns row (metrics + channel/braze_is_active if available)
          const { error: updateError } = await admin
            .from('campaigns')
            .update({
              sent: stats.sent,
              opens: stats.opens,
              clicks: stats.clicks,
              convs: stats.convs,
              conversion_counts: stats.conversionCounts,
              wow_drops: getWowDrops(stats.daily, endingDate),
              last_synced_at: now,
              ...(channel ? { channel } : {}),
              ...(brazeIsActive !== null ? { braze_is_active: brazeIsActive } : {}),
              ...(canvasSteps !== null ? { canvas_steps: canvasSteps } : {}),
            })
            .eq('id', campaign.id)
          if (updateError) throw updateError

          // Persist the Braze time series by its actual calendar date.
          if (stats.daily.length) {
              const { error: dailyError } = await admin
              .from('campaign_metrics_daily')
                .upsert(stats.daily.map(({ date, metrics }) => dailyMetricRow(campaign.id, date, metrics)), { onConflict: 'campaign_id,date' })
              if (dailyError) throw dailyError
          }

          synced++
        } catch (campaignErr) {
          // Continue syncing peers, but mark the run partial and expose the failure.
          const reason = describeSyncError(campaignErr)
          console.error(`Failed to sync campaign ${campaign.id}:`, reason)
          campaignFailures.push(`${campaign.name ?? campaign.id}: ${reason}`)
        }
      }

      if (campaignFailures.length) {
        const summary = campaignFailures.slice(0, 10).join('; ')
        await finishRun('partial', summary)
        return new Response(JSON.stringify({ ok: false, synced, failed: campaignFailures.length, error: summary }), {
          status: 207,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await finishRun('success')
      return new Response(JSON.stringify({ ok: true, synced }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      const message = describeSyncError(err)
      await finishRun('error', message)
      throw err
    }
  } catch (err) {
    const message = describeSyncError(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
