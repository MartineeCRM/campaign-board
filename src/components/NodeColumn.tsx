import { useBoardStore } from '../store'
import { useCardDrag } from '../hooks/useCardDrag'
import { cardWidth } from '../utils/format'
import { SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from '../utils/geometry'
import CampaignCard from './CampaignCard'
import type { Campaign, FunnelNode, Stage } from '../types'

// Matches an expanded card with the placeholder image; collapsed chips are
// much shorter. Only used to clamp drag bounds, not to measure real layout —
// a card with a tall custom image can still visually extend past this.
const EXPANDED_HEIGHT_ESTIMATE = 270
const COLLAPSED_HEIGHT_ESTIMATE = 48

interface DraggableCardProps {
  campaign: Campaign
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

function DraggableCard({ campaign, expanded, notchTop, notchBottom }: DraggableCardProps) {
  const width = cardWidth({ channel: campaign.channel, period: campaign.period, name: campaign.name }, expanded)
  const height = expanded ? EXPANDED_HEIGHT_ESTIMATE : COLLAPSED_HEIGHT_ESTIMATE
  const drag = useCardDrag(campaign.id, campaign.x, campaign.y, width, height, TRACK_WIDTH)

  return (
    <div
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      style={{
        position: 'absolute',
        left: drag.x,
        top: drag.y,
        touchAction: 'none',
        cursor: drag.dragging ? 'grabbing' : 'grab',
        zIndex: drag.dragging ? 5 : 1,
      }}
    >
      <CampaignCard campaign={campaign} expanded={expanded} notchTop={notchTop} notchBottom={notchBottom} />
    </div>
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
  // "closest to the spine" picks the notch target: for top cards that's the
  // largest y (nearest the spine from above); for bottom cards, the smallest y.
  const closestTopId = top.length ? top.reduce((a, b) => (a.y > b.y ? a : b)).id : null
  const closestBottomId = bottom.length ? bottom.reduce((a, b) => (a.y < b.y ? a : b)).id : null

  return (
    <div
      style={{
        flex: '0 0 auto',
        minWidth: 284,
        padding: '0 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
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
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={false}
            notchBottom={c.id === closestTopId}
          />
        ))}
        {bottom.map((c) => (
          <DraggableCard
            key={c.id}
            campaign={c}
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={c.id === closestBottomId}
            notchBottom={false}
          />
        ))}

      </div>
    </div>
  )
}
