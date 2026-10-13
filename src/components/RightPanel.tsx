import { useCallback, useEffect, useRef } from 'react'
import { useBoardStore } from '../store'
import BoardStructurePanel from './BoardStructurePanel'
import DetailPanel from './DetailPanel'

const MIN_WIDTH = 280

export default function RightPanel() {
  const edit = useBoardStore((s) => s.edit)
  const sel = useBoardStore((s) => s.sel)
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const panelWidth = useBoardStore((s) => s.panelWidth)
  const setPanelWidth = useBoardStore((s) => s.setPanelWidth)

  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(panelWidth)

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = panelWidth
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [panelWidth])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const maxW = Math.floor(window.innerWidth * 0.3)
    const delta = startX.current - e.clientX // drag left = wider
    const next = Math.min(maxW, Math.max(MIN_WIDTH, startW.current + delta))
    setPanelWidth(next)
  }, [setPanelWidth])

  const onResizeEnd = useCallback((e: React.PointerEvent) => {
    dragging.current = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  const visible = edit || !!sel

  // Reset width when panel closes
  useEffect(() => {
    if (!visible) setPanelWidth(320)
  }, [visible, setPanelWidth])

  if (!visible) return null

  return (
    <>
      {!edit && sel && (
        <div
          onClick={() => selectCampaign(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.2)', zIndex: 50 }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: panelWidth,
          background: '#fff',
          borderLeft: '1px solid #e5e8eb',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Resize handle */}
        <div
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(49,130,246,.13)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            zIndex: 10,
            transition: 'background .15s',
          }}
        />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginLeft: 6 }}>
          {sel ? <DetailPanel /> : <BoardStructurePanel />}
        </div>
      </div>
    </>
  )
}
