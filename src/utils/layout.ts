import { SPINE_Y, TRACK_HEIGHT } from './geometry'
import type { CardPos } from '../types'

const GAP = 16
// Matches the measured height of an expanded card with the placeholder
// image (no custom `img` set). Cards with a real image, or collapsed
// chips, render shorter or taller than this — it's a default-placement
// heuristic, not a hard size; the user can always drag a card afterward.
const CARD_HEIGHT_ESTIMATE = 270
// Vertical gap kept clear immediately above/below the spine so a
// newly-placed card never starts on top of the node's own label text.
const TOP_CLEARANCE = 20
const BOTTOM_CLEARANCE = 60

/** Default (x, y) for a newly created card, stacking outward from the spine
 * so cards added one after another don't overlap. The user can drag the
 * card anywhere afterward. */
export function defaultCardPosition(pos: CardPos, indexInZone: number): { x: number; y: number } {
  const x = 16 + (indexInZone % 2) * 10
  if (pos === 'top') {
    const y = SPINE_Y - TOP_CLEARANCE - (indexInZone + 1) * (CARD_HEIGHT_ESTIMATE + GAP)
    return { x, y: Math.max(0, y) }
  }
  const y = SPINE_Y + BOTTOM_CLEARANCE + indexInZone * (CARD_HEIGHT_ESTIMATE + GAP)
  return { x, y: Math.min(TRACK_HEIGHT - CARD_HEIGHT_ESTIMATE, y) }
}
