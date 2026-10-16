import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBoardStore } from '../store'
import { useCardDrag } from '../hooks/useCardDrag'
import { cardWidth } from '../utils/format'
import { boardTrackHeight } from '../utils/geometry'
import CampaignCard from './CampaignCard'
import type { Campaign } from '../types'

const EXPANDED_HEIGHT_ESTIMATE = 270
const COLLAPSED_HEIGHT_ESTIMATE = 48

interface LocatedCampaign { campaign: Campaign; nodeId: string }
interface NodeOffset { x: number; y: number }

function CampaignCardItem({ campaign, x, y, expanded, height, trackHeight }: { campaign: Campaign; x: number; y: number; expanded: boolean; height: number; trackHeight: number }) {
  const measureCardHeight = useBoardStore((s) => s.measureCardHeight)
  const zoom = useBoardStore((s) => s.zoom)
  const width = cardWidth({ channel: campaign.channel, period: campaign.period, name: campaign.name }, expanded)
  const { isDragging, ghostX, ghostY, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useCardDrag(campaign.id, width, height, trackHeight)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = cardRef.current
    if (!element) return
    const report = (measured = element.offsetHeight) => measureCardHeight(campaign.id, Math.ceil(measured))
    report()
    const observer = new ResizeObserver((entries) => report(entries[0]?.contentRect.height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [campaign.id, campaign.images, campaign.img, expanded, measureCardHeight])

  return <>
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ position: 'absolute', left: x, top: y, zIndex: 2, touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'auto', opacity: isDragging ? 0.25 : 1 }}
    >
      <div ref={cardRef}><CampaignCard campaign={campaign} expanded={expanded} notchTop={false} notchBottom={false} /></div>
    </div>
    {isDragging && createPortal(
      <div style={{ position: 'fixed', left: ghostX, top: ghostY, pointerEvents: 'none', zIndex: 9999, opacity: 0.9, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,20,60,.22)', transform: `scale(${zoom * 1.02})`, transformOrigin: 'top left' }}>
        <CampaignCard campaign={campaign} expanded={expanded} notchTop={false} notchBottom={false} />
      </div>, document.body,
    )}
  </>
}

export default function CampaignCardsLayer() {
  const client = useBoardStore((s) => s.currentClient())
  const mode = useBoardStore((s) => s.mode)
  const open = useBoardStore((s) => s.open)
  const zoom = useBoardStore((s) => s.zoom)
  const heights = useBoardStore((s) => s.cardHeights)
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>({})
  const trackHeight = boardTrackHeight([client], open, heights)

  useLayoutEffect(() => {
    const canvas = document.querySelector<HTMLElement>('[data-campaign-canvas]')
    if (!canvas) return
    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect()
      const next: Record<string, NodeOffset> = {}
      canvas.querySelectorAll<HTMLElement>('[data-node-id]').forEach((track) => {
        const rect = track.getBoundingClientRect()
        const id = track.dataset.nodeId
        if (id) next[id] = { x: (rect.left - canvasRect.left) / zoom, y: (rect.top - canvasRect.top) / zoom }
      })
      setNodeOffsets((previous) => {
        const ids = Object.keys(next)
        if (ids.length === Object.keys(previous).length && ids.every((id) => previous[id]?.x === next[id].x && previous[id]?.y === next[id].y)) return previous
        return next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    canvas.querySelectorAll<HTMLElement>('[data-node-id]').forEach((track) => observer.observe(track))
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [client.stages, zoom, trackHeight])

  const campaigns: LocatedCampaign[] = client.stages.flatMap((stage) => stage.nodes.flatMap((node) => node.campaigns.map((campaign) => ({ campaign, nodeId: node.id }))))

  return <div style={{ position: 'absolute', inset: 0, minHeight: trackHeight, pointerEvents: 'none' }}>
    {campaigns.map(({ campaign, nodeId }) => {
      const offset = nodeOffsets[nodeId] ?? { x: 0, y: 0 }
      const x = campaign.boardX ?? offset.x + campaign.x
      const y = campaign.boardY ?? offset.y + campaign.y
      const height = heights[campaign.id] ?? (mode === 'full' || !!open[campaign.id] ? EXPANDED_HEIGHT_ESTIMATE : COLLAPSED_HEIGHT_ESTIMATE)
      return <CampaignCardItem key={campaign.id} campaign={campaign} x={x} y={y} expanded={mode === 'full' || !!open[campaign.id]} height={height} trackHeight={trackHeight} />
    })}
  </div>
}
