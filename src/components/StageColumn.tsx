import { useBoardStore } from '../store'
import { SPINE_Y, TRACK_HEIGHT } from '../utils/geometry'
import type { Stage } from '../types'

export default function StageColumn({ stage }: { stage: Stage }) {
  const edit = useBoardStore((s) => s.edit)
  const renameStage = useBoardStore((s) => s.renameStage)
  const cycleStageColor = useBoardStore((s) => s.cycleStageColor)
  const moveStage = useBoardStore((s) => s.moveStage)
  const addNode = useBoardStore((s) => s.addNode)
  const deleteStage = useBoardStore((s) => s.deleteStage)

  return (
    <div style={{ flex: '0 0 auto', minWidth: 110, padding: '0 14px', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', height: TRACK_HEIGHT }}>
        <div style={{ position: 'absolute', left: -14, right: -14, top: SPINE_Y, borderTop: `3px solid ${stage.color}` }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: SPINE_Y - 15,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {edit ? (
            <input
              value={stage.name}
              onChange={(e) => renameStage(stage.id, e.target.value)}
              style={{
                width: 96,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                padding: '6px 10px',
                border: 0,
                borderRadius: 999,
                background: stage.color,
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                padding: '7px 16px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: stage.color,
              }}
            >
              {stage.name}
            </div>
          )}
        </div>
      </div>
      {edit && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: 96 }}>
            <button onClick={() => moveStage(stage.id, -1)} style={smallBtn}>
              ◀
            </button>
            <button onClick={() => moveStage(stage.id, 1)} style={smallBtn}>
              ▶
            </button>
            <button onClick={() => cycleStageColor(stage.id)} style={{ ...smallBtn, gridColumn: '1 / 3' }}>
              색상 변경
            </button>
            <button onClick={() => addNode(stage.id)} style={{ ...smallBtn, gridColumn: '1 / 3' }}>
              + 노드
            </button>
            <button
              onClick={() => deleteStage(stage.id)}
              style={{ ...smallBtn, gridColumn: '1 / 3', color: '#f04452', background: '#fff0f1' }}
            >
              단계 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  fontSize: 11,
  padding: 4,
  border: 0,
  background: '#f2f4f6',
  color: '#4e5968',
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
}
