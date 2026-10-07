import { useBoardStore } from '../store'
import { SPINE_Y, TRACK_HEIGHT } from '../utils/geometry'

export default function AddStageButton() {
  const addStage = useBoardStore((s) => s.addStage)

  return (
    <div style={{ flex: '0 0 auto', width: 140 }}>
      <div style={{ position: 'relative', height: TRACK_HEIGHT }}>
        <div style={{ position: 'absolute', left: 0, width: 40, top: SPINE_Y, borderTop: '2px dashed #b0b8c1' }} />
        <button
          onClick={addStage}
          style={{
            position: 'absolute',
            top: SPINE_Y - 12,
            left: 40,
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 14px',
            border: '1.5px dashed #b0b8c1',
            background: 'transparent',
            color: '#4e5968',
            borderRadius: 999,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + 단계 추가
        </button>
      </div>
    </div>
  )
}
