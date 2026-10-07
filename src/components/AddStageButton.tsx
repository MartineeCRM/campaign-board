import { useBoardStore } from '../store'

export default function AddStageButton() {
  const addStage = useBoardStore((s) => s.addStage)

  return (
    <div style={{ gridRow: '1 / 4', display: 'grid', gridTemplateRows: 'subgrid', width: 140 }}>
      <div />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', left: 0, width: 40, top: 27, borderTop: '2px dashed #b0b8c1' }} />
        <button
          onClick={addStage}
          style={{
            position: 'absolute',
            top: 15,
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
      <div />
    </div>
  )
}
