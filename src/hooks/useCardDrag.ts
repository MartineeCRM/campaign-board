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
  const [drag, setDrag] = useState<DragPosition>({ dragging: false, x, y })
  const origin = useRef({ pointerX: 0, pointerY: 0, cardX: x, cardY: y })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      origin.current = { pointerX: e.clientX, pointerY: e.clientY, cardX: x, cardY: y }
      setDrag({ dragging: true, x, y })
    },
    [x, y]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    setDrag((d) => {
      if (!d.dragging) return d
      const dx = e.clientX - origin.current.pointerX
      const dy = e.clientY - origin.current.pointerY
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
