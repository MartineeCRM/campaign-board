import { useBoardStore } from '../store'
import { cardWidth, formatCount, pct } from '../utils/format'
import type { Campaign, Channel, Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}
const CHANNELS: Channel[] = ['Push', 'Kakao', 'Email', 'In-app', 'SMS']

interface Props {
  campaign: Campaign
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

export default function CampaignCard({ campaign: k, expanded, notchTop, notchBottom }: Props) {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const toggleOpen = useBoardStore((s) => s.toggleOpen)
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)
  const deleteCampaign = useBoardStore((s) => s.deleteCampaign)

  const status = STATUS_META[k.status]
  const isLive = k.status !== 'stopped'
  const width = cardWidth({ channel: k.channel, period: k.period, name: k.name }, expanded)

  const open = () => {
    if (mode === 'click' && !expanded) toggleOpen(k.id)
    else selectCampaign(k.id)
  }

  const collapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleOpen(k.id)
  }

  const notch = (
    <>
      {notchBottom && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -6,
            width: 11,
            height: 11,
            marginLeft: -6,
            background: '#fff',
            transform: 'rotate(45deg)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
      {notchTop && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -6,
            width: 11,
            height: 11,
            marginLeft: -6,
            background: '#fff',
            transform: 'rotate(45deg)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )

  if (!expanded) {
    return (
      <div style={{ position: 'relative', width }}>
        <div
          onClick={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            borderRadius: 14,
            padding: '12px 14px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            boxShadow: '0 2px 10px rgba(0,20,60,.06)',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: status.color }} />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {k.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {pct(k.convs, k.sent)}
          </div>
          <div style={{ fontSize: 10.5, color: '#6f6f6d' }}>{k.channel}</div>
        </div>
        {notch}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width }}>
      <div
        onClick={open}
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '16px 18px 14px',
          boxShadow: '0 4px 18px rgba(0,20,60,.06)',
          boxSizing: 'border-box',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          {isLive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px 3px 7px',
                borderRadius: 999,
                background: '#e9f7ef',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.04em',
                color: '#1a8a44',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#1a9a4a',
                  animation: 'livePulse 1.6s infinite',
                }}
              />
              LIVE
            </div>
          )}
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: '#f2f4f6',
              fontSize: 10,
              fontWeight: 700,
              color: status.color,
            }}
          >
            {status.label}
          </div>
          {mode === 'click' && (
            <button
              onClick={collapse}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                border: 0,
                borderRadius: 999,
                background: '#f2f4f6',
                color: '#8b95a1',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              접기
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div
            style={{
              flex: 'none',
              marginTop: 1,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.04em',
              padding: '3px 7px',
              borderRadius: 6,
              background: '#f2f4f6',
              color: '#4e5968',
            }}
          >
            {k.channel}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.01em' }}>
            {k.name}
          </div>
          {k.period !== '상시' && (
            <div style={{ flex: 'none', marginTop: 2, fontSize: 11, color: '#8b95a1' }}>{k.period}</div>
          )}
        </div>

        {k.img ? (
          <img
            src={k.img}
            alt=""
            style={{
              display: 'block',
              marginTop: 12,
              width: '100%',
              height: 'auto',
              maxHeight: 360,
              objectFit: 'cover',
              borderRadius: 12,
              background: '#f2f4f6',
            }}
          />
        ) : (
          <div
            style={{
              marginTop: 12,
              height: 112,
              borderRadius: 12,
              background: 'repeating-linear-gradient(135deg,#f5f6f8 0 8px,#eceef1 8px 16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 11,
              color: '#8b95a1',
            }}
          >
            캠페인 이미지
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: '#f9fafb',
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {[
            ['발송', formatCount(k.sent)],
            ['오픈율', pct(k.opens, k.sent)],
            ['클릭률', pct(k.clicks, k.sent)],
            ['전환율', pct(k.convs, k.sent)],
          ].map(([label, value], i) => (
            <div key={label} style={i > 0 ? { borderLeft: '1px solid #e5e8eb', paddingLeft: 8 } : undefined}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
              <div style={{ fontSize: 10.5, color: '#8b95a1', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {edit && (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid #f2f4f6',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'default',
            }}
          >
            <input
              value={k.img ?? ''}
              onChange={(e) => updateCampaign(k.id, { img: e.target.value })}
              placeholder="이미지 URL"
              style={{ fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
            />
            <input
              value={k.name}
              onChange={(e) => updateCampaign(k.id, { name: e.target.value })}
              style={{ fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={k.channel}
                onChange={(e) => updateCampaign(k.id, { channel: e.target.value as Channel })}
                style={{ flex: 1, fontSize: 12, padding: 4, border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff' }}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={k.status}
                onChange={(e) => updateCampaign(k.id, { status: e.target.value as Status })}
                style={{ flex: 1, fontSize: 12, padding: 4, border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff' }}
              >
                <option value="alwayson">Always-On</option>
                <option value="experiment">Experiment</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={k.period}
                onChange={(e) => updateCampaign(k.id, { period: e.target.value })}
                placeholder="기간"
                style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
              />
              <button
                onClick={() => deleteCampaign(k.id)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  border: 0,
                  color: '#f04452',
                  background: '#fff0f1',
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
      {notch}
    </div>
  )
}
