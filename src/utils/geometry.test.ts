import { describe, expect, it } from 'vitest'
import { boardPositionFromGhost, clampCardPosition, trackHeightForCards } from './geometry'

describe('campaign image card geometry', () => {
  it('clamps a tall card inside an expanded track and preserves horizontal bounds', () => {
    expect(clampCardPosition(999, 999, 260, 700, 400, 1500)).toEqual({ x: 140, y: 800 })
  })
  it('extends the track to contain measured card bottoms', () => {
    expect(trackHeightForCards([{ y: 900, height: 700 }])).toBeGreaterThanOrEqual(1648)
  })
  it('converts a viewport ghost position to board coordinates independent of node columns', () => {
    expect(boardPositionFromGhost(500, 300, { left: 100, top: 60 }, 2)).toEqual({ x: 200, y: 120 })
  })
})
