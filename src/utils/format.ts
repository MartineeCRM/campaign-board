const HANGUL = /[ㄱ-힝]/

export function pct(count: number, total: number): string {
  return total ? (count / total * 100).toFixed(1) + '%' : '—'
}

export function formatCount(n: number): string {
  return n ? n.toLocaleString('ko-KR') : '—'
}

export function cardWidth(
  params: { channel: string; period: string; name: string },
  expanded: boolean
): number {
  if (!expanded) return 252
  const periodLen = params.period === '상시' ? 0 : params.period.length
  const nameWeight = [...params.name].reduce(
    (sum, ch) => sum + (HANGUL.test(ch) ? 15 : 8.5),
    0
  )
  const raw = 52 + params.channel.length * 7 + periodLen * 7 + nameWeight
  return Math.round(Math.min(380, Math.max(260, raw)))
}
