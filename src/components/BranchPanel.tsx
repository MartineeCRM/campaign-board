import { useBoardStore } from '../store'
import type { FunnelNode, LineStyle } from '../types'

const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점점선' },
]

const LINE_SAMPLE: Record<LineStyle, React.CSSProperties> = {
  solid: { borderTop: '2px solid #b0b8c1' },
  dashed: { borderTop: '2px dashed #b0b8c1' },
  dotted: { borderTop: '3px dotted #b0b8c1' },
}

/** The card that appears above a node on hover, listing its alternate
 * (branch) paths — e.g. a dashed "선택 경로" or a dotted "이탈/복귀" path
 * alongside the node's solid main sequence. */
export default function BranchPanel({
  parentNodeId,
  branches,
}: {
  parentNodeId: string
  branches: FunnelNode[]
}) {
  const edit = useBoardStore((s) => s.edit)
  const renameNode = useBoardStore((s) => s.renameNode)
  const setNodeLine = useBoardStore((s) => s.setNodeLine)
  const addBranch = useBoardStore((s) => s.addBranch)
  const deleteBranch = useBoardStore((s) => s.deleteBranch)

  return (
    <div
      style={{
        width: 220,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 10px 28px rgba(0,20,60,.18)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b95a1' }}>분기 경로</div>
      {branches.map((b) => (
        <div
          key={b.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingBottom: 8,
            borderBottom: '1px solid #f2f4f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, flex: 'none', ...LINE_SAMPLE[b.line] }} />
            {edit ? (
              <input
                value={b.label}
                onChange={(e) => renameNode(b.id, { label: e.target.value })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 6,
                }}
              />
            ) : (
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{b.label}</div>
            )}
          </div>
          {edit ? (
            <>
              <input
                value={b.sub}
                onChange={(e) => renameNode(b.id, { sub: e.target.value })}
                style={{
                  fontSize: 10.5,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {LINE_OPTIONS.map((opt) => {
                  const active = b.line === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNodeLine(b.id, opt.value)}
                      style={{
                        flex: 1,
                        fontSize: 10,
                        padding: '3px 0',
                        border: 0,
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: active ? '#191f28' : '#f2f4f6',
                        color: active ? '#fff' : '#4e5968',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => deleteBranch(parentNodeId, b.id)}
                  style={{
                    fontSize: 10,
                    padding: '3px 7px',
                    border: 0,
                    color: '#f04452',
                    background: '#fff0f1',
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10.5, fontFamily: 'ui-monospace, Menlo, monospace', color: '#8b95a1' }}>
              {b.sub}
            </div>
          )}
        </div>
      ))}
      {branches.length === 0 && !edit && (
        <div style={{ fontSize: 11, color: '#b0b8c1' }}>분기 경로 없음</div>
      )}
      {edit && (
        <button
          onClick={() => addBranch(parentNodeId)}
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '6px 0',
            border: '1.5px dashed #b0b8c1',
            background: 'transparent',
            color: '#4e5968',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          + 분기 추가
        </button>
      )}
    </div>
  )
}
