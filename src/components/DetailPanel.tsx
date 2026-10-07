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

  return (
    <>
      <div
        onClick={() => selectCampaign(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.2)', zIndex: 50 }}
      />
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          bottom: 12,
          width: 420,
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          borderRadius: 22,
          boxShadow: '0 12px 48px rgba(0,20,60,.2)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 24px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px 11px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700, background: stageColor }}>
              {stageName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4e5968' }}>{nodeLabel}</div>
            <button
              onClick={() => selectCampaign(null)}
              style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', border: 0, background: '#f2f4f6', color: '#4e5968', fontSize: 15, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.35 }}>{k.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px 4px 8px', borderRadius: 999, background: '#e9f7ef', fontSize: 11, fontWeight: 700, color: '#1a8a44' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a9a4a', animation: 'livePulse 1.6s infinite' }} />
                LIVE
              </div>
            )}
            <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: status.color }}>
              {status.label}
            </div>
            <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: '#4e5968' }}>
              {k.channel}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {k.img ? (
            <img src={k.img} alt="" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 420, objectFit: 'cover', borderRadius: 14, background: '#f2f4f6' }} />
          ) : (
            <div
              style={{
                height: 200,
                borderRadius: 14,
                background: 'repeating-linear-gradient(135deg,#f5f6f8 0 8px,#eceef1 8px 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 12,
                color: '#8b95a1',
              }}
            >
              캠페인 이미지
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', padding: '14px 4px', borderRadius: 14, background: '#f9fafb' }}>
            {[
              ['발송', formatCount(k.sent)],
              ['오픈율', pct(k.opens, k.sent)],
              ['클릭률', pct(k.clicks, k.sent)],
              ['전환율', pct(k.convs, k.sent)],
            ].map(([label, value], i) => (
              <div key={label} style={{ padding: '0 10px', ...(i > 0 ? { borderLeft: '1px solid #e5e8eb' } : {}) }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginBottom: 6 }}>캠페인 설정</div>
            {FIELD_ROWS.map((row) => (
              <div
                key={row.key}
                style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f2f4f6' }}
              >
                <div style={{ fontSize: 13, color: '#8b95a1' }}>{row.label}</div>
                {edit ? (
                  <input
                    value={(k[row.key] as string) ?? ''}
                    onChange={(e) => updateCampaign(k.id, { [row.key]: e.target.value } as Partial<Campaign>)}
                    style={{ fontSize: 13, padding: '7px 9px', border: '1px solid #e5e8eb', borderRadius: 8, minWidth: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#333d4b',
                      wordBreak: 'break-all',
                      fontFamily: row.mono ? 'ui-monospace, Menlo, monospace' : 'inherit',
                    }}
                  >
                    {(k[row.key] as string) || '—'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px 22px', borderTop: '1px solid #f2f4f6' }}>
          {k.link ? (
            <a
              href={k.link}
              target="_blank"
              rel="noopener"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, background: '#191f28', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              캠페인 열기 ↗
            </a>
          ) : (
            <div style={{ padding: 14, borderRadius: 12, background: '#f2f4f6', color: '#8b95a1', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              편집 모드에서 캠페인 링크를 입력하세요
            </div>
          )}
        </div>
      </div>
    </>
  )
}
