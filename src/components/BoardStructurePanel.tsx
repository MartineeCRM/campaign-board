import { useEffect, useState } from 'react'
import { useBoardStore, STAGE_PALETTE } from '../store'
import { supabase } from '../supabase'
import type { LineStyle } from '../types'

const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점점선' },
]

interface BrazeItem {
  id: string
  name: string
  type: 'campaign' | 'canvas'
}

export default function BoardStructurePanel() {
  const client = useBoardStore((s) => s.currentClient())
  const clientId = useBoardStore((s) => s.clientId)
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
  const importBrazeCampaigns = useBoardStore((s) => s.importBrazeCampaigns)

  // Braze 피커 state
  const [brazeItems, setBrazeItems] = useState<BrazeItem[]>([])
  const [brazeLoading, setBrazeLoading] = useState(false)
  const [brazeError, setBrazeError] = useState<string | null>(null)
  const [brazeTab, setBrazeTab] = useState<'campaign' | 'canvas'>('campaign')
  const [brazeQuery, setBrazeQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targetNodeId, setTargetNodeId] = useState<string>('')

  const selectedStage = client.stages.find((s) => s.id === selectedStageId) ?? client.stages[0] ?? null

  // 노드 기본 선택
  useEffect(() => {
    if (selectedStage && !targetNodeId) {
      setTargetNodeId(selectedStage.nodes[0]?.id ?? '')
    }
  }, [selectedStage?.id])

  // Braze 목록 로드
  useEffect(() => {
    void loadBraze()
  }, [clientId])

  async function loadBraze() {
    setBrazeLoading(true)
    setBrazeError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인 필요')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/list-braze-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clientId }),
      })
      const body = await res.json() as { campaigns?: BrazeItem[]; canvases?: BrazeItem[]; error?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
      setBrazeItems([
        ...(body.campaigns ?? []).map((c) => ({ ...c, type: 'campaign' as const })),
        ...(body.canvases ?? []).map((c) => ({ ...c, type: 'canvas' as const })),
      ])
    } catch (err) {
      setBrazeError(err instanceof Error ? err.message : String(err))
    } finally {
      setBrazeLoading(false)
    }
  }

  function toggleItem(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleApply() {
    if (!targetNodeId || selected.size === 0) return
    const toAdd = brazeItems
      .filter((i) => selected.has(i.id))
      .map((i) => ({ brazeId: i.id, brazeType: i.type, name: i.name }))
    importBrazeCampaigns(targetNodeId, 'top', toAdd)
    setSelected(new Set())
  }

  const filteredItems = brazeItems.filter(
    (i) => i.type === brazeTab && i.name.toLowerCase().includes(brazeQuery.toLowerCase()),
  )

  if (!selectedStage) return null

  const s = sty

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* 퍼널 칩 셀렉터 */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f2f4f6', flexShrink: 0 }}>
        <div style={s.label}>퍼널 설정</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {client.stages.map((stage) => {
            const active = (selectedStageId ?? client.stages[0]?.id) === stage.id
            return (
              <button key={stage.id} onClick={() => selectStage(stage.id)} style={{
                fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 20,
                border: `2px solid ${active ? stage.color : 'transparent'}`,
                background: active ? stage.color : '#f2f4f6',
                color: active ? '#fff' : '#4e5968', cursor: 'pointer',
              }}>
                {stage.name}
              </button>
            )
          })}
          <button onClick={() => addStage()} style={{
            fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 20,
            border: '2px dashed #d1d6db', background: 'transparent', color: '#8b95a1', cursor: 'pointer',
          }}>
            + 추가
          </button>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── 퍼널 서식 ── */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f2f4f6' }}>
          <input
            value={selectedStage.name}
            onChange={(e) => renameStage(selectedStage.id, e.target.value)}
            style={s.input}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#8b95a1' }}>색상</span>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {STAGE_PALETTE.map((color) => (
                <div key={color} onClick={() => {
                  let cur = selectedStage.color, tries = 0
                  while (cur !== color && tries < STAGE_PALETTE.length) {
                    cycleStageColor(selectedStage.id)
                    cur = STAGE_PALETTE[(STAGE_PALETTE.indexOf(cur) + 1) % STAGE_PALETTE.length]
                    tries++
                  }
                }} style={{
                  width: 18, height: 18, borderRadius: '50%', background: color, cursor: 'pointer',
                  border: selectedStage.color === color ? '2px solid #191f28' : '2px solid transparent',
                  outline: selectedStage.color === color ? '2px solid #fff' : 'none', outlineOffset: -3,
                }} />
              ))}
            </div>
            {client.stages.length > 1 && (
              <button onClick={() => {
                const idx = client.stages.findIndex((st) => st.id === selectedStage.id)
                const next = client.stages[idx - 1] ?? client.stages[idx + 1]
                deleteStage(selectedStage.id)
                if (next) selectStage(next.id)
              }} style={s.dangerBtn}>퍼널 삭제</button>
            )}
          </div>
        </div>

        {/* ── 노드 설정 ── */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f2f4f6' }}>
          <div style={s.label}>노드 설정</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedStage.nodes.map((node) => (
              <div key={node.id} style={{ background: '#f8f9fb', borderRadius: 10, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <input
                      value={node.label}
                      onChange={(e) => renameNode(node.id, { label: e.target.value })}
                      placeholder="노드 이름"
                      style={{ ...s.input, fontSize: 13, fontWeight: 600 }}
                    />
                    <input
                      value={node.sub}
                      onChange={(e) => renameNode(node.id, { sub: e.target.value })}
                      placeholder="설명"
                      style={{ ...s.input, fontSize: 12, color: '#4e5968' }}
                    />
                  </div>
                  <button onClick={() => deleteNode(node.id)} style={{ ...s.dangerBtn, flexShrink: 0, marginTop: 2 }}>삭제</button>
                </div>
                {/* 서식 */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {LINE_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setNodeLine(node.id, opt.value)} style={{
                      flex: 1, fontSize: 11, fontWeight: 700, padding: '5px 0',
                      border: 0, borderRadius: 6, cursor: 'pointer',
                      background: node.line === opt.value ? '#191f28' : '#fff',
                      color: node.line === opt.value ? '#fff' : '#8b95a1',
                    }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => addNode(selectedStage.id)} style={s.addBtn}>
              + 노드 추가
            </button>
          </div>
        </div>

        {/* ── 캠페인/캔버스 추가 ── */}
        <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={s.label}>캠페인/캔버스 추가</div>

          {/* 노드 선택 */}
          <select
            value={targetNodeId}
            onChange={(e) => setTargetNodeId(e.target.value)}
            style={{ fontSize: 12, padding: '7px 8px', border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff', color: '#191f28', width: '100%' }}
          >
            {selectedStage.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || '(이름 없음)'}</option>
            ))}
          </select>

          {/* 탭 */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['campaign', 'canvas'] as const).map((tab) => (
              <button key={tab} onClick={() => setBrazeTab(tab)} style={{
                flex: 1, fontSize: 12, fontWeight: 700, padding: '6px 0', border: 0, borderRadius: 8, cursor: 'pointer',
                background: brazeTab === tab ? '#191f28' : '#f2f4f6',
                color: brazeTab === tab ? '#fff' : '#4e5968',
              }}>
                {tab === 'campaign' ? '캠페인' : '캔버스'}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <input
            value={brazeQuery}
            onChange={(e) => setBrazeQuery(e.target.value)}
            placeholder="이름 검색..."
            style={s.input}
          />

          {/* 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
            {brazeLoading && <div style={{ fontSize: 12, color: '#8b95a1', textAlign: 'center', padding: '16px 0' }}>불러오는 중...</div>}
            {brazeError && <div style={{ fontSize: 12, color: '#f04452', padding: '8px 10px', borderRadius: 8, background: '#fff0f1' }}>{brazeError}</div>}
            {!brazeLoading && !brazeError && filteredItems.length === 0 && (
              <div style={{ fontSize: 12, color: '#8b95a1', textAlign: 'center', padding: '16px 0' }}>항목 없음</div>
            )}
            {filteredItems.map((item) => (
              <label key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
                background: selected.has(item.id) ? '#f0f5ff' : 'transparent',
              }}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  style={{ width: 14, height: 14, accentColor: '#3182f6', flexShrink: 0, cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#191f28', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#b0b8c1', marginTop: 1, fontFamily: 'ui-monospace,Menlo,monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.id}</div>
                </div>
              </label>
            ))}
          </div>

          {/* 적용/취소 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setSelected(new Set())}
              style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: '10px 0', border: '1px solid #e5e8eb', borderRadius: 10, background: '#fff', color: '#4e5968', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0 || !targetNodeId}
              style={{
                flex: 1, fontSize: 13, fontWeight: 700, padding: '10px 0', border: 0, borderRadius: 10, cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                background: selected.size > 0 ? '#191f28' : '#e5e8eb',
                color: selected.size > 0 ? '#fff' : '#8b95a1',
              }}
            >
              {selected.size > 0 ? `${selected.size}개 적용` : '적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 공통 스타일 ──
const sty = {
  label: {
    fontSize: 11, fontWeight: 700, color: '#8b95a1',
    textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 8,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const, fontSize: 13,
    padding: '7px 9px', border: '1px solid #e5e8eb', borderRadius: 8, color: '#191f28',
  },
  addBtn: {
    fontSize: 12, fontWeight: 700, color: '#3182f6', background: '#eef4ff',
    border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
    textAlign: 'left' as const, width: '100%',
  },
  dangerBtn: {
    fontSize: 11, fontWeight: 700, padding: '4px 8px', border: 0,
    color: '#f04452', background: '#fff0f1', borderRadius: 7, cursor: 'pointer',
  },
}
