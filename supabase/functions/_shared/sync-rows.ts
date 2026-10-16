import type { DailyMetricCounts } from './wow.ts'

export function dailyMetricRow(campaignId: string, date: string, metrics: DailyMetricCounts) {
  return {
    campaign_id: campaignId, date,
    sent: metrics.sent, opens: metrics.opens, clicks: metrics.clicks, convs: metrics.convs,
    conversion_counts: metrics.conversionCounts,
  }
}

export function describeSyncError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : ''
    return `${code}${error.message}`
  }
  return String(error)
}
