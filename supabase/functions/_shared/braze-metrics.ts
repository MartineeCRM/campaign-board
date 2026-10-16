import { countIamClicks } from './iam-clicks.ts'
import type { DailyMetricCounts } from './wow.ts'

type RecordValue = Record<string, unknown>
type ClickMode = 'first' | 'both'

export interface CanvasStepSummary {
  id: string
  name: string
  channel: string
  sent: number
  opens: number
  clicks: number
  /** Push direct opens, IAM clicks, and the corresponding engagement for other channels. */
  engagements: number
  conversionCounts: number[]
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function firstCount(record: RecordValue, keys: string[]): number {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return numeric(value)
  }
  return 0
}

function sumCount(record: RecordValue, keys: string[]): number {
  return keys.reduce((sum, key) => sum + numeric(record[key]), 0)
}

function conversionCounts(record: RecordValue): number[] {
  const indexes = Object.keys(record)
    .map((key) => /^conversions(\d*)$/.exec(key))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1] === '' ? 0 : Number(match[1]) + 1)
  const count = Math.max(1, ...indexes)
  return Array.from({ length: count }, (_, index) => firstCount(record, [index === 0 ? 'conversions' : `conversions${index}`]))
}

function messageRows(messages: unknown): Array<{ channel: string; stats: RecordValue }> {
  if (!isRecord(messages)) return []
  const rows: Array<{ channel: string; stats: RecordValue }> = []
  for (const [channel, value] of Object.entries(messages)) {
    const values = Array.isArray(value) ? value : [value]
    for (const stats of values) if (isRecord(stats)) rows.push({ channel: channel.toLowerCase(), stats })
  }
  return rows
}

function classify(channel: string): 'iam' | 'content' | 'email' | 'whatsapp' | 'sms' | 'push' | 'other' {
  if (channel.includes('in_app')) return 'iam'
  if (channel.includes('content_card')) return 'content'
  if (channel.includes('email')) return 'email'
  if (channel.includes('whats_app') || channel.includes('whatsapp')) return 'whatsapp'
  if (channel.includes('sms')) return 'sms'
  if (channel.includes('push')) return 'push'
  return 'other'
}

function mapMessageMetrics(rows: Array<{ channel: string; stats: RecordValue }>, clickMode: ClickMode) {
  let sent = 0, opens = 0, clicks = 0
  for (const { channel, stats } of rows) {
    switch (classify(channel)) {
      case 'iam':
        sent += firstCount(stats, ['impressions', 'total_impressions', 'unique_impressions'])
        clicks += countIamClicks({
          body_clicks: numeric(stats.body_clicks),
          first_button_clicks: numeric(stats.first_button_clicks),
          second_button_clicks: numeric(stats.second_button_clicks),
        }, clickMode) || numeric(stats.clicks)
        break
      case 'content':
        sent += firstCount(stats, ['total_impressions', 'unique_impressions', 'impressions', 'sent'])
        clicks += firstCount(stats, ['total_clicks', 'clicks', 'unique_clicks'])
        break
      case 'email':
        sent += numeric(stats.sent)
        opens += firstCount(stats, ['unique_opens', 'opens', 'total_opens'])
        clicks += firstCount(stats, ['unique_clicks', 'clicks', 'body_clicks'])
        break
      case 'whatsapp':
        sent += numeric(stats.sent)
        opens += firstCount(stats, ['read', 'unique_opens', 'opens', 'total_opens'])
        clicks += firstCount(stats, ['clicks', 'unique_clicks', 'body_clicks'])
        break
      case 'sms':
        sent += numeric(stats.sent)
        clicks += firstCount(stats, ['clicks', 'unique_clicks', 'body_clicks'])
        break
      case 'push':
        sent += numeric(stats.sent)
        opens += firstCount(stats, ['direct_opens', 'opens', 'total_opens', 'influenced_opens', 'unique_opens'])
        clicks += firstCount(stats, ['body_clicks', 'clicks', 'unique_clicks'])
        break
      default:
        sent += numeric(stats.sent)
        opens += firstCount(stats, ['total_opens', 'opens', 'read', 'unique_opens', 'direct_opens'])
        clicks += firstCount(stats, ['body_clicks', 'clicks', 'unique_clicks'])
    }
  }
  return { sent, opens, clicks }
}

export function mapCampaignPayload(point: unknown, clickMode: ClickMode): DailyMetricCounts {
  if (!isRecord(point)) return { sent: 0, opens: 0, clicks: 0, convs: 0, conversionCounts: [0] }
  const messages = mapMessageMetrics(messageRows(point.messages), clickMode)
  const counts = conversionCounts(point)
  return {
    ...messages,
    convs: counts[0],
    conversionCounts: counts,
  }
}

export function mapCanvasPayload(point: unknown, clickMode: ClickMode): DailyMetricCounts {
  if (!isRecord(point)) return { sent: 0, opens: 0, clicks: 0, convs: 0, conversionCounts: [0] }
  const steps = isRecord(point.step_stats) ? Object.values(point.step_stats) : []
  const messages = steps.flatMap((step) => isRecord(step) ? messageRows(step.messages) : [])
  const messageMetrics = mapMessageMetrics(messages, clickMode)
  const counts = steps.reduce<number[]>((sum, step) => {
    if (!isRecord(step) || !isRecord(step.messages)) return sum
    const stepCounts = conversionCounts(step)
    return Array.from({ length: Math.max(sum.length, stepCounts.length) },
      (_, index) => (sum[index] ?? 0) + (stepCounts[index] ?? 0))
  }, [0])
  return {
    sent: messageMetrics.sent,
    opens: messageMetrics.opens,
    clicks: messageMetrics.clicks,
    convs: counts[0],
    conversionCounts: counts,
  }
}

function stepChannel(channels: string[]): string {
  const kinds = new Set(channels.map(classify))
  if (kinds.size !== 1) return 'Mixed'
  switch ([...kinds][0]) {
    case 'push': return 'Push'
    case 'iam': return 'In-app'
    case 'content': return 'Banner'
    case 'email': return 'Email'
    case 'sms': return 'SMS'
    case 'whatsapp': return 'WhatsApp'
    default: return channels[0] || 'Other'
  }
}

/** Join Canvas detail metadata to daily step stats by step ID, never by variation ID. */
export function mapCanvasSteps(details: unknown, points: unknown[], clickMode: ClickMode): CanvasStepSummary[] {
  const byId = new Map<string, CanvasStepSummary>()
  const detailSteps = isRecord(details) && Array.isArray(details.steps) ? details.steps : []
  for (const raw of detailSteps) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.messages) || !Object.keys(raw.messages).length) continue
    const channels = Object.values(raw.messages).flatMap((message) => isRecord(message) && typeof message.channel === 'string' ? [message.channel.toLowerCase()] : [])
    byId.set(raw.id, {
      id: raw.id,
      name: typeof raw.name === 'string' && raw.name ? raw.name : raw.id,
      channel: stepChannel(channels),
      sent: 0, opens: 0, clicks: 0, engagements: 0, conversionCounts: [0],
    })
  }
  for (const point of points) {
    if (!isRecord(point) || !isRecord(point.step_stats)) continue
    for (const [id, raw] of Object.entries(point.step_stats)) {
      if (!isRecord(raw)) continue
      const rows = messageRows(raw.messages)
      if (!rows.length && !byId.has(id)) continue
      let step = byId.get(id)
      if (!step) {
        step = { id, name: typeof raw.name === 'string' && raw.name ? raw.name : id,
          channel: stepChannel(rows.map(({ channel }) => channel)),
          sent: 0, opens: 0, clicks: 0, engagements: 0, conversionCounts: [0] }
        byId.set(id, step)
      }
      const metrics = mapMessageMetrics(rows, clickMode)
      step.sent += metrics.sent
      step.opens += metrics.opens
      step.clicks += metrics.clicks
      step.engagements += rows.reduce((sum, row) => {
        const rowMetrics = mapMessageMetrics([row], clickMode)
        const kind = classify(row.channel)
        return sum + (kind === 'push' || kind === 'email' || kind === 'whatsapp' ? rowMetrics.opens : rowMetrics.clicks)
      }, 0)
      const counts = conversionCounts(raw)
      step.conversionCounts = Array.from({ length: Math.max(step.conversionCounts.length, counts.length) },
        (_, index) => (step.conversionCounts[index] ?? 0) + (counts[index] ?? 0))
    }
  }
  return [...byId.values()]
}

export function inspectCanvasPayload(points: unknown[]): Record<string, unknown> {
  const stepIds = new Set<string>()
  const channels = new Set<string>()
  const fields = new Set<string>()
  let pointsWithSteps = 0
  let messageRowsCount = 0
  for (const point of points) {
    if (!isRecord(point) || !isRecord(point.step_stats)) continue
    pointsWithSteps++
    for (const [stepId, step] of Object.entries(point.step_stats)) {
      stepIds.add(stepId)
      if (!isRecord(step)) continue
      for (const { channel, stats } of messageRows(step.messages)) {
        channels.add(channel)
        messageRowsCount++
        Object.keys(stats).forEach((key) => fields.add(key))
      }
    }
  }
  return {
    points: points.length,
    pointsWithSteps,
    stepCount: stepIds.size,
    messageRows: messageRowsCount,
    channels: [...channels].sort(),
    fields: [...fields].sort(),
  }
}
