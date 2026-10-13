import { useCallback, useRef, useState } from 'react'
import { useBoardStore } from '../store'
import { TRACK_WIDTH } from '../utils/geometry'

interface Ghost {
  x: number // viewport left of card
  y: number // viewport top of card
}

/**
 * Cross-node drag-and-drop for campaign cards.
 *
 * During drag the card renders as a fixed-position ghost (via a portal in
 * NodeColumn). The original slot stays where it is with reduced opacity as a
 * placeholder. On pointer-up we query every [data-node-id] track element to
 * find which node is under the drop point, translate the viewport coords back
 * to that track's local canvas coords, and call either moveCampaignTo (same
 * node) or moveCampaignToNode (different node).
 *
 * Drag deltas from e.clientX/Y are in viewport pixels. The board applies a
 * CSS zoom to its container, so card positions (CSS px inside the zoomed
 * element) differ by the zoom factor. We capture zoom at drag-start and
 * divide deltas by it so the ghost follows the pointer 1:1.
 */
export function useCardDrag(
  campaignId: string,
  nodeId: string,
  _x: number,
  _y: number,
  cardW: number,
  cardH: number,
) {
  const moveCampaignTo = useBoardStore((s) => s.moveCampaignTo)
  const moveCampaignToNode = useBoardStore((s) => s.moveCampaignToNode)
  const zoom = useBoardStore((s) => s.zoom)

  const [isDragging, setIsDragging] = useState(false)
  const [ghost, setGhost] = useState<Ghost>({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const origin = useRef({ pointerX: 0, pointerY: 0, ghostX: 0, ghostY: 0, zoom: 1, nodeId: '' })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      el.setPointerCapture(e.pointerId)
      origin.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        ghostX: rect.left,
        ghostY: rect.top,
        zoom,
        nodeId,
      }
      setGhost({ x: rect.left, y: rect.top })
      isDraggingRef.current = true
      setIsDragging(true)
    },
    [zoom, nodeId],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - origin.current.pointerX
    const dy = e.clientY - origin.current.pointerY
    setGhost({ x: origin.current.ghostX + dx, y: origin.current.ghostY + dy })
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = false
      setIsDragging(false)
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

      const dx = e.clientX - origin.current.pointerX
      const dy = e.clientY - origin.current.pointerY
      const z = origin.current.zoom
      const ghostX = origin.current.ghostX + dx
      const ghostY = origin.current.ghostY + dy

      // Find which node track the ghost was dropped onto by checking bounding
      // rects of every [data-node-id] element. The ghost itself is
      // position:fixed and pointer-events:none so it doesn't interfere.
      let targetNodeId: string | null = null
      let targetRect: DOMRect | null = null
      for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          targetNodeId = el.dataset.nodeId ?? null
          targetRect = r
          break
        }
      }

      if (!targetNodeId || !targetRect) return // dropped outside any track

      // Translate viewport ghost position → local canvas coords of target track
      const newX = (ghostX - targetRect.left) / z
      const newY = (ghostY - targetRect.top) / z

      if (targetNodeId === origin.current.nodeId) {
        moveCampaignTo(campaignId, newX, newY, cardW, cardH, TRACK_WIDTH)
      } else {
        moveCampaignToNode(campaignId, targetNodeId, newX, newY, cardW, cardH, TRACK_WIDTH)
      }
    },
    [campaignId, cardW, cardH, moveCampaignTo, moveCampaignToNode],
  )

  return { isDragging, ghostX: ghost.x, ghostY: ghost.y, onPointerDown, onPointerMove, onPointerUp }
}
