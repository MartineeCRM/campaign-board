import { useCallback, useRef, useState } from 'react'
import { useBoardStore } from '../store'

interface DragPosition {
  dragging: boolean
  x: number
  y: number
}

/** Lets a campaign card be picked up and dropped anywhere inside its node's
 * track. Position updates live in local state while dragging (for a smooth
 * 60fps feel) and commit to the store on release. */
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

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      setDrag((d) => {
        if (!d.dragging) return d
        const dx = e.clientX - origin.current.pointerX
        const dy = e.clientY - origin.current.pointerY
        return { dragging: true, x: origin.current.cardX + dx, y: origin.current.cardY + dy }
      })
    },
    []
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDrag((d) => {
        if (d.dragging) moveCampaignTo(campaignId, d.x, d.y, cardW, cardH, trackW)
        return { ...d, dragging: false }
      })
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [campaignId, cardW, cardH, trackW, moveCampaignTo]
  )

  const liveX = drag.dragging ? drag.x : x
  const liveY = drag.dragging ? drag.y : y

  return { x: liveX, y: liveY, dragging: drag.dragging, onPointerDown, onPointerMove, onPointerUp }
}
