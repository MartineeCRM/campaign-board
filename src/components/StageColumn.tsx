import { useBoardStore } from '../store'
import { SPINE_Y, TRACK_HEIGHT } from '../utils/geometry'
import type { Stage } from '../types'

export default function StageColumn({ stage }: { stage: Stage }) {
  const edit = useBoardStore((s) => s.edit)
  const renameStage = useBoardStore((s) => s.renameStage)

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
    </div>
  )
}

