// src/utils/format.test.ts
import { describe, expect, it } from 'vitest'
import { cardWidth, formatCount, pct } from './format'

describe('pct', () => {
  it('returns an em dash when the denominator is 0', () => {
    expect(pct(0, 0)).toBe('—')
  })
  it('formats a percentage to one decimal place', () => {
    expect(pct(50, 200)).toBe('25.0%')
  })
  it('rounds to one decimal place', () => {
    expect(pct(1, 3)).toBe('33.3%')
  })
})

describe('formatCount', () => {
  it('returns an em dash for 0', () => {
    expect(formatCount(0)).toBe('—')
  })
  it('formats with Korean locale thousands separators', () => {
    expect(formatCount(12480)).toBe('12,480')
  })
})

describe('cardWidth', () => {
  const base = { channel: 'Push', period: '상시', name: '가입 유도' }

  it('is a fixed 252px when collapsed, regardless of content', () => {
    expect(cardWidth(base, false)).toBe(252)
    expect(cardWidth({ channel: 'Email', period: '09.01–09.30', name: '아주 긴 캠페인 이름입니다 테스트' }, false)).toBe(252)
  })

  it('clamps to the 260px minimum for very short content', () => {
    expect(cardWidth({ channel: '', period: '상시', name: '가' }, true)).toBe(260)
  })

  it('clamps to the 380px maximum for very long content', () => {
    const longName = '아주 아주 아주 아주 아주 아주 긴 캠페인 이름 테스트 문자열입니다'
    expect(cardWidth({ channel: 'In-app', period: '09.01–12.31', name: longName }, true)).toBe(380)
  })

  it('does not count "상시" toward the period length', () => {
    const withShi = cardWidth({ channel: 'Push', period: '상시', name: '테스트 캠페인' }, true)
    const withoutPeriod = cardWidth({ channel: 'Push', period: '', name: '테스트 캠페인' }, true)
    expect(withShi).toBe(withoutPeriod)
  })
})
