import { useBoardStore } from '../store'
import type { FunnelNode, LineStyle } from '../types'

const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점점선' },
]

/** Fan-out offset (from the parent node's dot) for the Nth branch — two
 * rows, stepping right for each pair, so branches visibly diverge from
 * the main spine like a real flowchart fork instead of stacking in place. */
export function branchOffset(index: number): { dx: number; dy: number } {
  const col = Math.floor(index / 2)
  const row = index % 2
  return { dx: 70 + col * 165, dy: row === 0 ? -55 : -120 }
}

/** One branch: a short diagonal connector (styled like the main spine —
 * solid/dashed/dotted) running from the parent node's dot out to a small
 * secondary node box. Always visible, not hidden behind hover, so a
 * branching path reads the same way a forking line does in a diagram
 * tool — you see the fork, not a hint that one exists. */
export default function BranchNode({
  parentNodeId,
  branch,
  dx,
  dy,
  color,
}: {
  parentNodeId: string
  branch: FunnelNode
  /** Endpoint of this branch's connector, relative to the parent node's dot
   * (which the caller positions this component's own container at). */
  dx: number
  dy: number
  color: string
}) {
  const edit = useBoardStore((s) => s.edit)
  const renameNode = useBoardStore((s) => s.renameNode)
  const setNodeLine = useBoardStore((s) => s.setNodeLine)
  const deleteBranch = useBoardStore((s) => s.deleteBranch)

  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: length,
          height: 0,
          borderTop: `2px ${branch.line} ${color}`,
          transformOrigin: '0 0',
          transform: `rotate(${angle}deg)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: dx,
          top: dy,
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 3,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flex: 'none',
            background: '#fff',
            border: `2px solid ${color}`,
          }}
        />
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e8eb',
            borderRadius: 10,
            padding: '6px 9px',
            boxShadow: '0 2px 8px rgba(0,20,60,.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            minWidth: 120,
          }}
        >
          {edit ? (
            <input
              value={branch.label}
              onChange={(e) => renameNode(branch.id, { label: e.target.value })}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 5px',
                border: '1px solid #e5e8eb',
                borderRadius: 6,
                width: 110,
              }}
            />
          ) : (
            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{branch.label}</div>
          )}
          {edit ? (
            <input
              value={branch.sub}
              onChange={(e) => renameNode(branch.id, { sub: e.target.value })}
              style={{
                fontSize: 10,
                fontFamily: 'ui-monospace, Menlo, monospace',
                padding: '2px 5px',
                border: '1px solid #e5e8eb',
                borderRadius: 6,
                width: 110,
              }}
            />
          ) : (
            <div style={{ fontSize: 10, fontFamily: 'ui-monospace, Menlo, monospace', color: '#8b95a1' }}>
              {branch.sub}
            </div>
          )}
          {edit && (
            <div style={{ display: 'flex', gap: 3 }}>
              {LINE_OPTIONS.map((opt) => {
                const active = branch.line === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setNodeLine(branch.id, opt.value)}
                    title={opt.label}
                    style={{
                      flex: 1,
                      fontSize: 9,
                      padding: '2px 0',
                      border: 0,
                      borderRadius: 5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: active ? '#191f28' : '#f2f4f6',
                      color: active ? '#fff' : '#4e5968',
                    }}
                  >
                    {opt.label[0]}
                  </button>
                )
              })}
              <button
                onClick={() => deleteBranch(parentNodeId, branch.id)}
                title="삭제"
                style={{
                  fontSize: 9,
                  padding: '2px 5px',
                  border: 0,
                  color: '#f04452',
                  background: '#fff0f1',
                  fontWeight: 600,
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
