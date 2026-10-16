import { useRef } from 'react'
import { useBoardStore } from '../store'
import { cardWidth, formatCount, pct } from '../utils/format'
import { displayedConversionCount, getMetrics } from '../utils/metrics'
import type { Campaign, Channel, Status } from '../types'
import { attachedCampaignImages, campaignImages, campaignImagesForStep, signedCampaignImageUrl } from '../utils/campaign-images'
import CampaignImageAttachments from './CampaignImageAttachments'
import CampaignImageGallery from './CampaignImageGallery'


const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}
const CHANNELS: Channel[] = ['Push', 'Kakao', 'Email', 'In-app', 'SMS', 'Banner', 'Webhook']

interface Props {
  campaign: Campaign
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

export default function CampaignCard({ campaign: k, expanded, notchTop, notchBottom }: Props) {
  const edit = useBoardStore((s) => s.edit)
  const conversionEventIndex = useBoardStore((s) => s.currentClient().conversionEventIndex ?? 0)
  const mode = useBoardStore((s) => s.mode)
  const toggleOpen = useBoardStore((s) => s.toggleOpen)
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)
  const deleteCampaign = useBoardStore((s) => s.deleteCampaign)
  const addCampaignImages = useBoardStore((s) => s.addCampaignImages)
  const removeCampaignImage = useBoardStore((s) => s.removeCampaignImage)
  const reorderCampaignImages = useBoardStore((s) => s.reorderCampaignImages)
  const refreshAttempted = useRef(new Set<string>())

  const status = STATUS_META[k.status]
  const isLive = k.brazeIsActive === true
  const isOff = k.brazeIsActive === false
  const width = cardWidth({ channel: k.channel, period: k.period, name: k.name }, expanded)
  const images = k.brazeType === 'canvas' ? attachedCampaignImages(k) : campaignImages(k)
  const galleryImages = k.brazeType === 'canvas' && k.canvasSteps?.length
    ? [...k.canvasSteps.flatMap((step) => campaignImagesForStep(images, step.id, k.canvasSteps!.length)),
      ...images.filter((image) => !image.stepId && k.canvasSteps!.length > 1)]
    : images
  const displayedConversions = displayedConversionCount(k, conversionEventIndex)

  const expand = () => toggleOpen(k.id)

  const collapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleOpen(k.id)
  }

  // The card body is a drag handle (see useCardDrag/NodeColumn) — it has no
  // click of its own. This chevron is the only way to open the detail
  // panel, so dragging a card never fights with opening it.
  const chevron = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        selectCampaign(k.id)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title="상세보기"
      aria-label="상세보기"
      style={{
        flex: 'none',
        width: 24,
        height: 24,
        border: 0,
        borderRadius: 999,
        background: '#f2f4f6',
        color: '#4e5968',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      ›
    </button>
  )

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
          onClick={expand}
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
            {k.brazeType === 'canvas' ? formatCount(displayedConversions) : pct(displayedConversions, k.sent)}
          </div>
          <div style={{ fontSize: 10.5, color: '#6f6f6d' }}>{k.channel}</div>
          {chevron}
        </div>
        {notch}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '16px 18px 14px',
          boxShadow: '0 4px 18px rgba(0,20,60,.06)',
          boxSizing: 'border-box',
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
          {isOff && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px 3px 7px',
                borderRadius: 999,
                background: '#f2f4f6',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.04em',
                color: '#8b95a1',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#8b95a1',
                }}
              />
              OFF
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {mode === 'click' && (
              <button
                onClick={collapse}
                style={{
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
            {chevron}
          </div>
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
            {k.brazeType === 'canvas' ? 'Canvas' : k.channel}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.01em' }}>
            {k.name}
          </div>
          {k.period !== '상시' && (
            <div style={{ flex: 'none', marginTop: 2, fontSize: 11, color: '#8b95a1' }}>{k.period}</div>
          )}
        </div>

        {galleryImages.length ? (
          <CampaignImageGallery
            campaignId={k.id}
            images={galleryImages}
            compact
            onImageError={(image) => {
              if (!image.storagePath || refreshAttempted.current.has(image.storagePath)) return
              refreshAttempted.current.add(image.storagePath)
              void signedCampaignImageUrl(image.storagePath).then((url) => {
                const refreshed = (k.images ?? []).map((entry) => entry.key === image.key ? { ...entry, url } : entry)
                updateCampaign(k.id, { images: refreshed })
              }).catch(() => undefined)
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
            {k.brazeType === 'canvas' ? '캔버스 이미지' : '캠페인 이미지'}
          </div>
        )}

        {edit && (k.brazeType !== 'canvas' || (k.canvasSteps?.length ?? 0) <= 1) && <CampaignImageAttachments
          campaignId={k.id}
          images={images}
          onAdd={(files) => void addCampaignImages(k.id, files).catch((error) => window.alert(error instanceof Error ? error.message : String(error)))}
          onRemove={(path) => void removeCampaignImage(k.id, path).catch((error) => window.alert(error instanceof Error ? error.message : String(error)))}
          onReorder={(paths) => reorderCampaignImages(k.id, paths)}
        />}

        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: '#f9fafb',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {getMetrics(k, conversionEventIndex).map(({ label, count, rate, wowDrop }, i) => (
            <div key={label} style={i > 0 ? { borderLeft: '1px solid #e5e8eb', paddingLeft: 8 } : undefined}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {count}
                {rate && <span style={{ fontSize: 10.5, fontWeight: 500, color: '#8b95a1' }}>({rate})</span>}
              </div>
              <div style={{ fontSize: 10.5, color: '#8b95a1', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                {wowDrop && <span aria-label="전주 대비 20% 이상 감소" title="전주 대비 20% 이상 감소" style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: '#f04452' }} />}
                {label}
              </div>
            </div>
          ))}
        </div>

        {edit && (
          <div
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
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
