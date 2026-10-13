import { createPortal } from 'react-dom'
import { useBoardStore } from '../store'
import { useCardDrag } from '../hooks/useCardDrag'
import { cardWidth } from '../utils/format'
import { SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from '../utils/geometry'
import CampaignCard from './CampaignCard'
import type { Campaign, FunnelNode, Stage } from '../types'

const EXPANDED_HEIGHT_ESTIMATE = 270
const COLLAPSED_HEIGHT_ESTIMATE = 48

interface DraggableCardProps {
  campaign: Campaign
  nodeId: string
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

function DraggableCard({ campaign, nodeId, expanded, notchTop, notchBottom }: DraggableCardProps) {
  const width = cardWidth({ channel: campaign.channel, period: campaign.period, name: campaign.name }, expanded)
  const height = expanded ? EXPANDED_HEIGHT_ESTIMATE : COLLAPSED_HEIGHT_ESTIMATE
  const { isDragging, ghostX, ghostY, onPointerDown, onPointerMove, onPointerUp } =
    useCardDrag(campaign.id, nodeId, campaign.x, campaign.y, width, height)

  return (
    <>
      {/* Original slot — stays at stored position, fades to placeholder during drag */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: 'absolute',
          left: campaign.x,
          top: campaign.y,
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1,
          opacity: isDragging ? 0.25 : 1,
        }}
      >
        <CampaignCard campaign={campaign} expanded={expanded} notchTop={notchTop} notchBottom={notchBottom} />
      </div>

      {/* Ghost — rendered into document.body so it floats above the whole board */}
      {isDragging &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: ghostX,
              top: ghostY,
              pointerEvents: 'none',
              zIndex: 9999,
              opacity: 0.9,
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(0,20,60,.22)',
            }}
          >
            <CampaignCard campaign={campaign} expanded={expanded} notchTop={false} notchBottom={false} />
          </div>,
          document.body,
        )}
    </>
  )
}

export default function NodeColumn({ stage, node }: { stage: Stage; node: FunnelNode }) {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const open = useBoardStore((s) => s.open)
  const renameNode = useBoardStore((s) => s.renameNode)
  const insertNodeAfter = useBoardStore((s) => s.insertNodeAfter)

  const top = node.campaigns.filter((c) => c.pos === 'top')
  const bottom = node.campaigns.filter((c) => c.pos === 'bottom')
  const closestTopId = top.length ? top.reduce((a, b) => (a.y > b.y ? a : b)).id : null
  const closestBottomId = bottom.length ? bottom.reduce((a, b) => (a.y < b.y ? a : b)).id : null

  return (
    <div style={{ flex: '0 0 auto', minWidth: 284, padding: '0 16px', boxSizing: 'border-box' }}>
      {/* data-node-id marks this track for cross-node drop detection */}
      <div
        data-node-id={node.id}
        style={{
          position: 'relative',
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: SPINE_Y, borderTop: `3px ${node.line} ${stage.color}` }} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: SPINE_Y - 7,
            width: 10,
            height: 10,
            marginLeft: -8,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 4px #f2f4f6',
            border: `3px solid ${stage.color}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: SPINE_Y + 17,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            textAlign: 'center',
          }}
        >
          {edit ? (
            <>
              <input
                value={node.label}
                onChange={(e) => renameNode(node.id, { label: e.target.value })}
                style={{
                  width: 200,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 8,
                }}
              />
              <input
                value={node.sub}
                onChange={(e) => renameNode(node.id, { sub: e.target.value })}
                style={{
                  width: 200,
                  textAlign: 'center',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 8,
                  color: '#5a5a58',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-.01em' }}>{node.label}</div>
              <div style={{ fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: '#8b95a1' }}>
                {node.sub}
              </div>
            </>
          )}
        </div>

        {edit && (
          <button
            onClick={() => insertNodeAfter(node.id)}
            title="뒤에 노드 추가"
            style={{
              position: 'absolute',
              right: -11,
              top: SPINE_Y - 10,
              zIndex: 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: 0,
              background: '#191f28',
              color: '#fff',
              boxShadow: '0 2px 6px rgba(0,20,60,.2)',
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            +
          </button>
        )}

        {top.map((c) => (
          <DraggableCard
            key={c.id}
            campaign={c}
            nodeId={node.id}
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={false}
            notchBottom={c.id === closestTopId}
          />
        ))}
        {bottom.map((c) => (
          <DraggableCard
            key={c.id}
            campaign={c}
            nodeId={node.id}
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={c.id === closestBottomId}
            notchBottom={false}
          />
        ))}
      </div>
    </div>
  )
}
