// src/utils/layout.test.ts
import { describe, expect, it } from 'vitest'
import { defaultCardPosition } from './layout'
import { SPINE_Y } from './geometry'

describe('defaultCardPosition', () => {
  it('places the first top card just above the spine', () => {
    const { y } = defaultCardPosition('top', 0)
    expect(y).toBeLessThan(SPINE_Y)
  })

  it('places the first bottom card just below the spine', () => {
    const { y } = defaultCardPosition('bottom', 0)
    expect(y).toBeGreaterThan(SPINE_Y)
  })

  it('stacks later top cards further from the spine (smaller y)', () => {
    const first = defaultCardPosition('top', 0)
    const second = defaultCardPosition('top', 1)
    expect(second.y).toBeLessThan(first.y)
  })

  it('stacks later bottom cards further from the spine (larger y)', () => {
    const first = defaultCardPosition('bottom', 0)
    const second = defaultCardPosition('bottom', 1)
    expect(second.y).toBeGreaterThan(first.y)
  })

  it('never returns a negative y', () => {
    const { y } = defaultCardPosition('top', 5)
    expect(y).toBeGreaterThanOrEqual(0)
  })
})
