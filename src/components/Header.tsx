import { useBoardStore } from '../store'
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
  const toggleEdit = useBoardStore((s) => s.toggleEdit)

  const counts: Record<Status, number> = { alwayson: 0, experiment: 0, stopped: 0 }
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      for (const campaign of node.campaigns) counts[campaign.status]++
    }
  }

  const syncTime = new Date(sync).toLocaleTimeString('ko-KR', { hour12: false })
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#8b95a1' }}>
          <span>동기화 {syncTime}</span>
        </div>
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

        <button
          onClick={toggleEdit}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 18px',
            border: 0,
            borderRadius: 10,
            color: '#fff',
            cursor: 'pointer',
            background: edit ? '#3182f6' : '#191f28',
          }}
        >
          {edit ? '편집 완료' : '편집'}
        </button>

        {edit && clients.length > 1 && (
          <button
            onClick={deleteClient}
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
      </div>
    </header>
  )
}
