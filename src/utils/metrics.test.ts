import { describe, expect, it } from 'vitest'
import type { Campaign } from '../types'
import { getMetrics } from './metrics'

const campaign: Campaign = {
  id: 'campaign-1', name: 'Test', channel: 'Push', status: 'experiment', pos: 'top', x: 0, y: 0,
  sent: 100, opens: 20, clicks: 5, convs: 8, conversionCounts: [8, 4, 1], period: '',
  delivery: '', trigger: '', audience: '', convEvent: '', cap: '', link: '',
}

describe('getMetrics conversion selection', () => {
  it('uses the primary conversion event by default', () => {
    expect(getMetrics(campaign)[2]).toMatchObject({ label: '전환수', count: '8', rate: '8.0%' })
  })

  it('uses the selected secondary event and its matching week-over-week state', () => {
    const selected = { ...campaign, wowDrops: { conversionCounts: [false, true, false] } }
    expect(getMetrics(selected, 1)[2]).toMatchObject({ label: '전환수 (B)', count: '4', rate: '4.0%', wowDrop: true })
  })

  it('shows combined Canvas exposure and engagement without double counting push body clicks', () => {
    const canvas: Campaign = { ...campaign, brazeType: 'canvas', sent: 62, opens: 10, clicks: 12, convs: 9, conversionCounts: [9],
      canvasSteps: [
        { id: 'push', name: 'Push', channel: 'Push', sent: 50, opens: 10, clicks: 10, engagements: 10, conversionCounts: [2] },
        { id: 'iam', name: 'IAM', channel: 'In-app', sent: 12, opens: 0, clicks: 2, engagements: 2, conversionCounts: [3] },
      ],
    }
    expect(getMetrics(canvas).map(({ label, count }) => [label, count])).toEqual([
      ['노출/발송수', '62'], ['클릭/오픈수', '12'], ['전환수', '5'],
    ])
    expect(getMetrics(canvas)[2].rate).toBeUndefined()
  })

  it('does not relabel the primary Canvas conversion as a missing secondary event', () => {
    expect(getMetrics({ ...campaign, brazeType: 'canvas', conversionCounts: [8], canvasSteps: [] }, 1)[2])
      .toMatchObject({ label: '전환수 (B)', count: '—' })
  })
})
