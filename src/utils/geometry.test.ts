// src/utils/geometry.test.ts
import { describe, expect, it } from 'vitest'
import { clamp, clampCardPosition, posFromY, SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from './geometry'

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })
  it('clamps above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('clampCardPosition', () => {
  it('keeps a position that fits inside the track', () => {
    const result = clampCardPosition(50, 50, 260, 160, TRACK_WIDTH)
    expect(result).toEqual({ x: 50, y: 50 })
  })
  it('clamps x so the card cannot leave the right edge', () => {
    const result = clampCardPosition(10000, 50, 260, 160, TRACK_WIDTH)
    expect(result.x).toBe(TRACK_WIDTH - 260)
  })
  it('clamps x to 0 on the left edge', () => {
    const result = clampCardPosition(-500, 50, 260, 160, TRACK_WIDTH)
    expect(result.x).toBe(0)
  })
  it('clamps y so the card cannot leave the bottom edge', () => {
    const result = clampCardPosition(10, 10000, 260, 160, TRACK_WIDTH)
    expect(result.y).toBe(TRACK_HEIGHT - 160)
  })
  it('clamps y to 0 on the top edge', () => {
    const result = clampCardPosition(10, -500, 260, 160, TRACK_WIDTH)
    expect(result.y).toBe(0)
  })
})

describe('posFromY', () => {
  it('is "top" when the card center sits above the spine', () => {
    expect(posFromY(SPINE_Y - 200, 160)).toBe('top')
  })
  it('is "bottom" when the card center sits below the spine', () => {
    expect(posFromY(SPINE_Y + 40, 160)).toBe('bottom')
  })
  it('is "bottom" exactly at the spine (center == SPINE_Y)', () => {
    expect(posFromY(SPINE_Y - 80, 160)).toBe('bottom')
  })
})
