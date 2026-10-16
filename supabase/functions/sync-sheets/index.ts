import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Google Sheets auth via service account JWT ---

interface ServiceAccount {
  client_email: string
  private_key: string
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

function b64url(input: string): string {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${unsigned}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
  if (!tokenData.access_token) throw new Error(`Google auth failed: ${tokenData.error ?? JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

// --- Column indices (0-based) ---
// B=1  Campaign ID
// C=2  Braze URL
// N=13 Delivery   (Apps Script 추출본 — Type/Trigger/Re-eligibility/Duration 포함)
// O=14 Target Audience (Apps Script 추출본)
// Q=16 Conversion Events (Apps Script 추출본)

const COL = {
  campaignId: 1,
  brazeUrl:   2,
  delivery:  13,
  audience:  14,
  convEvent: 16,
}

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

// --- Settings parsing (ported from Google Apps Script) ---

function extractSection(text: string, startLabels: string | string[], endLabels: string | string[]): string {
  if (!text) return '(해당 섹션 없음)'
  if (!Array.isArray(startLabels)) startLabels = [startLabels]
  if (!Array.isArray(endLabels)) endLabels = [endLabels]

  for (const s of startLabels) {
    for (const e of endLabels) {
      const regex = new RegExp(s + '([\\s\\S]*?)' + e, 'i')
      const match = text.match(regex)
      if (match) return match[1].trim()
    }
  }
  return '(해당 섹션 없음)'
}

function formatDateInLine(text: string): string {
  if (!text) return ''
  const raw = new Date(text.replace(/(st|nd|rd|th)/g, ''))
  if (isNaN(raw.getTime())) return text
  const yyyy = raw.getFullYear()
  const mm = String(raw.getMonth() + 1).padStart(2, '0')
  const dd = String(raw.getDate()).padStart(2, '0')
  const hh = String(raw.getHours()).padStart(2, '0')
  const mi = String(raw.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function getDelivery(text: string): string {
  if (!text) return ''

  const section = extractSection(
    text,
    ['Delivery', 'Entry Schedule'],
    ['Target Audience', 'Audience Summary', 'Exit Criteria'],
  )
  if (!section || section === '(해당 섹션 없음)') return ''

  const lines = section.split('\n').map((l) => l.trim())
  const result: string[] = []

  const isActionBased = /Action Based/i.test(section)
  const isScheduled = /Scheduled Entry/i.test(section)

  if (isActionBased) {
    result.push('- Type: Action-based')

    const triggerLine = lines.find((l) => l.startsWith('Perform Custom Event'))
    const propLine = lines.find((l) => /matches regex/i.test(l))
    if (triggerLine) {
      const eventMatch = triggerLine.match(/"(.+?)"/)
      const eventName = eventMatch ? eventMatch[1] : '(unknown)'
      const propertyPart = propLine ? ` [${propLine.trim()}]` : ''
      result.push(`- Trigger: Custom Event "${eventName}"${propertyPart}`)
    }

    const delayLine = lines.find((l) => l.toLowerCase().startsWith('schedule delay'))
    if (delayLine) result.push(`- Schedule: ${delayLine.replace(/schedule delay:/i, '').trim()}`)

    const startLine = lines.find((l) =>
      l.toLowerCase().startsWith('campaign start') || l.toLowerCase().startsWith('canvas start'),
    )
    const endLine = lines.find((l) =>
      l.toLowerCase().startsWith('campaign end') || l.toLowerCase().startsWith('canvas end'),
    )
    if (startLine && endLine) {
      const start = formatDateInLine(startLine.replace(/(Campaign|Canvas) start:/i, '').trim())
      const end = formatDateInLine(endLine.replace(/(Campaign|Canvas) end:/i, '').trim())
      result.push(`- Duration: ${start} ~ ${end}`)
    }

    const reenterLine = lines.find((l) => l.toLowerCase().includes('re-enter'))
    if (reenterLine) {
      const match = reenterLine.match(/after ([\d\w\s,]+)/i)
      if (match) result.push(`- Re-eligibility: ${match[1].trim()}`)
    }

    const quietLine = lines.find((l) => l.toLowerCase().startsWith('quiet hours'))
    if (quietLine) {
      const status = quietLine.toLowerCase().includes('disabled') ? 'OFF' : 'ON'
      result.push(`- Quiet Hours: ${status}`)
    }

    const prioLine = lines.find((l) => l.toLowerCase().includes('priority'))
    if (prioLine) result.push(`- Message Priority: ${prioLine}`)
  } else if (isScheduled) {
    result.push('- Type: Scheduled')

    const startLine = lines.find((l) => l.startsWith('Enter users once on') || l.includes('starting on'))
    if (startLine) {
      const dateMatch = startLine.match(/(?:once|starting) on (.+)/i)
      if (dateMatch) result.push(`- Start: ${formatDateInLine(dateMatch[1].trim())}`)
    }

    const repeatLine = lines.find((l) => l.startsWith('Will repeat every'))
    if (repeatLine) result.push(`- Repeat: ${repeatLine.replace('Will repeat every', '').trim()}`)

    const endLine = lines.find((l) => l === 'Never ends')
    if (endLine) result.push('- End: Never')

    const nextSend = lines.find((l) => l.startsWith('Next Send Time:'))
    if (nextSend) result.push(`- Next Send Time: ${formatDateInLine(nextSend.replace('Next Send Time:', '').trim())}`)

    const reLine = lines.find((l) => l.toLowerCase().includes('re-enter'))
    if (reLine) {
      const match = reLine.match(/after ([\d\w\s,]+)/i)
      result.push(`- Re-eligibility: ${match ? match[1].trim() : 'X'}`)
    }

    const freqLine = lines.find((l) => l.toLowerCase().includes('frequency capping rules'))
    if (freqLine) {
      const status = freqLine.toLowerCase().includes('off') ? 'OFF' : 'ON'
      result.push(`- Frequency Capping: ${status}`)
    }
  }

  return result.join('\n')
}

function getTargetRawSection(text: string, type?: string): string {
  if (!text) return '(해당 섹션 없음)'
  if (type === 'canvas') {
    return extractSection(
      text,
      ['Target Audience', 'Audience Summary'],
      ['Entry Audience', 'Exit Criteria', 'Delivery', 'Compose'],
    )
  } else if (type === 'campaign') {
    return extractSection(
      text,
      ['Target Audience', 'Entry Audience', 'Audience Summary'],
      ['No limitations', 'Users will', 'Delivery', 'Compose'],
    )
  }
  return extractSection(
    text,
    ['Target Audience', 'Entry Audience', 'Audience Summary'],
    ['No limitations', 'Users will', 'Delivery', 'Compose', 'Exit Criteria'],
  )
}

function getTargetAudience(text: string, type?: string): string {
  if (!text) return '(조건 없음)'
  let raw = getTargetRawSection(text, type)
  if (!raw || raw === '(해당 섹션 없음)') return '(조건 없음)'

  raw = raw
    .replace(/ AND /g, '\n')
    .replace(/no additional filters/gi, '')
    .replace(/no segments or filters selected/gi, '')
    .replace(/Audience Summary/gi, '')
    .replace(/Target Audience/gi, '')
    .replace(/Entry Audience/gi, '')
    .trim()

  return raw || '(조건 없음)'
}

function getConversionEvents(text: string): string {
  if (!text) return ''
  const lines = text.split('\n')
  const results: string[] = []
  const unitMap: Record<string, string> = {
    day: 'd', days: 'd', hour: 'h', hours: 'h', minute: 'm', minutes: 'm',
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const labelMatch = line.match(/^(Primary )?Conversion Event - ([A-D])/i)

    if (labelMatch) {
      const currentLabel = labelMatch[2]
      const nextLine = lines[i + 1]?.trim() ?? ''

      if (nextLine.startsWith('Performs Custom Event')) {
        const periodMatch = nextLine.match(/within (\d+)\s+(Day|Days|Hour|Hours|Minute|Minutes)/i)
        let period = ''
        if (periodMatch) {
          const unit = unitMap[periodMatch[2].toLowerCase()] ?? ''
          period = `${periodMatch[1]}${unit}`
        }
        const eventNameLine = lines[i + 3]?.trim() ?? '(unknown)'
        let propText = ''
        if (lines[i + 4]?.trim() === 'Property Filters') {
          const filter = lines[i + 5]?.trim()
          if (filter) propText = ` [${filter}]`
          i += 5
        } else {
          i += 3
        }
        results.push(`${currentLabel}: ${eventNameLine} (${period})${propText}`)
      } else if (nextLine.match(/^(Makes Purchase|Upgraded App|Started Session)/)) {
        const periodMatch = nextLine.match(/within (\d+)\s+(Day|Days|Hour|Hours|Minute|Minutes)/i)
        let period = ''
        if (periodMatch) {
          const unit = unitMap[periodMatch[2].toLowerCase()] ?? ''
          period = `${periodMatch[1]}${unit}`
        }
        const eventName = nextLine.split('within')[0].trim()
        const extraLines: string[] = []
        let j = i + 2
        while (j < lines.length && !/^Conversion Event - [A-D]/i.test(lines[j])) {
          const c = lines[j].trim()
          if (c && c !== 'Property Filters') extraLines.push(c)
          j++
        }
        let propText = ''
        if (extraLines.length === 1) propText = ` [${extraLines[0]}]`
        else if (extraLines.length >= 2) propText = ` [${extraLines[0]}-${extraLines.slice(1).join(', ')}]`
        results.push(`${currentLabel}: ${eventName} (${period})${propText}`)
        i = j - 1
      }
    }
    i++
  }

  return results.join('\n')
}

// --- N열 pre-parsed delivery text splitter (Option B) ---
// N열에는 Apps Script가 이미 포맷한 텍스트가 들어있음:
//   - Type: Action-based
//   - Trigger: Custom Event "..."
//   - Re-eligibility: 1 day
//   - Duration: 2025-01-01 09:00 ~ 2025-12-31 23:59
// 각 줄을 개별 DB 컬럼으로 분리한다.

function splitDeliveryField(text: string): {
  delivery: string    // Type 값 (e.g. "Action-based", "Scheduled")
  trigger: string     // Trigger 값
  cap: string         // Re-eligibility 값
  period: string      // Duration 또는 Start 값
} {
  const lines = text.split('\n').map((l) => l.trim())
  const get = (prefix: string) => {
    const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()))
    return line ? line.slice(prefix.length).trim() : ''
  }
  return {
    delivery: get('- Type:'),
    trigger:  get('- Trigger:'),
    cap:      get('- Re-eligibility:'),
    period:   get('- Duration:') || get('- Start:'),
  }
}

// --- Main handler ---

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
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { clientId } = await req.json() as { clientId: string }
    if (!clientId) return new Response(JSON.stringify({ error: 'Missing clientId' }), { status: 400, headers: corsHeaders })

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Load global sheets config
    const { data: config, error: configErr } = await admin
      .from('sheets_config')
      .select('spreadsheet_id, service_account_secret_id')
      .eq('id', 1)
      .single()
    if (configErr || !config?.spreadsheet_id) throw new Error('Sheets 설정이 없습니다. 설정에서 먼저 저장하세요.')

    // Load client's tab name
    const { data: clientRow, error: clientErr } = await admin
      .from('clients')
      .select('sheets_tab')
      .eq('id', clientId)
      .single()
    if (clientErr || !clientRow?.sheets_tab) throw new Error('이 고객사의 시트 탭 이름이 설정되지 않았습니다.')

    // Get decrypted service account key
    const { data: saKey, error: saErr } = await admin.rpc('get_sheets_service_account')
    if (saErr || !saKey) throw new Error('서비스 계정 키를 불러올 수 없습니다.')

    const sa = JSON.parse(saKey) as ServiceAccount
    const accessToken = await getGoogleAccessToken(sa)

    // sheets_tab은 쉼표 구분 복수 탭 지원 ("코오롱몰 - 캠페인, 코오롱몰 - 캔버스")
    const tabNames = clientRow.sheets_tab.split(',').map((t: string) => t.trim()).filter(Boolean)

    const updatesByBrazeId = new Map<string, Record<string, string>>()
    let rowsWithBrazeId = 0
    for (const tabName of tabNames) {
      // Fetch sheet data (columns A:Q)
      const range = `${tabName}!A:Q`
      const sheetsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!sheetsRes.ok) throw new Error(`Sheets API error ${sheetsRes.status} (tab: ${tabName})`)
      const sheetsData = await sheetsRes.json() as { values?: string[][] }
      const rows = sheetsData.values ?? []

      if (rows.length < 2) continue

      // Skip header row (row 0), process data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const brazeId = cell(row, COL.campaignId)
        if (!brazeId) continue
        rowsWithBrazeId++

        // N열: Apps Script가 이미 포맷한 Delivery 텍스트 → 분리
        const deliveryRaw = cell(row, COL.delivery)
        const { delivery, trigger, cap, period } = splitDeliveryField(deliveryRaw)

        const audience  = cell(row, COL.audience)
        const convEvent = cell(row, COL.convEvent)
        const link      = cell(row, COL.brazeUrl)

        const patch = {
          ...(delivery ? { delivery } : {}),
          ...(trigger ? { trigger_desc: trigger } : {}),
          ...(cap ? { cap } : {}),
          ...(period ? { period } : {}),
          ...(audience && audience !== '(조건 없음)' ? { audience } : {}),
          ...(convEvent ? { conv_event: convEvent } : {}),
          ...(link ? { link } : {}),
        }
        if (Object.keys(patch).length === 0) continue
        updatesByBrazeId.set(brazeId, {
          ...updatesByBrazeId.get(brazeId),
          ...patch,
        })
      }
    }

    const brazeIds = [...updatesByBrazeId.keys()]
    const existingByBrazeId = new Map<string, string[]>()
    for (let i = 0; i < brazeIds.length; i += 200) {
      const batch = brazeIds.slice(i, i + 200)
      const { data, error } = await admin
        .from('campaigns')
        .select('id, braze_id')
        .in('braze_id', batch)
      if (error) throw new Error(`Campaign lookup failed: ${error.message}`)
      for (const campaign of data ?? []) {
        const ids = existingByBrazeId.get(campaign.braze_id) ?? []
        ids.push(campaign.id)
        existingByBrazeId.set(campaign.braze_id, ids)
      }
    }

    const matchingBrazeIds = brazeIds.filter((id) => existingByBrazeId.has(id))
    const unmatchedIds = brazeIds.length - matchingBrazeIds.length
    let updatedCampaigns = 0
    for (let i = 0; i < matchingBrazeIds.length; i += 10) {
      const batch = matchingBrazeIds.slice(i, i + 10)
      const results = await Promise.all(batch.map(async (brazeId) => {
        const { data, error } = await admin
          .from('campaigns')
          .update(updatesByBrazeId.get(brazeId)!)
          .eq('braze_id', brazeId)
          .select('id')
        return { brazeId, count: data?.length ?? 0, error }
      }))
      const failed = results.find((result) => result.error)
      if (failed?.error) throw new Error(`Campaign update failed for ${failed.brazeId}: ${failed.error.message}`)
      updatedCampaigns += results.reduce((total, result) => total + result.count, 0)
    }

    return new Response(JSON.stringify({
      ok: true,
      rowsWithBrazeId,
      uniqueBrazeIds: brazeIds.length,
      updatedCampaigns,
      unmatchedIds,
    }), {
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
