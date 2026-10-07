import { useCallback, useRef, useState } from 'react'
import { useBoardStore } from '../store'

interface DragPosition {
  dragging: boolean
  x: number
  y: number
}

// Pixels of pointer movement required before a press is treated as a drag
// rather than a plain click.
const DRAG_THRESHOLD = 4

/** Lets a campaign card be picked up and dropped anywhere inside its node's
 * track. Position updates live in local state while dragging (for a smooth
 * 60fps feel) and commit to the store on release.
 *
 * Pointer capture is deferred until the pointer actually moves past
 * DRAG_THRESHOLD, rather than being engaged on every pointerdown. Capturing
 * immediately on pointerdown made Chromium retarget the compatibility
 * "click" event (and its mouseup) to this wrapper element once the pointer
 * was released, instead of letting it bubble from the real hit-tested
 * target — which has no capture-aware handler — through CampaignCard's
 * inner onClick. That silently broke every plain click on a card (opening
 * the detail panel, and "클릭 노출" chip-to-expand), since a pointerdown
 * always precedes a click. Deferring capture to confirmed drags leaves
 * plain clicks completely untouched by pointer capture, so they dispatch
 * and bubble normally.
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
  // Mirrors `drag` outside React state so onPointerUp/onPointerMove can read
  // and update the latest position synchronously without calling the
  // store's moveCampaignTo action from inside a setState functional
  // updater (which previously triggered React's "Cannot update a component
  // while rendering a different component" warning).
  const live = useRef({ dragging: false, x, y })
  const pressed = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pressed.current = true
      origin.current = { pointerX: e.clientX, pointerY: e.clientY, cardX: x, cardY: y }
    },
    [x, y]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pressed.current) return
      const dx = e.clientX - origin.current.pointerX
      const dy = e.clientY - origin.current.pointerY
      if (!live.current.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
      const next = { dragging: true, x: origin.current.cardX + dx, y: origin.current.cardY + dy }
      live.current = next
      setDrag(next)
    },
    []
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasDragging = live.current.dragging
      const { x: finalX, y: finalY } = live.current
      pressed.current = false
      live.current = { ...live.current, dragging: false }
      if (wasDragging) {
        setDrag((d) => ({ ...d, dragging: false }))
        moveCampaignTo(campaignId, finalX, finalY, cardW, cardH, trackW)
        const el = e.currentTarget as HTMLElement
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      }
    },
    [campaignId, cardW, cardH, trackW, moveCampaignTo]
  )

  const liveX = drag.dragging ? drag.x : x
  const liveY = drag.dragging ? drag.y : y

  return { x: liveX, y: liveY, dragging: drag.dragging, onPointerDown, onPointerMove, onPointerUp }
}
