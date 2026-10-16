import { useRef, useState } from 'react'
import type { CampaignImage } from '../types'

interface Props {
  campaignId: string
  images: CampaignImage[]
  onAdd: (files: File[]) => void
  onRemove: (storagePath: string) => void
  onReorder: (storagePaths: string[]) => void
}

function imageFiles(files: FileList | File[] | null | undefined): File[] {
  return Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
}

function fileName(path: string | undefined, fallback: string): string {
  return path ? path.split('/').pop() ?? fallback : fallback
}

export default function CampaignImageAttachments({ campaignId, images, onAdd, onRemove, onReorder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const draggedPath = useRef<string | null>(null)
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  const appendFiles = (files: File[]) => { if (files.length) onAdd(files) }

  return (
    <div
      role="group"
      aria-label="캠페인 이미지"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onPointerDown={stop}
      onClick={stop}
      onDragEnter={(event) => { stop(event); event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => { stop(event); event.preventDefault() }}
      onDragLeave={(event) => { stop(event); if (event.currentTarget === event.target) setDragging(false) }}
      onDrop={(event) => { stop(event); event.preventDefault(); setDragging(false); appendFiles(imageFiles(event.dataTransfer.files)) }}
      onPaste={(event) => {
        stop(event)
        const files = Array.from(event.clipboardData.items)
          .filter((item) => item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter((file): file is File => !!file)
        appendFiles(files)
      }}
      style={{ border: `1px dashed ${dragging ? '#3182f6' : '#d6dbe1'}`, borderRadius: 10, padding: 10, background: dragging ? '#f3f8ff' : '#fafbfc' }}
    >
      <input
        ref={inputRef}
        aria-label="이미지 추가"
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => { appendFiles(imageFiles(event.currentTarget.files)); event.currentTarget.value = '' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#8b95a1' }}>이미지를 붙여넣거나 끌어 놓으세요</span>
        <button type="button" onClick={() => inputRef.current?.click()} style={{ border: '1px solid #e5e8eb', borderRadius: 7, background: '#fff', padding: '5px 8px', cursor: 'pointer', fontSize: 11 }}>이미지 추가</button>
      </div>
      {!!images.length && <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginTop: 9 }}>
        {images.map((image, index) => <div key={image.key} style={{ position: 'relative', flex: '0 0 58px' }}>
          <img src={image.url} alt="" draggable={false} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 7, display: 'block' }} />
          <button type="button" aria-label={`${fileName(image.storagePath, `이미지 ${index + 1}`)} 삭제`} onClick={() => image.storagePath && onRemove(image.storagePath)} style={{ position: 'absolute', right: 2, top: 2, border: 0, borderRadius: 99, background: '#191f28cc', color: '#fff', width: 19, height: 19, cursor: 'pointer' }}>×</button>
          {image.storagePath && <button
            type="button"
            aria-label={`${fileName(image.storagePath, `이미지 ${index + 1}`)} 순서 변경`}
            draggable
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const paths = images.flatMap((item) => item.storagePath ? [item.storagePath] : [])
              const from = paths.indexOf(image.storagePath!)
              const to = from + (event.key === 'ArrowLeft' ? -1 : 1)
              if (to < 0 || to >= paths.length) return
              ;[paths[from], paths[to]] = [paths[to], paths[from]]
              onReorder(paths)
            }}
            onDragStart={(event) => { stop(event); draggedPath.current = image.storagePath!; event.dataTransfer?.setData('text/plain', image.storagePath!) }}
            onDragOver={(event) => { stop(event); event.preventDefault() }}
            onDrop={(event) => {
              stop(event); event.preventDefault()
              const from = draggedPath.current ?? event.dataTransfer?.getData('text/plain')
              draggedPath.current = null
              if (!from || from === image.storagePath) return
              const paths = images.flatMap((item) => item.storagePath ? [item.storagePath] : [])
              const next = paths.filter((path) => path !== from)
              next.splice(Math.max(0, next.indexOf(image.storagePath)), 0, from)
              onReorder(next)
            }}
            style={{ position: 'absolute', left: 3, bottom: 3, border: 0, borderRadius: 5, background: '#191f28bb', color: '#fff', fontSize: 10, padding: '2px 4px', cursor: 'grab' }}
          >↔</button>}
        </div>)}
      </div>}
      <span style={{ display: 'none' }}>{campaignId}</span>
    </div>
  )
}
