import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useBoardStore } from '../store'
import type { CardPos } from '../types'
import { brazeItemKey, getImportedBrazeKeys } from '../utils/braze-import'

interface BrazeItem {
  id: string
  name: string
  type: 'campaign' | 'canvas'
  last_edited: string
}

interface Props {
  nodeId: string
  pos: CardPos
  onClose: () => void
}

export default function BrazeCampaignPicker({ nodeId, pos, onClose }: Props) {
  const clientId = useBoardStore((s) => s.clientId)
  const client = useBoardStore((s) => s.currentClient())
  const importBrazeCampaigns = useBoardStore((s) => s.importBrazeCampaigns)
  const importedKeys = getImportedBrazeKeys(client)

  const [items, setItems] = useState<BrazeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'campaign' | 'canvas'>('campaign')

  useEffect(() => { void load() }, [clientId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/list-braze-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId }),
      })
      const body = await res.json() as { campaigns?: BrazeItem[]; canvases?: BrazeItem[]; error?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
      setItems([...(body.campaigns ?? []), ...(body.canvases ?? [])])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(
    (i) => i.type === tab && i.name.toLowerCase().includes(query.toLowerCase()),
  )
  const newSelectionCount = items.filter((item) =>
    selected.has(brazeItemKey(item.type, item.id)) && !importedKeys.has(brazeItemKey(item.type, item.id)),
  ).length

  function toggle(item: BrazeItem) {
    if (importedKeys.has(brazeItemKey(item.type, item.id))) return
    setSelected((prev) => {
      const next = new Set(prev)
      const key = brazeItemKey(item.type, item.id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleAdd() {
    const toAdd = items
      .filter((i) => selected.has(brazeItemKey(i.type, i.id)) && !importedKeys.has(brazeItemKey(i.type, i.id)))
      .map((i) => ({ brazeId: i.id, brazeType: i.type, name: i.name }))
    importBrazeCampaigns(nodeId, pos, toAdd)
    onClose()
  }

  const typeLabel = { campaign: '캠페인', canvas: '캔버스' }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.25)', zIndex: 100 }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 16px 56px rgba(0,20,60,.22)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em' }}>Braze에서 캠페인 추가</div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: '#f2f4f6', color: '#4e5968', fontSize: 14, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {(['campaign', 'canvas'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '6px 14px',
                  border: 0,
                  borderRadius: 8,
                  background: tab === t ? '#191f28' : '#f2f4f6',
                  color: tab === t ? '#fff' : '#4e5968',
                  cursor: 'pointer',
                }}
              >
                {typeLabel[t]}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름으로 검색..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: 13,
              padding: '9px 11px',
              border: '1px solid #e5e8eb',
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 8px' }}>
          {loading && (
            <div style={{ fontSize: 13, color: '#8b95a1', textAlign: 'center', padding: '32px 0' }}>불러오는 중...</div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: '#f04452', padding: '10px 11px', borderRadius: 8, background: '#fff0f1', margin: '8px 0' }}>
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ fontSize: 13, color: '#8b95a1', textAlign: 'center', padding: '32px 0' }}>
              {query ? '검색 결과 없음' : `${typeLabel[tab]} 없음`}
            </div>
          )}
          {filtered.map((item) => {
            const key = brazeItemKey(item.type, item.id)
            const alreadyAdded = importedKeys.has(key)
            return (
            <div
              key={item.id}
              onClick={() => toggle(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 8px',
                borderRadius: 8,
                cursor: alreadyAdded ? 'default' : 'pointer',
                opacity: alreadyAdded ? 0.55 : 1,
                background: alreadyAdded ? '#f8f9fb' : selected.has(key) ? '#f0f5ff' : 'transparent',
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: alreadyAdded ? '2px solid #aab2bc' : selected.has(key) ? '2px solid #3182f6' : '2px solid #d1d6db',
                  background: alreadyAdded ? '#aab2bc' : selected.has(key) ? '#3182f6' : '#fff',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {alreadyAdded || selected.has(key) ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#191f28', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 1 }}>{item.id}</div>
              </div>
              {alreadyAdded && <div style={{ fontSize: 10, color: '#8b95a1', flexShrink: 0 }}>이미 추가됨</div>}
            </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #f2f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#8b95a1' }}>
            {newSelectionCount > 0 ? `${newSelectionCount}개 선택됨` : '선택하세요'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ fontSize: 13, fontWeight: 600, padding: '9px 18px', border: '1px solid #e5e8eb', borderRadius: 10, background: '#fff', color: '#4e5968', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={newSelectionCount === 0}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: '9px 18px',
                border: 0,
                borderRadius: 10,
                background: newSelectionCount > 0 ? '#191f28' : '#e5e8eb',
                color: newSelectionCount > 0 ? '#fff' : '#8b95a1',
                cursor: newSelectionCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {newSelectionCount > 0 ? `${newSelectionCount}개 추가` : '추가'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
