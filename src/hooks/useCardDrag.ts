import { useCallback, useRef, useState } from 'react'
import { useBoardStore } from '../store'

interface DragPosition {
  dragging: boolean
  x: number
  y: number
}

/** Lets a campaign card be picked up and dropped anywhere inside its node's
 * track. Position updates live in local state while dragging (for a smooth
 * 60fps feel) and commit to the store on release.
 *
 * Pointer capture engages immediately on pointerdown. An earlier version
 * deferred capture until the pointer moved past a threshold, to avoid
 * stealing the card's own click (which opened the detail panel) — but that
 * left a window, before the threshold was crossed, where a fast drag could
 * move the cursor off the wrapper before capture engaged, so the element
 * stopped receiving pointermove/pointerup entirely and the drag silently
 * did nothing. Opening the detail panel is now a dedicated chevron button
 * (see CampaignCard) that stops pointerdown propagation, so the card body
 * has no click of its own left to protect, and capturing immediately is
 * both simpler and more reliable.
 *
 * Drag deltas from e.clientX/Y are in viewport pixels. The board applies a
 * CSS zoom to its inner container, so card positions (CSS px inside the
 * zoomed element) and viewport px differ by the zoom factor. We capture the
 * zoom at drag-start and divide deltas by it so the card follows the pointer
 * 1:1 at any zoom level.
 */
export function useCardDrag(
  campaignId: string,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  trackW: number
) {
  const moveCampaignTo = useBoardStore((s) => s.moveCampaignTo)
  const zoom = useBoardStore((s) => s.zoom)
  const [drag, setDrag] = useState<DragPosition>({ dragging: false, x, y })
  const origin = useRef({ pointerX: 0, pointerY: 0, cardX: x, cardY: y, zoom: 1 })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      origin.current = { pointerX: e.clientX, pointerY: e.clientY, cardX: x, cardY: y, zoom }
      setDrag({ dragging: true, x, y })
    },
    [x, y, zoom]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    setDrag((d) => {
      if (!d.dragging) return d
      const z = origin.current.zoom
      const dx = (e.clientX - origin.current.pointerX) / z
      const dy = (e.clientY - origin.current.pointerY) / z
      return { dragging: true, x: origin.current.cardX + dx, y: origin.current.cardY + dy }
    })
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDrag((d) => {
        if (d.dragging) moveCampaignTo(campaignId, d.x, d.y, cardW, cardH, trackW)
        return { ...d, dragging: false }
      })
      const el = e.currentTarget as HTMLElement
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    },
    [campaignId, cardW, cardH, trackW, moveCampaignTo]
  )

  const liveX = drag.dragging ? drag.x : x
  const liveY = drag.dragging ? drag.y : y

  return { x: liveX, y: liveY, dragging: drag.dragging, onPointerDown, onPointerMove, onPointerUp }
}
