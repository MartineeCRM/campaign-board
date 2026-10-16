import { useEffect, useRef, useState } from 'react'
import type { CampaignImage } from '../types'

interface Props {
  campaignId: string
  images: CampaignImage[]
  onImageError: (image: CampaignImage) => void
  compact?: boolean
}

export default function CampaignImageGallery({ campaignId, images, onImageError, compact = false }: Props) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => setIndex(0), [campaignId, images.length])
  if (!images.length) return null
  const current = images[Math.min(index, images.length - 1)]
  const move = (delta: number) => setIndex((value) => (value + delta + images.length) % images.length)

  return <div
    aria-label="캠페인 이미지 갤러리"
    onPointerDown={compact && images.length > 1 ? (event) => event.stopPropagation() : undefined}
    onClick={compact && images.length > 1 ? (event) => event.stopPropagation() : undefined}
    onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY } }}
    onTouchEnd={(event) => {
      const start = touchStart.current
      const touch = event.changedTouches[0]
      touchStart.current = null
      if (start && Math.abs(touch.clientX - start.x) > 45 && Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y)) move(touch.clientX < start.x ? 1 : -1)
    }}
    style={{ position: 'relative', margin: '14px 0 0', borderRadius: 12, overflow: 'hidden', background: '#f6f7f8' }}
  >
    <img src={current.url} alt="캠페인 이미지" onError={() => onImageError(current)} style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }} />
    {images.length > 1 && <>
      <button type="button" aria-label="이전 이미지" onClick={() => move(-1)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', border: 0, borderRadius: '50%', width: 30, height: 30, background: '#ffffffdd', color: '#333d4b', cursor: 'pointer' }}>‹</button>
      <button type="button" aria-label="다음 이미지" onClick={() => move(1)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, borderRadius: '50%', width: 30, height: 30, background: '#ffffffdd', color: '#333d4b', cursor: 'pointer' }}>›</button>
      <div aria-live="polite" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', borderRadius: 999, padding: '3px 8px', background: '#191f28bb', color: '#fff', fontSize: 11 }}>{index + 1} / {images.length}</div>
    </>}
  </div>
}
