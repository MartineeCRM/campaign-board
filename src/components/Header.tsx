import { useBoardStore } from '../store'
import { supabase } from '../supabase'
import type { Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}

export default function Header() {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const sync = useBoardStore((s) => s.sync)
  const clients = useBoardStore((s) => s.clients)
  const clientId = useBoardStore((s) => s.clientId)
  const client = useBoardStore((s) => s.currentClient())
  const renameClient = useBoardStore((s) => s.renameClient)
  const setClient = useBoardStore((s) => s.setClient)
  const addClient = useBoardStore((s) => s.addClient)
  const deleteClient = useBoardStore((s) => s.deleteClient)
  const setMode = useBoardStore((s) => s.setMode)
  const enterEdit = useBoardStore((s) => s.enterEdit)
  const confirmEdit = useBoardStore((s) => s.confirmEdit)
  const zoom = useBoardStore((s) => s.zoom)
  const zoomIn = useBoardStore((s) => s.zoomIn)
  const zoomOut = useBoardStore((s) => s.zoomOut)
  const resetZoom = useBoardStore((s) => s.resetZoom)
  const isSyncing = useBoardStore((s) => s.isSyncingAll)
  const syncAll = useBoardStore((s) => s.syncAll)
  const syncAllError = useBoardStore((s) => s.syncAllError)
  const syncAllMessage = useBoardStore((s) => s.syncAllMessage)

  const counts: Record<Status, number> = { alwayson: 0, experiment: 0, stopped: 0 }
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      for (const campaign of node.campaigns) counts[campaign.status]++
    }
  }

  const syncDate = new Date(sync)
  const syncDisplay = `${String(syncDate.getFullYear()).slice(2)}/${String(syncDate.getMonth() + 1).padStart(2, '0')}/${String(syncDate.getDate()).padStart(2, '0')} ${syncDate.toLocaleTimeString('ko-KR', { hour12: false })}`
  const segBtn = (active: boolean) => ({
    fontSize: 12,
    fontWeight: 600 as const,
    padding: '7px 12px',
    border: 0,
    borderRadius: 8,
    cursor: 'pointer' as const,
    background: active ? '#fff' : 'transparent',
    boxShadow: active ? '0 1px 4px rgba(0,20,60,.1)' : 'none',
    color: active ? '#191f28' : '#8b95a1',
  })
  const zoomBtn: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    width: 26,
    height: 26,
    lineHeight: 1,
    border: 0,
    borderRadius: 8,
    cursor: 'pointer',
    background: 'transparent',
    color: '#4e5968',
  }

  return (
    <header
      style={{
        background: '#fff',
        padding: '28px 40px 24px',
        boxShadow: '0 1px 0 rgba(0,20,60,.05)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px 48px',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {edit ? (
            <input
              value={client.name}
              onChange={(e) => renameClient(e.target.value)}
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-.03em',
                padding: '2px 8px',
                border: '1px solid #e5e8eb',
                borderRadius: 8,
                width: 220,
                color: '#191f28',
              }}
            />
          ) : (
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.2 }}>
              {client.name}
            </div>
          )}
          <button
            onClick={() => void syncAll()}
            disabled={isSyncing}
            title="Google Sheets와 Braze 동기화"
            aria-label="Google Sheets와 Braze 동기화"
            style={{
              width: 24,
              height: 24,
              border: 0,
              borderRadius: 6,
              background: 'transparent',
              color: isSyncing ? '#c4c9d0' : '#8b95a1',
              fontSize: 16,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ display: 'inline-block', animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }}>
              ↻
            </span>
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#8b95a1' }}>
          마지막 동기화 {syncDisplay}
        </div>
        {(syncAllError || syncAllMessage) && (
          <div role={syncAllError ? 'alert' : 'status'} style={{ maxWidth: 520, fontSize: 12, color: syncAllError ? '#c0392b' : '#18864b' }}>
            {syncAllError ?? syncAllMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 36px', alignItems: 'baseline' }}>
        {(Object.keys(STATUS_META) as Status[]).map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                alignSelf: 'center',
                background: STATUS_META[key].color,
              }}
            />
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {counts[key]}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#4e5968' }}>{STATUS_META[key].label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select
          value={clientId}
          onChange={(e) => (e.target.value === '__new' ? addClient() : setClient(e.target.value))}
          disabled={isSyncing}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            border: 0,
            borderRadius: 10,
            background: '#f2f4f6',
            color: '#191f28',
            cursor: 'pointer',
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ 새 고객사</option>
        </select>

        <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 12, background: '#f2f4f6' }}>
          <button onClick={() => setMode('full')} style={segBtn(mode === 'full')}>
            전체 노출
          </button>
          <button onClick={() => setMode('click')} style={segBtn(mode === 'click')}>
            클릭 노출
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 4,
            borderRadius: 12,
            background: '#f2f4f6',
          }}
        >
          <button onClick={zoomOut} title="축소" style={zoomBtn}>
            −
          </button>
          <span
            onClick={resetZoom}
            title="100%로 초기화"
            style={{
              fontSize: 12,
              fontWeight: 600,
              width: 38,
              textAlign: 'center',
              color: '#191f28',
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={zoomIn} title="확대" style={zoomBtn}>
            +
          </button>
        </div>

        <button
          onClick={edit ? confirmEdit : enterEdit}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 16px',
            border: `1.5px solid ${edit ? '#3182f6' : '#191f28'}`,
            borderRadius: 10,
            color: edit ? '#3182f6' : '#191f28',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {edit ? '보기모드' : '편집모드'}
          <span style={{ fontSize: 11, opacity: 0.7 }}>{'>'}</span>
        </button>

        {edit && clients.length > 1 && (
          <button
            onClick={() => {
              if (window.confirm(`"${client.name}" 고객사를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) {
                deleteClient()
              }
            }}
            style={{
              fontSize: 12,
              padding: '7px 10px',
              border: 0,
              color: '#f04452',
              background: '#fff0f1',
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            고객사 삭제
          </button>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          title="로그아웃"
          style={{
            fontSize: 12,
            padding: '7px 10px',
            border: '1px solid #e5e8eb',
            background: '#fff',
            color: '#8b95a1',
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          로그아웃
        </button>
      </div>

    </header>
  )
}
