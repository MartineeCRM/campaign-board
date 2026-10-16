import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../store'
import { boardPositionFromGhost, clampCardPosition } from '../utils/geometry'

interface Ghost { x: number; y: number }

/** Move a card anywhere on the board canvas; its source node does not limit placement. */
export function useCardDrag(campaignId: string, cardW: number, cardH: number, trackH: number) {
  const moveCampaignOnBoard = useBoardStore((s) => s.moveCampaignOnBoard)
  const zoom = useBoardStore((s) => s.zoom)
  const [isDragging, setIsDragging] = useState(false)
  const [ghost, setGhost] = useState<Ghost>({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const activePointer = useRef<{ element: HTMLElement; id: number } | null>(null)
  const origin = useRef({ pointerX: 0, pointerY: 0, ghostX: 0, ghostY: 0, zoom: 1 })

  const cancelDrag = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    const pointer = activePointer.current
    activePointer.current = null
    if (pointer?.element.hasPointerCapture(pointer.id)) pointer.element.releasePointerCapture(pointer.id)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelDrag()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDragging, cancelDrag])

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    const element = event.currentTarget as HTMLElement
    const rect = element.getBoundingClientRect()
    element.setPointerCapture(event.pointerId)
    activePointer.current = { element, id: event.pointerId }
    origin.current = { pointerX: event.clientX, pointerY: event.clientY, ghostX: rect.left, ghostY: rect.top, zoom }
    setGhost({ x: rect.left, y: rect.top })
    isDraggingRef.current = true
    setIsDragging(true)
  }, [zoom])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    setGhost({
      x: origin.current.ghostX + event.clientX - origin.current.pointerX,
      y: origin.current.ghostY + event.clientY - origin.current.pointerY,
    })
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    const element = event.currentTarget as HTMLElement
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    activePointer.current = null

    const dx = event.clientX - origin.current.pointerX
    const dy = event.clientY - origin.current.pointerY
    const ghostX = origin.current.ghostX + dx
    const ghostY = origin.current.ghostY + dy
    const canvas = document.querySelector<HTMLElement>('[data-campaign-canvas]')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = origin.current.zoom
    const position = boardPositionFromGhost(ghostX, ghostY, rect, scale)
    const width = rect.width / scale
    const height = Math.max(trackH, rect.height / scale)
    const bounded = clampCardPosition(position.x, position.y, cardW, cardH, width, height)
    moveCampaignOnBoard(campaignId, bounded.x, bounded.y)
  }, [campaignId, cardW, cardH, trackH, moveCampaignOnBoard])

  const onPointerCancel = useCallback((event: React.PointerEvent) => {
    isDraggingRef.current = false
    setIsDragging(false)
    const element = event.currentTarget as HTMLElement
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    activePointer.current = null
  }, [])

  return { isDragging, ghostX: ghost.x, ghostY: ghost.y, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
