import { useBoardStore } from '../store'
import { formatCount, pct } from '../utils/format'
import type { Campaign, Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}

const FIELD_ROWS: { key: keyof Campaign; label: string; mono?: boolean }[] = [
  { key: 'delivery', label: '발송 방식' },
  { key: 'trigger', label: '트리거', mono: true },
  { key: 'audience', label: '대상' },
  { key: 'convEvent', label: '전환 이벤트', mono: true },
  { key: 'cap', label: '재발송 제한' },
  { key: 'period', label: '기간' },
  { key: 'link', label: '캠페인 링크' },
  { key: 'img', label: '이미지 URL' },
]

export default function DetailPanel() {
  const edit = useBoardStore((s) => s.edit)
  const sel = useBoardStore((s) => s.sel)
  const client = useBoardStore((s) => s.currentClient())
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)
  const deleteCampaign = useBoardStore((s) => s.deleteCampaign)

  if (!sel) return null

  let found: { campaign: Campaign; stageName: string; stageColor: string; nodeLabel: string } | null = null
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      const campaign = node.campaigns.find((c) => c.id === sel)
      if (campaign) {
        found = { campaign, stageName: stage.name, stageColor: stage.color, nodeLabel: node.label }
      }
    }
  }
  if (!found) return null
  const { campaign: k, stageName, stageColor, nodeLabel } = found
  const status = STATUS_META[k.status]
  const isLive = k.status !== 'stopped'

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '7px 9px',
    border: '1px solid #e5e8eb',
    borderRadius: 8,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f2f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ padding: '3px 9px', borderRadius: 999, color: '#fff', fontSize: 11, fontWeight: 700, background: stageColor }}>
            {stageName}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4e5968', flex: 1 }}>{nodeLabel}</div>
          <button
            onClick={() => selectCampaign(null)}
            style={{ width: 28, height: 28, borderRadius: '50%', border: 0, background: '#f2f4f6', color: '#4e5968', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {edit ? (
          <input
            value={k.name}
            onChange={(e) => updateCampaign(k.id, { name: e.target.value })}
            style={{ ...inputStyle, fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 8 }}
          />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.3, marginBottom: 8 }}>{k.name}</div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {edit ? (
            <>
              {(['alwayson', 'experiment', 'stopped'] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateCampaign(k.id, { status: s })}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, border: 0, cursor: 'pointer',
                    background: k.status === s ? STATUS_META[s].color : '#f2f4f6',
                    color: k.status === s ? '#fff' : '#8b95a1',
                  }}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
              <select
                value={k.channel}
                onChange={(e) => updateCampaign(k.id, { channel: e.target.value as Campaign['channel'] })}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e8eb', background: '#f2f4f6', color: '#4e5968' }}
              >
                {['Push', 'Email', 'SMS', 'In-App', 'Kakao', 'LMS'].map((ch) => (
                  <option key={ch}>{ch}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              {isLive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px 4px 8px', borderRadius: 999, background: '#e9f7ef', fontSize: 11, fontWeight: 700, color: '#1a8a44' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a9a4a' }} />
                  LIVE
                </div>
              )}
              <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: status.color }}>{status.label}</div>
              <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: '#4e5968' }}>{k.channel}</div>
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        {/* 지표 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '14px 4px', borderRadius: 14, background: '#f9fafb', margin: '14px 0' }}>
          {[
            ['발송', formatCount(k.sent)],
            ['오픈율', pct(k.opens, k.sent)],
            ['클릭률', pct(k.clicks, k.sent)],
            ['전환율', pct(k.convs, k.sent)],
          ].map(([label, value], i) => (
            <div key={label} style={{ padding: '0 8px', ...(i > 0 ? { borderLeft: '1px solid #e5e8eb' } : {}) }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 이미지 */}
        {k.img && (
          <img src={k.img} alt="" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 280, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
        )}

        {/* 캠페인 설정 필드 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a1', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>캠페인 설정</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELD_ROWS.map((row) => (
            <div
              key={row.key}
              style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f2f4f6' }}
            >
              <div style={{ fontSize: 12, color: '#8b95a1' }}>{row.label}</div>
              {edit ? (
                <input
                  value={(k[row.key] as string) ?? ''}
                  onChange={(e) => updateCampaign(k.id, { [row.key]: e.target.value } as Partial<Campaign>)}
                  style={{ ...inputStyle, fontFamily: row.mono ? 'ui-monospace, Menlo, monospace' : 'inherit' }}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333d4b', wordBreak: 'break-all', fontFamily: row.mono ? 'ui-monospace, Menlo, monospace' : 'inherit' }}>
                  {(k[row.key] as string) || '—'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Braze 연결 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a1', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Braze 연결</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f2f4f6' }}>
            <div style={{ fontSize: 12, color: '#8b95a1' }}>Braze ID</div>
            {edit ? (
              <input
                value={k.brazeId ?? ''}
                onChange={(e) => updateCampaign(k.id, { brazeId: e.target.value || undefined })}
                placeholder="캠페인 또는 캔버스 ID"
                style={{ ...inputStyle, fontFamily: 'ui-monospace, Menlo, monospace' }}
              />
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333d4b', fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all' }}>
                {k.brazeId || '—'}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f2f4f6' }}>
            <div style={{ fontSize: 12, color: '#8b95a1' }}>유형</div>
            {edit ? (
              <select
                value={k.brazeType ?? 'campaign'}
                onChange={(e) => updateCampaign(k.id, { brazeType: e.target.value as 'campaign' | 'canvas' })}
                style={{ fontSize: 13, padding: '7px 9px', border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff', color: '#191f28' }}
              >
                <option value="campaign">Campaign</option>
                <option value="canvas">Canvas</option>
              </select>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333d4b' }}>{k.brazeType ?? '—'}</div>
            )}
          </div>
          {k.lastSyncedAt && (
            <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 12, color: '#8b95a1' }}>마지막 싱크</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8b95a1' }}>
                {new Date(k.lastSyncedAt).toLocaleString('ko-KR', { hour12: false })}
              </div>
            </div>
          )}
        </div>

        {/* 삭제 (편집 모드에서만) */}
        {edit && (
          <button
            onClick={() => { deleteCampaign(k.id); selectCampaign(null) }}
            style={{ width: '100%', marginTop: 16, fontSize: 13, fontWeight: 700, padding: '11px 0', border: 0, borderRadius: 10, background: '#fff0f1', color: '#f04452', cursor: 'pointer' }}
          >
            캠페인 삭제
          </button>
        )}
      </div>

      {/* 하단 링크 버튼 */}
      {!edit && (
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #f2f4f6', flexShrink: 0 }}>
          {k.link ? (
            <a
              href={k.link}
              target="_blank"
              rel="noopener"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 13, borderRadius: 12, background: '#191f28', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
            >
              캠페인 열기 ↗
            </a>
          ) : (
            <div style={{ padding: 13, borderRadius: 12, background: '#f2f4f6', color: '#8b95a1', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
              캠페인 링크를 입력하면 바로가기가 생깁니다
            </div>
          )}
        </div>
      )}
    </div>
  )
}
