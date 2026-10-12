import { useState } from 'react'
import { useBoardStore, STAGE_PALETTE } from '../store'

export default function BoardStructurePanel() {
  const client = useBoardStore((s) => s.currentClient())
  const selectedStageId = useBoardStore((s) => s.selectedStageId)
  const selectStage = useBoardStore((s) => s.selectStage)
  const addStage = useBoardStore((s) => s.addStage)
  const renameStage = useBoardStore((s) => s.renameStage)
  const cycleStageColor = useBoardStore((s) => s.cycleStageColor)
  const moveStage = useBoardStore((s) => s.moveStage)
  const deleteStage = useBoardStore((s) => s.deleteStage)
  const addNode = useBoardStore((s) => s.addNode)
  const renameNode = useBoardStore((s) => s.renameNode)
  const moveNode = useBoardStore((s) => s.moveNode)
  const deleteNode = useBoardStore((s) => s.deleteNode)

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const selectedStage = client.stages.find((s) => s.id === selectedStageId) ?? client.stages[0] ?? null

  // Auto-select first stage if nothing selected
  if (!selectedStageId && client.stages.length > 0 && selectedStage) {
    // Will be set on first render via the chip click logic below
  }

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    height: '100%',
    overflow: 'hidden',
  }

  const sectionStyle: React.CSSProperties = {
    padding: '20px 20px 16px',
    borderBottom: '1px solid #f2f4f6',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#8b95a1',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: 10,
  }

  const addBtn: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: '#3182f6',
    background: '#eef4ff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  }

  return (
    <div style={panelStyle}>
      {/* 헤더 */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f2f4f6' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#191f28' }}>보드 구조</div>
        <div style={{ fontSize: 12, color: '#8b95a1', marginTop: 3 }}>단계와 노드를 설정합니다</div>
      </div>

      {/* 단계 선택 */}
      <div style={sectionStyle}>
        <div style={labelStyle}>단계</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {client.stages.map((stage) => {
            const active = (selectedStageId ?? client.stages[0]?.id) === stage.id
            return (
              <button
                key={stage.id}
                onClick={() => selectStage(stage.id)}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: `2px solid ${active ? stage.color : 'transparent'}`,
                  background: active ? stage.color : '#f2f4f6',
                  color: active ? '#fff' : '#4e5968',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {stage.name}
              </button>
            )
          })}
          <button
            onClick={() => { addStage(); }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 20,
              border: '2px dashed #d1d6db',
              background: 'transparent',
              color: '#8b95a1',
              cursor: 'pointer',
            }}
          >
            + 단계
          </button>
        </div>
      </div>

      {/* 선택된 단계 설정 */}
      {selectedStage && (
        <>
          <div style={sectionStyle}>
            <div style={labelStyle}>{selectedStage.name} 설정</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 이름 */}
              <div>
                <div style={{ fontSize: 12, color: '#4e5968', marginBottom: 4 }}>이름</div>
                <input
                  value={selectedStage.name}
                  onChange={(e) => renameStage(selectedStage.id, e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #e5e8eb', borderRadius: 8, boxSizing: 'border-box' }}
                />
              </div>

              {/* 색상 */}
              <div>
                <div style={{ fontSize: 12, color: '#4e5968', marginBottom: 6 }}>색상</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {STAGE_PALETTE.map((color) => (
                    <div
                      key={color}
                      onClick={() => {
                        // cycleStageColor only cycles, so click until we hit the right color
                        let current = selectedStage.color
                        let tries = 0
                        while (current !== color && tries < STAGE_PALETTE.length) {
                          cycleStageColor(selectedStage.id)
                          const idx = STAGE_PALETTE.indexOf(current)
                          current = STAGE_PALETTE[(idx + 1) % STAGE_PALETTE.length]
                          tries++
                        }
                      }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: color,
                        cursor: 'pointer',
                        border: selectedStage.color === color ? '2px solid #191f28' : '2px solid transparent',
                        outline: selectedStage.color === color ? '2px solid #fff' : 'none',
                        outlineOffset: -3,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 순서 / 삭제 */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => moveStage(selectedStage.id, -1)}
                  style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', border: 0, background: '#f2f4f6', color: '#4e5968', borderRadius: 8, cursor: 'pointer' }}
                >
                  ◀ 앞으로
                </button>
                <button
                  onClick={() => moveStage(selectedStage.id, 1)}
                  style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', border: 0, background: '#f2f4f6', color: '#4e5968', borderRadius: 8, cursor: 'pointer' }}
                >
                  뒤로 ▶
                </button>
                {client.stages.length > 1 && (
                  <button
                    onClick={() => {
                      const idx = client.stages.findIndex((s) => s.id === selectedStage.id)
                      const next = client.stages[idx - 1] ?? client.stages[idx + 1]
                      deleteStage(selectedStage.id)
                      if (next) selectStage(next.id)
                    }}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', border: 0, color: '#f04452', background: '#fff0f1', borderRadius: 8, cursor: 'pointer', marginLeft: 'auto' }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 노드 목록 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={labelStyle}>노드 순서</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedStage.nodes.map((node, ni) => (
                <div
                  key={node.id}
                  style={{ background: '#f8f9fb', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {editingNodeId === node.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        autoFocus
                        value={node.label}
                        onChange={(e) => renameNode(node.id, { label: e.target.value })}
                        placeholder="노드 이름"
                        style={{ fontSize: 13, fontWeight: 600, padding: '6px 8px', border: '1px solid #e5e8eb', borderRadius: 7, width: '100%', boxSizing: 'border-box' }}
                      />
                      <input
                        value={node.sub}
                        onChange={(e) => renameNode(node.id, { sub: e.target.value })}
                        placeholder="설명 (선택)"
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #e5e8eb', borderRadius: 7, width: '100%', boxSizing: 'border-box', color: '#4e5968' }}
                      />
                      <button
                        onClick={() => setEditingNodeId(null)}
                        style={{ fontSize: 12, fontWeight: 700, padding: '5px 0', border: 0, background: '#191f28', color: '#fff', borderRadius: 7, cursor: 'pointer' }}
                      >
                        완료
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditingNodeId(node.id)}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#191f28' }}>{node.label || '(이름 없음)'}</div>
                        {node.sub && <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 2 }}>{node.sub}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {ni > 0 && (
                          <button
                            onClick={() => moveNode(selectedStage.id, node.id, -1)}
                            style={{ fontSize: 11, padding: '3px 6px', border: 0, background: '#e8eaed', color: '#4e5968', borderRadius: 6, cursor: 'pointer' }}
                          >
                            ↑
                          </button>
                        )}
                        {ni < selectedStage.nodes.length - 1 && (
                          <button
                            onClick={() => moveNode(selectedStage.id, node.id, 1)}
                            style={{ fontSize: 11, padding: '3px 6px', border: 0, background: '#e8eaed', color: '#4e5968', borderRadius: 6, cursor: 'pointer' }}
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => deleteNode(node.id)}
                          style={{ fontSize: 11, padding: '3px 6px', border: 0, color: '#f04452', background: '#fff0f1', borderRadius: 6, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => { addNode(selectedStage.id) }}
                style={addBtn}
              >
                + 노드 추가
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
