import { SPINE_Y, TRACK_HEIGHT } from './geometry'
import type { CardPos } from '../types'

const GAP = 14
const CARD_HEIGHT_ESTIMATE = 160

/** Default (x, y) for a newly created card, stacking outward from the spine
 * so cards added one after another don't overlap. The user can drag the
 * card anywhere afterward. */
export function defaultCardPosition(pos: CardPos, indexInZone: number): { x: number; y: number } {
  const x = 16 + (indexInZone % 2) * 10
  if (pos === 'top') {
    const y = SPINE_Y - 30 - (indexInZone + 1) * (CARD_HEIGHT_ESTIMATE + GAP)
    return { x, y: Math.max(0, y) }
  }
  const y = SPINE_Y + 30 + indexInZone * (CARD_HEIGHT_ESTIMATE + GAP)
  return { x, y: Math.min(TRACK_HEIGHT - CARD_HEIGHT_ESTIMATE, y) }
}
