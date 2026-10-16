import { formatCount, pct } from './format'
import type { Campaign } from '../types'

export interface Metric {
  label: string
  count: string
  rate?: string
  wowDrop?: boolean
}

export function displayedConversionCount(k: Campaign, index: number): number {
  if (k.brazeType === 'canvas') return (k.canvasSteps ?? []).reduce((sum, step) => sum + (step.conversionCounts[index] ?? 0), 0)
  return k.conversionCounts?.[index] ?? (index === 0 ? k.convs : 0)
}

export function getMetrics(k: Campaign, conversionEventIndex = 0): Metric[] {
  const index = Math.max(0, Math.min(4, Math.floor(conversionEventIndex)))
  const conversionCount = displayedConversionCount(k, index)
  const conversionName = index === 0 ? '전환수' : `전환수 (${String.fromCharCode(65 + index)})`
  const conversionMetric: Metric = {
    label: conversionName,
    count: formatCount(conversionCount),
    rate: pct(conversionCount, k.sent),
    wowDrop: k.wowDrops?.conversionCounts?.[index] ?? (index === 0 ? k.wowDrops?.convs : undefined),
  }
  if (k.brazeType === 'canvas') {
    const engagement = k.canvasSteps?.reduce((sum, step) => sum + step.engagements, 0) ?? (k.opens + k.clicks)
    return [
      { label: '노출/발송수', count: formatCount(k.sent), wowDrop: k.wowDrops?.sent },
      { label: '클릭/오픈수', count: formatCount(engagement), rate: pct(engagement, k.sent) },
      { ...conversionMetric, rate: undefined },
    ]
  }
  switch (k.channel) {
    case 'In-app':
    case 'Banner':
      return [
        { label: '노출수', count: formatCount(k.sent), wowDrop: k.wowDrops?.sent },
        { label: '클릭수', count: formatCount(k.clicks), rate: pct(k.clicks, k.sent), wowDrop: k.wowDrops?.clicks },
        conversionMetric,
      ]
    case 'Kakao':
    case 'Webhook':
      return [
        { label: '발송수', count: formatCount(k.sent), wowDrop: k.wowDrops?.sent },
        { label: '—', count: '—' },
        conversionMetric,
      ]
    default:
      // Push
      return [
        { label: '발송수', count: formatCount(k.sent), wowDrop: k.wowDrops?.sent },
        { label: '오픈수', count: formatCount(k.opens), rate: pct(k.opens, k.sent), wowDrop: k.wowDrops?.opens },
        conversionMetric,
      ]
  }
}
