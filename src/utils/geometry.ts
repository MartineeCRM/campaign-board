// Node track geometry. Each node column renders one continuous vertical
// track; the spine sits at a fixed y inside it, and campaign cards are
// absolutely positioned (x, y) inside the track instead of the handoff's
// button-ordered top/bottom lists, per the "freeform placement" requirement.
export const TRACK_WIDTH = 400
export const TRACK_HEIGHT = 460
export const SPINE_Y = 230

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampCardPosition(
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  trackW: number
): { x: number; y: number } {
  return {
    x: clamp(x, 0, Math.max(0, trackW - cardW)),
    y: clamp(y, 0, Math.max(0, TRACK_HEIGHT - cardH)),
  }
}

export function posFromY(y: number, cardH: number): 'top' | 'bottom' {
  return y + cardH / 2 < SPINE_Y ? 'top' : 'bottom'
}
