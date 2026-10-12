import { useState } from 'react'
import { useBoardStore, STAGE_PALETTE } from '../store'
import BrazeCampaignPicker from './BrazeCampaignPicker'
import type { FunnelNode, LineStyle } from '../types'

const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점점선' },
]

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#8b95a1',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 10,
}

const divider: React.CSSProperties = {
  borderBottom: '1px solid #f2f4f6',
}

export default function BoardStructurePanel() {
  const client = useBoardStore((s) => s.currentClient())
  const selectedStageId = useBoardStore((s) => s.selectedStageId)
  const selectStage = useBoardStore((s) => s.selectStage)
  const addStage = useBoardStore((s) => s.addStage)
  const renameStage = useBoardStore((s) => s.renameStage)
  const cycleStageColor = useBoardStore((s) => s.cycleStageColor)
  const deleteStage = useBoardStore((s) => s.deleteStage)
  const addNode = useBoardStore((s) => s.addNode)
  const renameNode = useBoardStore((s) => s.renameNode)
  const setNodeLine = useBoardStore((s) => s.setNodeLine)
  const deleteNode = useBoardStore((s) => s.deleteNode)

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null)

  const selectedStage = client.stages.find((s) => s.id === selectedStageId) ?? client.stages[0] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── 퍼널 설정 ── */}
      <div style={{ padding: '20px 20px 16px', ...divider }}>
        <div style={sectionLabel}>퍼널 설정</div>
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
            onClick={() => addStage()}
            style={{
              fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
              border: '2px dashed #d1d6db', background: 'transparent', color: '#8b95a1', cursor: 'pointer',
            }}
          >
            + 퍼널 추가
          </button>
        </div>
      </div>

      {selectedStage && (
        <>
          {/* ── 퍼널 서식 ── */}
          <div style={{ padding: '16px 20px', ...divider }}>
            <div style={sectionLabel}>퍼널 서식</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={selectedStage.name}
                onChange={(e) => renameStage(selectedStage.id, e.target.value)}
                placeholder="퍼널 이름"
                style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '8px 10px', border: '1px solid #e5e8eb', borderRadius: 8, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#4e5968', flexShrink: 0 }}>색상</div>
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  {STAGE_PALETTE.map((color) => (
                    <div
                      key={color}
                      onClick={() => {
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
                        width: 20, height: 20, borderRadius: '50%', background: color, cursor: 'pointer',
                        border: selectedStage.color === color ? '2px solid #191f28' : '2px solid transparent',
                        outline: selectedStage.color === color ? '2px solid #fff' : 'none',
                        outlineOffset: -3,
                      }}
                    />
                  ))}
                </div>
                {client.stages.length > 1 && (
                  <button
                    onClick={() => {
                      const idx = client.stages.findIndex((s) => s.id === selectedStage.id)
                      const next = client.stages[idx - 1] ?? client.stages[idx + 1]
                      deleteStage(selectedStage.id)
                      if (next) selectStage(next.id)
                    }}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', border: 0, color: '#f04452', background: '#fff0f1', borderRadius: 7, cursor: 'pointer', flexShrink: 0 }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── 노드 설정 ── */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px 8px', flexShrink: 0 }}>
              <div style={sectionLabel}>노드 설정</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedStage.nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  stageId={selectedStage.id}
                  editing={editingNodeId === node.id}
                  onEdit={() => setEditingNodeId(node.id)}
                  onEditDone={() => setEditingNodeId(null)}
                  onAddCampaign={() => setPickerNodeId(node.id)}
                  renameNode={renameNode}
                  setNodeLine={setNodeLine}
                  deleteNode={deleteNode}
                />
              ))}

              <button
                onClick={() => addNode(selectedStage.id)}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#3182f6', background: '#eef4ff',
                  border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                + 노드 추가
              </button>
            </div>
          </div>
        </>
      )}

      {/* Braze 캠페인 피커 */}
      {pickerNodeId && (
        <BrazeCampaignPicker
          nodeId={pickerNodeId}
          pos="top"
          onClose={() => setPickerNodeId(null)}
        />
      )}
    </div>
  )
}

// ── 노드 카드 ──────────────────────────────────────────
function NodeCard({
  node, stageId: _stageId, editing, onEdit, onEditDone, onAddCampaign,
  renameNode, setNodeLine, deleteNode,
}: {
  node: FunnelNode
  stageId: string
  editing: boolean
  onEdit: () => void
  onEditDone: () => void
  onAddCampaign: () => void
  renameNode: (id: string, patch: Partial<Pick<FunnelNode, 'label' | 'sub'>>) => void
  setNodeLine: (id: string, line: LineStyle) => void
  deleteNode: (id: string) => void
}) {
  return (
    <div style={{ background: '#f8f9fb', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* 이름 / 설명 */}
      {editing ? (
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
            onClick={onEditDone}
            style={{ fontSize: 12, fontWeight: 700, padding: '5px 0', border: 0, background: '#191f28', color: '#fff', borderRadius: 7, cursor: 'pointer' }}
          >
            완료
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={onEdit}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#191f28' }}>{node.label || '(이름 없음)'}</div>
            {node.sub && <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 1 }}>{node.sub}</div>}
          </div>
          <button
            onClick={() => deleteNode(node.id)}
            style={{ fontSize: 11, padding: '3px 7px', border: 0, color: '#f04452', background: '#fff0f1', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
          >
            삭제
          </button>
        </div>
      )}

      {/* 노드 서식 */}
      {!editing && (
        <>
          <div>
            <div style={{ fontSize: 11, color: '#8b95a1', fontWeight: 600, marginBottom: 5 }}>노드 서식</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {LINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNodeLine(node.id, opt.value)}
                  style={{
                    flex: 1, fontSize: 11, fontWeight: 700, padding: '5px 0',
                    border: 0, borderRadius: 7, cursor: 'pointer',
                    background: node.line === opt.value ? '#191f28' : '#fff',
                    color: node.line === opt.value ? '#fff' : '#4e5968',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 캠페인/캔버스 추가 */}
          <button
            onClick={onAddCampaign}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 0',
              border: '1.5px dashed #3182f6', borderRadius: 8,
              background: 'transparent', color: '#3182f6', cursor: 'pointer', width: '100%',
            }}
          >
            + 캠페인/캔버스 추가
          </button>
        </>
      )}
    </div>
  )
}
