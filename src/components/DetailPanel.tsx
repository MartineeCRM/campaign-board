import { useRef } from 'react'
import { useBoardStore } from '../store'
import { formatAudience } from '../utils/audience'
import { getMetrics } from '../utils/metrics'
import type { Campaign, CampaignImage, Status } from '../types'
import CampaignImageGallery from './CampaignImageGallery'
import CampaignImageAttachments from './CampaignImageAttachments'
import { attachedCampaignImages, campaignImages, campaignImagesForStep, signedCampaignImageUrl } from '../utils/campaign-images'
import { formatCount, pct } from '../utils/format'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}

const FIELD_ROWS: { key: keyof Campaign; label: string }[] = [
  { key: 'channel', label: '채널' },
  { key: 'delivery', label: '발송 방식' },
  { key: 'trigger', label: '트리거' },
  { key: 'audience', label: '대상' },
  { key: 'convEvent', label: '전환 이벤트' },
  { key: 'cap', label: 'Re-eligible' },
]

export default function DetailPanel() {
  const refreshAttempted = useRef(new Set<string>())
  const edit = useBoardStore((s) => s.edit)
  const sel = useBoardStore((s) => s.sel)
  const client = useBoardStore((s) => s.currentClient())
  const conversionEventIndex = client.conversionEventIndex ?? 0
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)
  const addCampaignImages = useBoardStore((s) => s.addCampaignImages)
  const removeCampaignImage = useBoardStore((s) => s.removeCampaignImage)
  const reorderCampaignImages = useBoardStore((s) => s.reorderCampaignImages)
  const deleteCampaign = useBoardStore((s) => s.deleteCampaign)
  const enterEdit = useBoardStore((s) => s.enterEdit)
  const confirmEdit = useBoardStore((s) => s.confirmEdit)

  if (!sel) return null

  let found: Campaign | null = null
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      const campaign = node.campaigns.find((c) => c.id === sel)
      if (campaign) found = campaign
    }
  }
  if (!found) return null
  const k = found
  const images = k.brazeType === 'canvas' ? attachedCampaignImages(k) : campaignImages(k)
  const status = STATUS_META[k.status]
  const isLive = k.status !== 'stopped'

  const refreshImage = (image: CampaignImage) => {
    if (!image.storagePath || refreshAttempted.current.has(image.storagePath)) return
    refreshAttempted.current.add(image.storagePath)
    void signedCampaignImageUrl(image.storagePath).then((url) => {
      const current = (k.images ?? []).map((entry) => entry.key === image.key ? { ...entry, url } : entry)
      updateCampaign(k.id, { images: current })
    }).catch(() => undefined)
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.6,
    fontFamily: 'inherit',
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
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

        {edit ? (
          <input
            value={k.brazeId ?? ''}
            onChange={(e) => updateCampaign(k.id, { brazeId: e.target.value || undefined })}
            placeholder="Braze ID"
            style={{ ...inputStyle, fontSize: 12, color: '#8b95a1', fontFamily: 'ui-monospace, Menlo, monospace', marginBottom: 10 }}
          />
        ) : (
          <div style={{ fontSize: 12, fontWeight: 500, color: '#8b95a1', fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all', marginBottom: 10 }}>
            {k.brazeId || 'Braze ID 미연결'}
          </div>
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
                {(['Push', 'Kakao', 'Email', 'In-app', 'SMS', 'Banner', 'Webhook'] as Campaign['channel'][]).map((ch) => (
                  <option key={ch}>{ch}</option>
                ))}
              </select>
              <select
                value={k.brazeType ?? 'campaign'}
                onChange={(e) => updateCampaign(k.id, { brazeType: e.target.value as Campaign['brazeType'] })}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e8eb', background: '#f2f4f6', color: '#4e5968' }}
              >
                <option value="campaign">Campaign</option>
                <option value="canvas">Canvas</option>
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
              <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: '#4e5968' }}>{k.brazeType === 'canvas' ? 'Canvas' : k.channel}</div>
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        {k.brazeType !== 'canvas' && <CampaignImageGallery
          campaignId={k.id}
          images={images}
          onImageError={refreshImage}
        />}
        {k.brazeType === 'canvas' && <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a1', marginTop: 16 }}>전체 성과</div>}
        {/* 지표 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '14px 4px', borderRadius: 14, background: '#f9fafb', margin: '14px 0' }}>
          {getMetrics(k, conversionEventIndex).map(({ label, count, rate, wowDrop }, i) => (
            <div key={label} style={{ padding: '0 8px', ...(i > 0 ? { borderLeft: '1px solid #e5e8eb' } : {}) }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {count}
                {rate && <span style={{ fontSize: 11, fontWeight: 500, color: '#8b95a1' }}>({rate})</span>}
              </div>
              <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                {wowDrop && <span aria-label="전주 대비 20% 이상 감소" title="전주 대비 20% 이상 감소" style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: '#f04452' }} />}
                {label}
              </div>
            </div>
          ))}
        </div>

        {k.lastSyncedAt && (
          <div style={{ fontSize: 11, fontWeight: 400, color: '#8b95a1', textAlign: 'right', margin: '0 0 18px' }}>
            마지막 싱크 {new Date(k.lastSyncedAt).toLocaleString('ko-KR', { hour12: false })}
          </div>
        )}

        {k.brazeType === 'canvas' && <>
          {(k.canvasSteps ?? []).map((step, index) => {
            const stepImages = campaignImagesForStep(images, step.id, k.canvasSteps!.length)
            const isPush = step.channel === 'Push'
            const isIam = step.channel === 'In-app' || step.channel === 'Banner'
            const primaryLabel = isIam ? '노출수' : isPush ? '발송수' : '노출/발송수'
            const secondaryLabel = isIam ? '클릭수' : isPush ? '오픈수' : '클릭/오픈수'
            const secondaryCount = isIam ? step.clicks : isPush ? step.opens : step.engagements
            const conversionCount = step.conversionCounts[conversionEventIndex] ?? 0
            return <section key={step.id} style={{ padding: '16px 0 18px', borderTop: '1px solid #e5e8eb' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, fontWeight: 700, color: '#191f28' }}>
                <span>스텝 {index + 1}</span>
                <span style={{ color: '#8b95a1', fontSize: 12, fontWeight: 500 }}>({step.channel})</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#4e5968' }}>{step.name}</div>
              {stepImages.length ? <CampaignImageGallery
                campaignId={`${k.id}:${step.id}`}
                images={stepImages}
                onImageError={refreshImage}
              /> : <div style={{ marginTop: 12, padding: '20px 12px', borderRadius: 12, background: '#f6f7f8', textAlign: 'center', color: '#8b95a1', fontSize: 12 }}>이미지 없음</div>}
              {edit && <div style={{ marginTop: 10 }}><CampaignImageAttachments
                campaignId={`${k.id}:${step.id}`}
                images={stepImages}
                onAdd={(files) => void addCampaignImages(k.id, files, step.id).catch((error) => window.alert(error instanceof Error ? error.message : String(error)))}
                onRemove={(path) => void removeCampaignImage(k.id, path).catch((error) => window.alert(error instanceof Error ? error.message : String(error)))}
                onReorder={(paths) => reorderCampaignImages(k.id, paths)}
              /></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '12px 4px', borderRadius: 12, background: '#f9fafb', marginTop: 12 }}>
                {[
                  { label: primaryLabel, count: step.sent },
                  { label: secondaryLabel, count: secondaryCount, rate: pct(secondaryCount, step.sent) },
                  { label: conversionEventIndex === 0 ? '전환수' : `전환수 (${String.fromCharCode(65 + conversionEventIndex)})`, count: conversionCount },
                ].map(({ label, count, rate }, metricIndex) => <div key={label} style={{ padding: '0 8px', ...(metricIndex > 0 ? { borderLeft: '1px solid #e5e8eb' } : {}) }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCount(count)}{rate && <span style={{ fontSize: 10, fontWeight: 500, color: '#8b95a1', marginLeft: 4 }}>({rate})</span>}</div>
                  <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 2 }}>{label}</div>
                </div>)}
              </div>
            </section>
          })}
          {!k.canvasSteps?.length && <div style={{ padding: '18px 0', color: '#8b95a1', fontSize: 12 }}>메시지 스텝 데이터가 없습니다. 동기화 후 표시됩니다.</div>}
          {(k.canvasSteps?.length ?? 0) > 1 && images.some((image) => !image.stepId) && <section style={{ borderTop: '1px solid #e5e8eb', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a1' }}>스텝 미지정 이미지</div>
            <CampaignImageGallery campaignId={`${k.id}:unassigned`} images={images.filter((image) => !image.stepId)} onImageError={refreshImage} />
            {edit && images.filter((image) => !image.stepId && image.storagePath).map((image, imageIndex) => <label key={image.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#4e5968' }}>
              이미지 {imageIndex + 1} 스텝 지정
              <select value="" onChange={(event) => updateCampaign(k.id, { images: (k.images ?? []).map((item) => item.key === image.key && item.storagePath ? { ...item, stepId: event.target.value } : item) })}>
                <option value="">스텝 선택</option>
                {k.canvasSteps?.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
              </select>
            </label>)}
          </section>}
        </>}

        {/* 캠페인 설정 필드 */}
        {k.brazeType !== 'canvas' && <><div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a1', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>캠페인 설정</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELD_ROWS.map((row) => (
            <div
              key={row.key}
              style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 8, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid #f2f4f6' }}
            >
              <div style={{ fontSize: 12, color: '#8b95a1', paddingTop: 2 }}>{row.label}</div>
              {edit && row.key !== 'channel' ? (
                <input
                  value={(k[row.key] as string) ?? ''}
                  onChange={(e) => updateCampaign(k.id, { [row.key]: e.target.value } as Partial<Campaign>)}
                  style={inputStyle}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.6, color: '#333d4b', wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {(row.key === 'audience'
                    ? formatAudience(k.audience)
                    : row.key === 'channel'
                      ? k.channel === 'In-app' ? 'In-app Message' : k.channel
                      : k[row.key] as string) || '—'}
                </div>
              )}
            </div>
          ))}
        </div></>}

        {/* 삭제 (편집 모드에서만) */}
        {edit && (
          <button
            onClick={() => { deleteCampaign(k.id); selectCampaign(null) }}
            style={{ width: '100%', marginTop: 16, fontSize: 13, fontWeight: 700, padding: '11px 0', border: 0, borderRadius: 10, background: '#fff0f1', color: '#f04452', cursor: 'pointer' }}
          >
            {k.brazeType === 'canvas' ? '캔버스 삭제' : '캠페인 삭제'}
          </button>
        )}
      </div>

      {/* 하단 액션 */}
      <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #f2f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-label={k.brazeType === 'canvas' ? '캔버스 삭제' : '캠페인 삭제'}
          title={k.brazeType === 'canvas' ? '캔버스 삭제' : '캠페인 삭제'}
          onClick={() => { deleteCampaign(k.id); selectCampaign(null) }}
          style={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid #f2d6d9', borderRadius: 11, background: '#fff7f7', color: '#e5484d', cursor: 'pointer' }}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={edit ? '수정 완료' : k.brazeType === 'canvas' ? '캔버스 편집' : '캠페인 편집'}
          title={edit ? '수정 완료' : k.brazeType === 'canvas' ? '캔버스 편집' : '캠페인 편집'}
          onClick={edit ? confirmEdit : enterEdit}
          style={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid #e5e8eb', borderRadius: 11, background: '#fff', color: '#4e5968', cursor: 'pointer' }}
        >
          {edit ? (
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          )}
        </button>
        {k.link ? (
          <a
            href={k.link}
            target="_blank"
            rel="noopener"
            style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 13, borderRadius: 12, background: '#191f28', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            {k.brazeType === 'canvas' ? '캔버스 열기 ↗' : '캠페인 열기 ↗'}
          </a>
        ) : (
          <div style={{ minWidth: 0, flex: 1, padding: 13, borderRadius: 12, background: '#f2f4f6', color: '#8b95a1', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
            {k.brazeType === 'canvas' ? '캔버스 링크를 입력하면 바로가기가 생깁니다' : '캠페인 링크를 입력하면 바로가기가 생깁니다'}
          </div>
        )}
      </div>
    </div>
  )
}
