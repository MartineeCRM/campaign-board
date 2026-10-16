export type DailyMetricCounts = {
  sent: number
  opens: number
  clicks: number
  convs: number
  conversionCounts: number[]
}

export type WowDrops = Partial<Record<'sent' | 'opens' | 'clicks' | 'convs', boolean>> & {
  conversionCounts?: boolean[]
}

/** Compare the 7 complete days ending at endingDate with the preceding 7 days.
 * A metric is omitted when any day is missing or the baseline is zero. */
export function getWowDrops(
  daily: { date: string; metrics: DailyMetricCounts }[],
  endingDate: string,
): WowDrops {
  const byDate = new Map(daily.map((point) => [point.date.slice(0, 10), point.metrics]))
  const dates: string[] = []
  const end = new Date(`${endingDate.slice(0, 10)}T00:00:00.000Z`)
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - offset)
    dates.push(date.toISOString().slice(0, 10))
  }
  if (dates.some((date) => !byDate.has(date))) return {}

  const keys: ('sent' | 'opens' | 'clicks' | 'convs')[] = ['sent', 'opens', 'clicks', 'convs']
  const drops: WowDrops = {}
  for (const key of keys) {
    const previous = dates.slice(0, 7).reduce((sum, date) => sum + byDate.get(date)![key], 0)
    const current = dates.slice(7).reduce((sum, date) => sum + byDate.get(date)![key], 0)
    if (previous > 0) drops[key] = current <= previous * 0.8
  }
  const conversionCount = Math.max(1, ...dates.map((date) => byDate.get(date)!.conversionCounts.length))
  drops.conversionCounts = Array.from({ length: conversionCount }, (_, index) => {
    const previous = dates.slice(0, 7).reduce((sum, date) => sum + (byDate.get(date)!.conversionCounts[index] ?? 0), 0)
    const current = dates.slice(7).reduce((sum, date) => sum + (byDate.get(date)!.conversionCounts[index] ?? 0), 0)
    return previous > 0 && current <= previous * 0.8
  })
  return drops
}
