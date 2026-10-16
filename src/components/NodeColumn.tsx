import { useBoardStore } from '../store'
import { boardTrackHeight, SPINE_Y, TRACK_WIDTH } from '../utils/geometry'
import type { FunnelNode, Stage } from '../types'

export default function NodeColumn({ stage, node }: { stage: Stage; node: FunnelNode }) {
  const edit = useBoardStore((s) => s.edit)
  const trackHeight = useBoardStore((s) => boardTrackHeight([s.currentClient()], s.open, s.cardHeights))
  const renameNode = useBoardStore((s) => s.renameNode)
  const insertNodeAfter = useBoardStore((s) => s.insertNodeAfter)

  return (
    <div style={{ flex: '0 0 auto', minWidth: 284, padding: '0 16px', boxSizing: 'border-box' }}>
      {/* data-node-id marks this track for cross-node drop detection */}
      <div
        data-node-id={node.id}
        style={{
          position: 'relative',
          width: TRACK_WIDTH,
          height: trackHeight,
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
                <input
                  value={node.label}
                  onChange={(e) => renameNode(node.id, { label: e.target.value })}
                  style={{ width: 200, textAlign: 'center', fontSize: 14, fontWeight: 700, padding: '3px 6px', border: '1px solid #e5e8eb', borderRadius: 8 }}
                />
              </div>
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

      </div>
    </div>
  )
}
