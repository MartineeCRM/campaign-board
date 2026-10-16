import { describe, expect, it } from 'vitest'
import { getWowDrops } from './wow.ts'

function daysThrough(endDate: string, build: (index: number) => number) {
  const end = new Date(`${endDate}T00:00:00Z`)
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (13 - index))
    const value = build(index)
    return { date: date.toISOString().slice(0, 10), metrics: { sent: value, opens: value, clicks: value, convs: value, conversionCounts: [value, value * 2] } }
  })
}

describe('WoW declines', () => {
  it('flags a drop of 20% or more for each metric independently', () => {
    const daily = daysThrough('2026-10-13', (index) => index < 7 ? 10 : index === 7 ? 8 : 7)
    expect(getWowDrops(daily, '2026-10-13')).toEqual({ sent: true, opens: true, clicks: true, convs: true, conversionCounts: [true, true] })
  })

  it('does not flag a smaller decline or a zero baseline', () => {
    const daily = daysThrough('2026-10-13', (index) => index < 7 ? 10 : 9)
    daily.forEach((point) => { point.metrics.convs = 0 })
    expect(getWowDrops(daily, '2026-10-13')).toEqual({ sent: false, opens: false, clicks: false, conversionCounts: [false, false] })
  })

  it('waits for complete daily coverage', () => {
    expect(getWowDrops(daysThrough('2026-10-13', () => 10).slice(1), '2026-10-13')).toEqual({})
  })
})
