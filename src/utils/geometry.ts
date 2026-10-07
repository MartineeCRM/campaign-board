// Node track geometry. Each node column renders one continuous vertical
// track; the spine sits at a fixed y inside it, and campaign cards are
// absolutely positioned (x, y) inside the track instead of the handoff's
// button-ordered top/bottom lists, per the "freeform placement" requirement.
export const TRACK_WIDTH = 400
// An expanded campaign card (the README's design, with the placeholder
// image block) renders at ~266px tall. TRACK_HEIGHT and SPINE_Y are sized
// to comfortably stack two such cards on each side of the spine, with
// clearance so cards never cover the node's own label text.
export const TRACK_HEIGHT = 1250
export const SPINE_Y = 600

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
